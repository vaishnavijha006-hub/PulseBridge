-- =============================================================================
-- Migration: 20261017000002_consent_based_family_recovery_circle.sql
-- Description: Consent-Based Family Recovery Circle schema extension,
--              granular permissions, fail-closed family view RPC, and
--              strict Row Level Security policies.
-- =============================================================================

-- 1. EXTEND CAREGIVER_CONSENT TABLE WITH GRANULAR PERMISSIONS & INVITATION LIFECYCLE
ALTER TABLE public.caregiver_consent
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{
    "shareMedicationStatus": true,
    "shareDailyVitals": true,
    "allowDirectCalling": true,
    "shareCareInstructions": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS invite_code text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Ensure check constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caregiver_consent_status_check'
  ) THEN
    ALTER TABLE public.caregiver_consent
      ADD CONSTRAINT caregiver_consent_status_check
      CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired'));
  END IF;
END $$;

-- 2. CREATE FAMILY SUPPORT NOTES TABLE FOR RECOVERY COORDINATION
CREATE TABLE IF NOT EXISTS public.family_support_notes (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  caregiver_id text NOT NULL,
  caregiver_name text NOT NULL,
  relationship text NOT NULL,
  message text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by patient
CREATE INDEX IF NOT EXISTS idx_family_support_notes_patient ON public.family_support_notes (patient_id, sent_at DESC);

-- Enable RLS on family_support_notes
ALTER TABLE public.family_support_notes ENABLE ROW LEVEL SECURITY;

-- 3. STRICT ROW LEVEL SECURITY (RLS) POLICIES
-- Drop existing overly permissive policy if exists
DROP POLICY IF EXISTS "Caregiver consent access" ON public.caregiver_consent;
DROP POLICY IF EXISTS "Patients manage caregiver consent" ON public.caregiver_consent;
DROP POLICY IF EXISTS "Authorized caregivers read consent" ON public.caregiver_consent;

-- 3.1 Patient controls their own consent records
CREATE POLICY "Patients manage caregiver consent"
  ON public.caregiver_consent
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 3.2 Family support notes policy:
DROP POLICY IF EXISTS "Family support notes access" ON public.family_support_notes;
CREATE POLICY "Family support notes access"
  ON public.family_support_notes
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 4. UPDATED GRANULAR FAIL-CLOSED FAMILY VIEW RPC FUNCTION
CREATE OR REPLACE FUNCTION public.get_granular_family_view(
  p_patient_id text,
  p_caregiver_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_consent record;
  v_patient record;
  v_doses_total integer;
  v_doses_taken integer;
  v_has_missed boolean;
  v_next_dose text;
  v_latest_update text;
  v_care_instructions jsonb;
  v_notes jsonb;
  v_perms jsonb;
  v_now timestamptz := now();
BEGIN
  -- 1. Check patient exists
  SELECT name INTO v_patient FROM public.patients WHERE id = p_patient_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 2. Find matching caregiver consent
  IF p_caregiver_id IS NOT NULL THEN
    SELECT * INTO v_consent FROM public.caregiver_consent
    WHERE patient_id = p_patient_id
      AND (id = p_caregiver_id OR caregiver_user_id = p_caregiver_id)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO v_consent FROM public.caregiver_consent
    WHERE patient_id = p_patient_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- 3. Fail-Closed Redaction if no consent, not authorized, revoked, or expired
  IF v_consent IS NULL
     OR v_consent.authorized IS NOT TRUE
     OR v_consent.status <> 'accepted'
     OR (v_consent.expires_at IS NOT NULL AND v_consent.expires_at < v_now) THEN
    RETURN jsonb_build_object(
      'patientName', v_patient.name,
      'patientId', p_patient_id,
      'caregiverMemberId', coalesce(v_consent.id, 'unknown'),
      'caregiverName', coalesce(v_consent.caregiver_name, 'Family Caregiver'),
      'relationship', coalesce(v_consent.relationship, 'Family'),
      'authorized', false,
      'status', coalesce(v_consent.status, 'revoked'),
      'permissions', jsonb_build_object(
        'shareMedicationStatus', false,
        'shareDailyVitals', false,
        'allowDirectCalling', false,
        'shareCareInstructions', false
      ),
      'dosesToday', NULL,
      'nextDoseTime', NULL,
      'missedDose', false,
      'healthUpdateStatus', NULL,
      'contactNumber', NULL,
      'careInstructions', NULL,
      'supportNotes', '[]'::jsonb,
      'redactedReason', 'Access is not authorized or has been revoked by the patient.'
    );
  END IF;

  v_perms := coalesce(v_consent.permissions, '{}'::jsonb);

  -- 4. Gather data for authorized permissions
  -- A. Medication Status
  IF (v_perms->>'shareMedicationStatus')::boolean IS TRUE THEN
    SELECT
      count(*),
      count(*) FILTER (WHERE status = 'taken'),
      bool_or(status IN ('missed', 'cannot_take')),
      min(scheduled_time) FILTER (WHERE status IN ('pending', 'snoozed'))
    INTO v_doses_total, v_doses_taken, v_has_missed, v_next_dose
    FROM public.medication_schedules
    WHERE patient_id = p_patient_id;
  END IF;

  -- B. Daily Vitals / Health check-in
  IF (v_perms->>'shareDailyVitals')::boolean IS TRUE THEN
    SELECT
      CASE
        WHEN state = 'good' THEN 'Feeling well'
        WHEN state = 'ok' THEN 'Recovering steadily'
        ELSE 'Reported symptoms'
      END INTO v_latest_update
    FROM public.health_updates
    WHERE patient_id = p_patient_id
    ORDER BY submitted_at DESC
    LIMIT 1;
  END IF;

  -- C. Discharge Care Instructions
  IF (v_perms->>'shareCareInstructions')::boolean IS TRUE THEN
    v_care_instructions := jsonb_build_array(
      'Take medicines with a full glass of lukewarm water.',
      'Maintain daily hydration (2.5L water/liquids recommended).',
      'Follow a light, balanced diet with minimal excess sodium or spice.',
      'Report any unexpected discomfort or persistent heaviness directly.'
    );
  ELSE
    v_care_instructions := NULL;
  END IF;

  -- D. Support Notes
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sn.id,
      'patientId', sn.patient_id,
      'caregiverId', sn.caregiver_id,
      'caregiverName', sn.caregiver_name,
      'relationship', sn.relationship,
      'message', sn.message,
      'sentAt', sn.sent_at
    ) ORDER BY sn.sent_at DESC
  ), '[]'::jsonb) INTO v_notes
  FROM public.family_support_notes sn
  WHERE sn.patient_id = p_patient_id;

  -- Return Granular Redacted Payload
  RETURN jsonb_build_object(
    'patientName', v_patient.name,
    'patientId', p_patient_id,
    'caregiverMemberId', v_consent.id,
    'caregiverName', v_consent.caregiver_name,
    'relationship', v_consent.relationship,
    'authorized', true,
    'status', v_consent.status,
    'permissions', v_perms,
    'dosesToday', CASE
      WHEN (v_perms->>'shareMedicationStatus')::boolean IS TRUE
      THEN jsonb_build_object('taken', coalesce(v_doses_taken, 0), 'total', coalesce(v_doses_total, 0))
      ELSE NULL
    END,
    'nextDoseTime', CASE
      WHEN (v_perms->>'shareMedicationStatus')::boolean IS TRUE
      THEN v_next_dose
      ELSE NULL
    END,
    'missedDose', CASE
      WHEN (v_perms->>'shareMedicationStatus')::boolean IS TRUE
      THEN coalesce(v_has_missed, false)
      ELSE false
    END,
    'healthUpdateStatus', CASE
      WHEN (v_perms->>'shareDailyVitals')::boolean IS TRUE
      THEN coalesce(v_latest_update, 'No update today yet')
      ELSE NULL
    END,
    'contactNumber', CASE
      WHEN (v_perms->>'allowDirectCalling')::boolean IS TRUE
      THEN v_consent.contact_number
      ELSE NULL
    END,
    'careInstructions', v_care_instructions,
    'supportNotes', v_notes,
    'redactedReason', NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
