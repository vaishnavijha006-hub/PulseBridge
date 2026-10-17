-- =============================================================================
-- PulseBridge AI — Phase 4 Post-Migration Catalog & Security Verification Script
-- Run this in the Supabase SQL Editor AFTER executing the migration to verify all security controls.
-- Compatible with Supabase Web SQL Editor (Standard PostgreSQL DDL/DML, No psql meta-commands).
-- =============================================================================

-- =============================================================================
-- 1. VERIFY ROW LEVEL SECURITY (relrowsecurity) ON ALL 9 TABLES
-- Confirms that PostgreSQL evaluates RLS policies for every query on these tables.
-- =============================================================================
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
-- EXPECTED OUTCOME: Exactly 9 rows returned, all with rls_enabled = true.

-- =============================================================================
-- 2. VERIFY RLS POLICIES (Only Restrictive Deny Policies Active, 0 Permissive Policies)
-- Confirms:
--   a) Only restrictive deny policies exist (permissive = 'RESTRICTIVE').
--   b) qual = 'false' and with_check = 'false' enforce complete row denial.
--   c) Policies apply explicitly to both 'anon' and 'authenticated' roles.
--   d) Zero permissive 'USING (true)' policies survive.
-- =============================================================================
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
-- EXPECTED OUTCOME: Exactly 9 policies returned.
-- tablename: each of the 9 tables.
-- permissive: 'RESTRICTIVE'.
-- roles: '{anon,authenticated}'.
-- cmd: 'ALL'.
-- qual: 'false'.
-- with_check: 'false'.

-- =============================================================================
-- 3. DISTINGUISHING MISSING TABLE GRANTS FROM RLS POLICY DENIAL
--
-- LEVEL 1: Table Grants (Privilege Layer)
-- In PostgreSQL, if role_table_grants has no row for (grantee, table_name, privilege),
-- queries fail immediately at the privilege layer with SQLSTATE 42501 ("permission denied for table ...")
-- before Row Level Security is ever evaluated.
-- =============================================================================
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
-- EXPECTED OUTCOME: 0 rows (all direct DML privileges revoked from client roles).
-- NOTE: If a future migration grants SELECT to authenticated, Level 1 will pass,
-- and Level 2 (the AS RESTRICTIVE policy from Check #2) will still independently deny access.

-- =============================================================================
-- 4. VERIFY DEFAULT PRIVILEGES (Future Object Lockdown)
-- Confirms that new tables, sequences, or functions will not automatically inherit broad grants.
-- =============================================================================
SELECT
  defaclrole::regrole AS grantor,
  defaclobjtype AS object_type,
  defaclacl AS default_access_control_list
FROM pg_default_acl
WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- EXPECTED OUTCOME: Shows revoked default privileges (no automatic grants to anon, authenticated, or PUBLIC).

-- =============================================================================
-- 5. VERIFY VIEW SECURITY INVOKER PROPERTY
-- Confirms that patient_summaries executes with caller privileges, respecting table RLS.
-- =============================================================================
SELECT
  c.relname AS view_name,
  c.reloptions AS view_options
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'patient_summaries';
-- EXPECTED OUTCOME: reloptions contains 'security_invoker=true'.

-- =============================================================================
-- 6. VERIFY ROUTINE EXECUTION PRIVILEGES FOR CLIENT ROLES
-- Confirms that get_family_view and internal triggers cannot be directly executed by client roles.
-- =============================================================================
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
-- EXPECTED OUTCOME: 0 rows (direct execution revoked from anon, authenticated, and PUBLIC).

-- =============================================================================
-- 7. TRANSACTIONAL TRIGGER INTEGRITY TEST (Runs in isolated block and rolls back)
-- Tests confirmed prescription immutability, duplicate key rejection, and uncertain field rejection.
-- =============================================================================
DO $$
DECLARE
  v_test_patient_id text := 'audit_test_p_' || floor(random() * 100000)::text;
  v_rx_id uuid := gen_random_uuid();
  v_err_caught boolean := false;
BEGIN
  -- Insert temporary test patient
  INSERT INTO public.patients (id, name, age, gender, phone)
  VALUES (v_test_patient_id, 'Trigger Test Patient', 50, 'female', '9990001111');

  -- Test 7.1: Reject unconfirmed critical fields on confirmation
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

  -- Test 7.2: Reject duplicate critical keys
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

  -- Test 7.3: Valid confirmation succeeds
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

  -- Test 7.4: Prohibit unconfirming
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

  -- Test 7.5: Prohibit modifying clinical fields on confirmed prescription
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
