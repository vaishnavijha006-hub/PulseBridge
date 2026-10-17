-- =============================================================================
-- PulseBridge AI — Phase 4 Remediation Migration: Strict Least-Privilege & Hardened Clinical Triggers
-- File: supabase/migrations/20261017000001_least_privilege_grants.sql
-- Revision: Final Pre-Execution Hardening (Explicit RLS Verification, Restrictive Deny, Full Rx Immutability)
--
-- PURPOSE:
-- 1. Revoke broad "GRANT ALL" and lock down DEFAULT PRIVILEGES for role postgres and invoking role.
-- 2. Explicitly enforce relrowsecurity (ENABLE ROW LEVEL SECURITY) across all nine sensitive tables.
-- 3. Dynamically drop ALL existing policies on sensitive tables from pg_policies to ensure no
--    permissive policy survives.
-- 4. Deploy explicit interim RESTRICTIVE deny-by-default RLS policies (USING false) for anon & authenticated.
-- 5. Set security_invoker = true on patient_summaries view to respect underlying table RLS.
-- 6. Revoke execution of get_family_view from anon, authenticated, and PUBLIC until verified
--    caregiver identity (caregiver_user_id) and server-side relationship checks are implemented.
-- 7. Deploy hardened prescription confirmation trigger:
--    - Covers INSERT and UPDATE
--    - Enforces strict immutability on confirmed prescriptions (prohibits unconfirming or altering
--      id, patient_id, image_url, fields, confirmed_at, doctor_notes, or created_at)
--    - Rejects duplicate critical keys, null/unexpected statuses, empty values, and missing keys
--    - Sets search_path = public, pg_temp
-- 8. Secure internal trigger functions with explicit search_path and revoked execution.
-- =============================================================================

-- Step 1: Revoke existing overbroad privileges from anon, authenticated, and PUBLIC
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated, PUBLIC;

-- Step 2: Lock down DEFAULT PRIVILEGES for role postgres and invoking role
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, PUBLIC;

-- Step 3: Grant schema USAGE
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Step 4: Explicitly Enforce Row Level Security (relrowsecurity) on All 9 Sensitive Tables
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- Step 5: Dynamically Drop ALL Existing Policies on Sensitive Tables
-- Inspects pg_policies dynamically to ensure NO legacy permissive policy survives
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'patients', 'prescriptions', 'care_plans',
        'medication_schedules', 'adherence_logs',
        'health_updates', 'care_gaps', 'caregiver_consent',
        'follow_ups'
      )
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- Step 6: Deploy Explicit Interim RESTRICTIVE Deny-by-Default RLS Policies
-- Using AS RESTRICTIVE ensures that all queries are evaluated with an AND condition,
-- guaranteeing that even if a permissive policy is added later, access is denied.
CREATE POLICY "Interim restrictive deny access to patients"
  ON public.patients AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim restrictive deny access to prescriptions"
  ON public.prescriptions AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim restrictive deny access to care_plans"
  ON public.care_plans AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim restrictive deny access to medication_schedules"
  ON public.medication_schedules AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim restrictive deny access to adherence_logs"
  ON public.adherence_logs AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim restrictive deny access to health_updates"
  ON public.health_updates AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim restrictive deny access to care_gaps"
  ON public.care_gaps AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim restrictive deny access to caregiver_consent"
  ON public.caregiver_consent AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim restrictive deny access to follow_ups"
  ON public.follow_ups AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Step 7: View Security Invoker Setting
-- Set security_invoker = true so view queries execute with calling user permissions
-- and respect underlying table RLS policies.
ALTER VIEW public.patient_summaries SET (security_invoker = true);
REVOKE ALL ON public.patient_summaries FROM anon, authenticated, PUBLIC;

-- Step 8: Secure get_family_view RPC & Search Path Hardening
-- Revoke execution from anon, authenticated, and PUBLIC until verified caregiver identity is implemented.
REVOKE EXECUTE ON FUNCTION public.get_family_view(text) FROM anon, authenticated, PUBLIC;

CREATE OR REPLACE FUNCTION public.get_family_view(p_patient_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_consent record;
  v_patient record;
  v_doses_total integer;
  v_doses_taken integer;
  v_has_missed boolean;
  v_next_dose text;
  v_latest_update text;
BEGIN
  -- 1. Check patient exists
  SELECT name INTO v_patient FROM public.patients WHERE id = p_patient_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 2. Check caregiver consent
  SELECT * INTO v_consent FROM public.caregiver_consent
  WHERE patient_id = p_patient_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- If consent is absent or revoked, strictly redact
  IF v_consent IS NULL OR v_consent.authorized IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'patientName', v_patient.name,
      'headlineKey', 'family_headline',
      'dosesToday', jsonb_build_object('taken', 0, 'total', 0),
      'nextDoseTime', NULL,
      'healthUpdateStatus', 'Consent Revoked',
      'missedDose', false,
      'caregiverAccess', jsonb_build_object(
        'patientId', p_patient_id,
        'caregiverName', coalesce(v_consent.caregiver_name, 'Family Caregiver'),
        'authorized', false,
        'contactNumber', NULL,
        'relationship', coalesce(v_consent.relationship, 'Family')
      )
    );
  END IF;

  -- 3. Compute authorized summary
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'taken'),
    bool_or(status IN ('missed', 'cannot_take')),
    min(scheduled_time) FILTER (WHERE status IN ('pending', 'snoozed'))
  INTO v_doses_total, v_doses_taken, v_has_missed, v_next_dose
  FROM public.medication_schedules
  WHERE patient_id = p_patient_id;

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

  RETURN jsonb_build_object(
    'patientName', v_patient.name,
    'headlineKey', 'family_headline',
    'dosesToday', jsonb_build_object('taken', coalesce(v_doses_taken, 0), 'total', coalesce(v_doses_total, 0)),
    'nextDoseTime', v_next_dose,
    'healthUpdateStatus', coalesce(v_latest_update, 'Submitted'),
    'missedDose', coalesce(v_has_missed, false),
    'caregiverAccess', jsonb_build_object(
      'patientId', p_patient_id,
      'caregiverName', v_consent.caregiver_name,
      'authorized', true,
      'contactNumber', v_consent.contact_number,
      'relationship', v_consent.relationship
    )
  );
END;
$$;

-- Step 9: Hardened Prescription Immutability & Clinical Validation Trigger
-- Covers INSERT and UPDATE.
-- 1. Enforces strict immutability on confirmed prescriptions:
--    Prohibits unconfirming (confirmed = false or null) and prohibits altering
--    id, patient_id, image_url, fields, confirmed_at, doctor_notes, or created_at.
-- 2. Validates clinical payload: non-empty JSON array, no duplicate critical keys, non-null status,
--    and confirmed status on medicine, dosage, frequency, and duration.
CREATE OR REPLACE FUNCTION public.trg_validate_prescription_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  f jsonb;
  k text;
  v text;
  s text;
  medicine_count integer := 0;
  dosage_count integer := 0;
  frequency_count integer := 0;
  duration_count integer := 0;
BEGIN
  -- 1. IMMUTABILITY OF CONFIRMED PRESCRIPTIONS:
  -- Once confirmed, a prescription is an immutable legal medical record.
  IF TG_OP = 'UPDATE' AND OLD.confirmed = true THEN
    -- Prohibit unconfirming (false or null)
    IF NEW.confirmed IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Prescription security error: A confirmed prescription cannot be unconfirmed. To modify a treatment plan, the doctor must issue a replacement prescription draft.';
    END IF;

    -- Prohibit altering any clinically relevant or identity column
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.fields IS DISTINCT FROM OLD.fields
       OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
       OR NEW.doctor_notes IS DISTINCT FROM OLD.doctor_notes
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Prescription security error: Confirmed prescriptions are immutable clinical records. Modifying id, patient, image, fields, confirmation timestamp, doctor notes, or creation timestamp is forbidden. To change medication or instructions, issue a replacement prescription draft.';
    END IF;
  END IF;

  -- 2. CLINICAL PAYLOAD VALIDATION ON CONFIRMATION:
  IF NEW.confirmed = true AND (TG_OP = 'INSERT' OR OLD.confirmed IS NULL OR OLD.confirmed = false) THEN
    -- Check non-null JSON array with length > 0
    IF NEW.fields IS NULL OR jsonb_typeof(NEW.fields) <> 'array' THEN
      RAISE EXCEPTION 'Prescription confirmation rejected: fields must be a valid JSON array.';
    END IF;

    IF jsonb_array_length(NEW.fields) = 0 THEN
      RAISE EXCEPTION 'Prescription confirmation rejected: fields array cannot be empty.';
    END IF;

    FOR f IN SELECT * FROM jsonb_array_elements(NEW.fields)
    LOOP
      IF jsonb_typeof(f) <> 'object' THEN
        RAISE EXCEPTION 'Prescription confirmation rejected: each field item must be a JSON object.';
      END IF;

      IF NOT (f ? 'key' AND f ? 'value' AND f ? 'status') THEN
        RAISE EXCEPTION 'Prescription confirmation rejected: each field item must include "key", "value", and "status".';
      END IF;

      k := f->>'key';
      v := trim(coalesce(f->>'value', ''));
      s := f->>'status';

      IF s IS NULL OR s NOT IN ('confirmed', 'uncertain', 'editable') THEN
        RAISE EXCEPTION 'Prescription confirmation rejected: field "%" has invalid or null status "%".', k, s;
      END IF;

      IF k = 'medicine' THEN
        medicine_count := medicine_count + 1;
        IF medicine_count > 1 THEN
          RAISE EXCEPTION 'Prescription confirmation rejected: duplicate critical field "medicine" detected.';
        END IF;
        IF v = '' OR s <> 'confirmed' THEN
          RAISE EXCEPTION 'Prescription confirmation rejected: critical field "medicine" must be confirmed and non-empty.';
        END IF;
      ELSIF k = 'dosage' THEN
        dosage_count := dosage_count + 1;
        IF dosage_count > 1 THEN
          RAISE EXCEPTION 'Prescription confirmation rejected: duplicate critical field "dosage" detected.';
        END IF;
        IF v = '' OR s <> 'confirmed' THEN
          RAISE EXCEPTION 'Prescription confirmation rejected: critical field "dosage" must be confirmed and non-empty.';
        END IF;
      ELSIF k = 'frequency' THEN
        frequency_count := frequency_count + 1;
        IF frequency_count > 1 THEN
          RAISE EXCEPTION 'Prescription confirmation rejected: duplicate critical field "frequency" detected.';
        END IF;
        IF v = '' OR s <> 'confirmed' THEN
          RAISE EXCEPTION 'Prescription confirmation rejected: critical field "frequency" must be confirmed and non-empty.';
        END IF;
      ELSIF k = 'duration' THEN
        duration_count := duration_count + 1;
        IF duration_count > 1 THEN
          RAISE EXCEPTION 'Prescription confirmation rejected: duplicate critical field "duration" detected.';
        END IF;
        IF v = '' OR s <> 'confirmed' THEN
          RAISE EXCEPTION 'Prescription confirmation rejected: critical field "duration" must be confirmed and non-empty.';
        END IF;
      END IF;
    END LOOP;

    IF medicine_count = 0 OR dosage_count = 0 OR frequency_count = 0 OR duration_count = 0 THEN
      RAISE EXCEPTION 'Prescription confirmation rejected: missing one or more required fields (medicine, dosage, frequency, duration).';
    END IF;

    IF NEW.confirmed_at IS NULL THEN
      NEW.confirmed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_prescription_confirmation ON public.prescriptions;
CREATE TRIGGER trg_validate_prescription_confirmation
  BEFORE INSERT OR UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_prescription_confirmation();

-- Step 10: Trigger Function Security Hardening
ALTER FUNCTION public.trg_adherence_logs_fill() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.trg_validate_prescription_confirmation() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_adherence_logs_fill() FROM anon, authenticated, PUBLIC;
