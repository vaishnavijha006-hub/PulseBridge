-- =============================================================================
-- PulseBridge AI — Phase 4 Remediation Migration: Least-Privilege Grants & Doctor Gates
-- Migration: 20261017000001_least_privilege_grants.sql
--
-- PURPOSE:
-- 1. Remediation of overbroad "GRANT ALL" executed earlier.
-- 2. Restrict anon & authenticated roles to strictly needed DML operations.
-- 3. Enforce immutability on clinical audit tables (adherence_logs, health_updates)
--    by prohibiting UPDATE, DELETE, and TRUNCATE for client roles.
-- 4. Deploy server-side doctor confirmation trigger (trg_validate_prescription_confirmation)
--    to prevent unauthorized or premature care plan confirmation directly in Postgres.
-- =============================================================================

-- Step 1: Revoke broad permissions from client roles
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

-- Step 2: Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Step 3: Grant least-privilege DML on operational tables
-- Mutable operational tables allow SELECT, INSERT, UPDATE, DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_schedules TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_gaps TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_consent TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO anon, authenticated;

-- Step 4: Grant immutable append/read-only on clinical audit logs
-- adherence_logs and health_updates CANNOT be updated or deleted by clients.
GRANT SELECT, INSERT ON public.adherence_logs TO anon, authenticated;
GRANT SELECT, INSERT ON public.health_updates TO anon, authenticated;

-- Step 5: Grant read access on analytics/triage views
GRANT SELECT ON public.patient_summaries TO anon, authenticated;

-- Step 6: Grant sequence usage for auto-incrementing / serial fields
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Step 7: Database-Level Doctor Gate Trigger
-- Validates that critical prescription fields (medicine, dosage, frequency, duration)
-- are verified and non-empty prior to setting confirmed = true.
CREATE OR REPLACE FUNCTION public.trg_validate_prescription_confirmation()
RETURNS trigger AS $$
DECLARE
  f jsonb;
  k text;
  v text;
  s text;
  critical_keys text[] := ARRAY['medicine', 'dosage', 'frequency', 'duration'];
BEGIN
  -- Only validate when updating confirmed to true
  IF NEW.confirmed = true AND (OLD.confirmed IS NULL OR OLD.confirmed = false) THEN
    IF NEW.fields IS NULL OR jsonb_array_length(NEW.fields) = 0 THEN
      RAISE EXCEPTION 'Cannot confirm care plan: Prescription fields cannot be empty.';
    END IF;

    FOR f IN SELECT * FROM jsonb_array_elements(NEW.fields)
    LOOP
      k := f->>'key';
      v := trim(coalesce(f->>'value', ''));
      s := coalesce(f->>'status', 'uncertain');

      IF k = ANY(critical_keys) THEN
        IF v = '' OR s = 'uncertain' THEN
          RAISE EXCEPTION 'Cannot confirm care plan: Critical field "%" must be verified and non-empty.', k;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_prescription_confirmation ON public.prescriptions;
CREATE TRIGGER trg_validate_prescription_confirmation
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_prescription_confirmation();

-- Step 8: Grant EXECUTE on required stored procedures and triggers
GRANT EXECUTE ON FUNCTION public.get_family_view(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_adherence_logs_fill() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_validate_prescription_confirmation() TO anon, authenticated;
