-- =============================================================================
-- PulseBridge AI — Phase 4 Remediation Migration: Explicit Deny-by-Default & Hardened Immutability
-- File: supabase/migrations/20261017000001_least_privilege_grants.sql
-- Revision: Final Hardened Interim Policy (Explicit Deny-by-Default RLS & Confirmed Prescription Immutability)
--
-- PURPOSE:
-- 1. Revoke broad "GRANT ALL" and lock down DEFAULT PRIVILEGES for role postgres and invoking role.
-- 2. Drop all permissive RLS policies (USING true) from initial schema across all 9 sensitive tables.
-- 3. Deploy explicit interim deny-by-default RLS policies (USING false) for anon and authenticated.
-- 4. Set security_invoker = true on patient_summaries view to respect underlying table RLS.
-- 5. Revoke execution of get_family_view from anon and authenticated until verified caregiver identity is implemented.
-- 6. Deploy hardened prescription confirmation trigger:
--    - Covers INSERT and UPDATE
--    - Enforces strict immutability on confirmed prescriptions (prohibits unconfirming or altering fields)
--    - Rejects duplicate critical keys, null statuses, empty values, and missing keys
--    - Sets search_path = public, pg_temp
-- 7. Secure internal trigger functions with explicit search_path and revoked public execution.
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

-- Step 4: Drop All Existing Permissive RLS Policies (USING true) from Phase 3
DROP POLICY IF EXISTS "Doctors can read all patients" ON public.patients;
DROP POLICY IF EXISTS "Patients and doctors can create patient records" ON public.patients;
DROP POLICY IF EXISTS "Patients and doctors can update patient records" ON public.patients;

DROP POLICY IF EXISTS "Authorized users can read prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Authorized users can insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctors can update prescription confirmation" ON public.prescriptions;

DROP POLICY IF EXISTS "Users can read care plans" ON public.care_plans;
DROP POLICY IF EXISTS "Doctors can create and update care plans" ON public.care_plans;

DROP POLICY IF EXISTS "Read medication schedules" ON public.medication_schedules;
DROP POLICY IF EXISTS "Update medication schedules" ON public.medication_schedules;
DROP POLICY IF EXISTS "Insert medication schedules" ON public.medication_schedules;

DROP POLICY IF EXISTS "Read adherence logs" ON public.adherence_logs;
DROP POLICY IF EXISTS "Insert adherence logs" ON public.adherence_logs;

DROP POLICY IF EXISTS "Health updates access" ON public.health_updates;
DROP POLICY IF EXISTS "Care gaps access" ON public.care_gaps;
DROP POLICY IF EXISTS "Follow ups access" ON public.follow_ups;
DROP POLICY IF EXISTS "Caregiver consent access" ON public.caregiver_consent;

-- Step 5: Deploy Explicit Interim Deny-by-Default RLS Policies
-- Until Supabase Auth user identity verification is deployed, all direct client access
-- to sensitive patient data by anon and authenticated roles is denied.
CREATE POLICY "Interim deny all client access to patients"
  ON public.patients FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim deny all client access to prescriptions"
  ON public.prescriptions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim deny all client access to care_plans"
  ON public.care_plans FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim deny all client access to medication_schedules"
  ON public.medication_schedules FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim deny all client access to adherence_logs"
  ON public.adherence_logs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim deny all client access to health_updates"
  ON public.health_updates FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim deny all client access to care_gaps"
  ON public.care_gaps FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim deny all client access to caregiver_consent"
  ON public.caregiver_consent FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Interim deny all client access to follow_ups"
  ON public.follow_ups FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Step 6: View Security Invoker Setting
-- Set security_invoker = true so view queries execute with calling user permissions
-- and respect underlying table RLS policies.
ALTER VIEW public.patient_summaries SET (security_invoker = true);
REVOKE ALL ON public.patient_summaries FROM anon, authenticated, PUBLIC;

-- Step 7: Secure get_family_view RPC & Search Path Hardening
-- Revoke execution from anon, authenticated, and PUBLIC.
-- Enforce explicit search_path = public, pg_temp to prevent hijacking.
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

-- Step 8: Hardened Prescription Immutability & Clinical Validation Trigger
-- Covers INSERT and UPDATE.
-- 1. Enforces strict immutability on confirmed prescriptions (prohibits unconfirming or altering fields).
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
    IF NEW.confirmed = false THEN
      RAISE EXCEPTION 'Prescription security error: A confirmed prescription cannot be unconfirmed. To modify a treatment plan, the doctor must issue a new prescription draft.';
    END IF;

    IF NEW.fields IS DISTINCT FROM OLD.fields
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
      RAISE EXCEPTION 'Prescription security error: Confirmed prescriptions are immutable clinical records. To change medications, issue a replacement prescription draft.';
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

-- Step 9: Trigger Function Security Hardening
ALTER FUNCTION public.trg_adherence_logs_fill() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.trg_validate_prescription_confirmation() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_adherence_logs_fill() FROM anon, authenticated, PUBLIC;
