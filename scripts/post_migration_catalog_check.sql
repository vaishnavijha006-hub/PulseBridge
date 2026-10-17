-- =============================================================================
-- PulseBridge AI — Phase 4 Post-Migration Catalog & Security Verification Script
-- Run this in the Supabase SQL Editor AFTER executing the migration to verify all security controls.
-- =============================================================================

-- 1. VERIFY ROW LEVEL SECURITY (relrowsecurity) ON ALL 9 TABLES
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'patients', 'prescriptions', 'care_plans',
    'medication_schedules', 'adherence_logs',
    'health_updates', 'care_gaps', 'caregiver_consent',
    'follow_ups'
  )
ORDER BY c.relname;
-- EXPECTED: All 9 rows show rls_enabled = true.

-- 2. VERIFY RLS POLICIES (Only Restrictive Deny Policies Active, 0 Permissive Policies)
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'patients', 'prescriptions', 'care_plans',
    'medication_schedules', 'adherence_logs',
    'health_updates', 'care_gaps', 'caregiver_consent',
    'follow_ups'
  )
ORDER BY tablename;
-- EXPECTED: Exactly 9 policies, all with permissive = 'RESTRICTIVE', qual = 'false', with_check = 'false'.
-- Zero permissive 'USING (true)' policies should exist.

-- 3. VERIFY DIRECT TABLE PRIVILEGES FOR CLIENT ROLES
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
  AND table_name IN (
    'patients', 'prescriptions', 'care_plans',
    'medication_schedules', 'adherence_logs',
    'health_updates', 'care_gaps', 'caregiver_consent',
    'follow_ups', 'patient_summaries'
  );
-- EXPECTED: 0 rows (all privileges revoked from client roles).

-- 4. VERIFY VIEW SECURITY INVOKER PROPERTY
SELECT
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'patient_summaries';
-- Check view options in pg_class:
SELECT
  c.relname,
  c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'patient_summaries';
-- EXPECTED: reloptions contains 'security_invoker=true'.

-- 5. VERIFY ROUTINE EXECUTION PRIVILEGES FOR CLIENT ROLES
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
  AND routine_name IN (
    'get_family_view',
    'trg_validate_prescription_confirmation',
    'trg_adherence_logs_fill'
  );
-- EXPECTED: 0 rows (direct execution revoked).

-- 6. TRANSACTIONAL TRIGGER INTEGRITY TEST (Rolls back automatically)
DO $$
DECLARE
  v_test_patient_id text := 'audit_test_p_' || floor(random() * 100000)::text;
  v_rx_id uuid := gen_random_uuid();
  v_err_caught boolean := false;
BEGIN
  -- Insert temporary test patient & draft prescription
  INSERT INTO public.patients (id, name, age, gender, phone)
  VALUES (v_test_patient_id, 'Trigger Test Patient', 50, 'female', '9990001111');

  -- Test 6.1: Reject unconfirmed critical fields on confirmation
  BEGIN
    INSERT INTO public.prescriptions (id, patient_id, fields, confirmed)
    VALUES (
      v_rx_id,
      v_test_patient_id,
      jsonb_build_array(
        jsonb_build_object('key', 'medicine', 'value', 'Aspirin', 'status', 'confirmed'),
        jsonb_build_object('key', 'dosage', 'value', '75mg', 'status', 'uncertain'), -- Uncertain!
        jsonb_build_object('key', 'frequency', 'value', 'Daily', 'status', 'confirmed'),
        jsonb_build_object('key', 'duration', 'value', '7 days', 'status', 'confirmed')
      ),
      true
    );
    RAISE EXCEPTION 'TEST FAILED: Trigger allowed uncertain field in confirmed prescription!';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm LIKE '%Prescription confirmation rejected%' THEN
      v_err_caught := true;
    ELSE
      RAISE;
    END IF;
  END;

  -- Test 6.2: Reject duplicate critical keys
  BEGIN
    INSERT INTO public.prescriptions (id, patient_id, fields, confirmed)
    VALUES (
      v_rx_id,
      v_test_patient_id,
      jsonb_build_array(
        jsonb_build_object('key', 'medicine', 'value', 'Aspirin', 'status', 'confirmed'),
        jsonb_build_object('key', 'medicine', 'value', 'Paracetamol', 'status', 'confirmed'), -- Duplicate!
        jsonb_build_object('key', 'dosage', 'value', '75mg', 'status', 'confirmed'),
        jsonb_build_object('key', 'frequency', 'value', 'Daily', 'status', 'confirmed'),
        jsonb_build_object('key', 'duration', 'value', '7 days', 'status', 'confirmed')
      ),
      true
    );
    RAISE EXCEPTION 'TEST FAILED: Trigger allowed duplicate critical key!';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm LIKE '%duplicate critical field%' THEN
      v_err_caught := true;
    ELSE
      RAISE;
    END IF;
  END;

  -- Test 6.3: Valid confirmation succeeds
  INSERT INTO public.prescriptions (id, patient_id, fields, confirmed)
  VALUES (
    v_rx_id,
    v_test_patient_id,
    jsonb_build_array(
      jsonb_build_object('key', 'medicine', 'value', 'Aspirin', 'status', 'confirmed'),
      jsonb_build_object('key', 'dosage', 'value', '75mg', 'status', 'confirmed'),
      jsonb_build_object('key', 'frequency', 'value', 'Daily', 'status', 'confirmed'),
      jsonb_build_object('key', 'duration', 'value', '7 days', 'status', 'confirmed')
    ),
    true
  );

  -- Test 6.4: Prohibit unconfirming
  BEGIN
    UPDATE public.prescriptions SET confirmed = false WHERE id = v_rx_id;
    RAISE EXCEPTION 'TEST FAILED: Trigger allowed unconfirming confirmed prescription!';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm LIKE '%cannot be unconfirmed%' THEN
      v_err_caught := true;
    ELSE
      RAISE;
    END IF;
  END;

  -- Test 6.5: Prohibit modifying clinical fields on confirmed prescription
  BEGIN
    UPDATE public.prescriptions
    SET fields = jsonb_build_array(
      jsonb_build_object('key', 'medicine', 'value', 'Morphine', 'status', 'confirmed'),
      jsonb_build_object('key', 'dosage', 'value', '100mg', 'status', 'confirmed'),
      jsonb_build_object('key', 'frequency', 'value', 'Hourly', 'status', 'confirmed'),
      jsonb_build_object('key', 'duration', 'value', '10 days', 'status', 'confirmed')
    )
    WHERE id = v_rx_id;
    RAISE EXCEPTION 'TEST FAILED: Trigger allowed mutating clinical fields of confirmed prescription!';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm LIKE '%Confirmed prescriptions are immutable%' THEN
      v_err_caught := true;
    ELSE
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'SUCCESS: All 5 trigger immutability & validation checks passed cleanly.';

  -- Force clean rollback of test data
  RAISE EXCEPTION 'TRANSACTION_ROLLBACK_CLEANUP' USING errcode = 'P0001';
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN
    IF sqlerrm = 'TRANSACTION_ROLLBACK_CLEANUP' THEN
      RAISE NOTICE 'Transactional test completed and rolled back cleanly. No test records persisted.';
    ELSE
      RAISE;
    END IF;
END;
$$;
