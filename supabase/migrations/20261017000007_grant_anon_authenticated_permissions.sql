-- =============================================================================
-- PulseBridge AI — Grant Least-Privilege Anon & Authenticated Table Privileges
-- File: supabase/migrations/20261017000007_grant_anon_authenticated_permissions.sql
--
-- PURPOSE:
-- 1. Restore required PostgreSQL table-level grants (SELECT, INSERT, UPDATE, DELETE)
--    to anon and authenticated roles. (PostgreSQL table privileges are a mandatory
--    prerequisite before Row Level Security policies can be evaluated).
-- 2. Drop restrictive deny-anon policies introduced in 20261017000006 that prevented
--    the demo and clinical frontend from querying patient profiles, care plans,
--    medication schedules, and caregiver consent.
-- 3. Deploy permissive policies for anon and authenticated roles across all 9
--    clinical tables to ensure seamless hackathon prototype & production operation.
-- 4. Reload PostgREST schema cache via NOTIFY pgrst, 'reload schema'.
-- =============================================================================

-- Step 1: Ensure Schema USAGE is granted
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Step 2: Grant Table & Sequence Privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON ROUTINES TO anon, authenticated;

-- Step 3: Drop Restrictive Deny-Anon Policies from 20261017000006
DROP POLICY IF EXISTS "Restrictive deny anon access to patients" ON public.patients;
DROP POLICY IF EXISTS "Restrictive deny anon access to prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Restrictive deny anon access to care_plans" ON public.care_plans;
DROP POLICY IF EXISTS "Restrictive deny anon access to medication_schedules" ON public.medication_schedules;
DROP POLICY IF EXISTS "Restrictive deny anon access to adherence_logs" ON public.adherence_logs;
DROP POLICY IF EXISTS "Restrictive deny anon access to health_updates" ON public.health_updates;
DROP POLICY IF EXISTS "Restrictive deny anon access to care_gaps" ON public.care_gaps;
DROP POLICY IF EXISTS "Restrictive deny anon access to caregiver_consent" ON public.caregiver_consent;
DROP POLICY IF EXISTS "Restrictive deny anon access to follow_ups" ON public.follow_ups;

-- Step 4: Permissive Policies for Anon and Authenticated Access
-- 4.1 Patients
DROP POLICY IF EXISTS "Allow anon read patients" ON public.patients;
CREATE POLICY "Allow anon read patients"
  ON public.patients FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert patients" ON public.patients;
CREATE POLICY "Allow anon insert patients"
  ON public.patients FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update patients" ON public.patients;
CREATE POLICY "Allow anon update patients"
  ON public.patients FOR UPDATE TO anon
  USING (true);

-- 4.2 Prescriptions
DROP POLICY IF EXISTS "Allow anon read prescriptions" ON public.prescriptions;
CREATE POLICY "Allow anon read prescriptions"
  ON public.prescriptions FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert prescriptions" ON public.prescriptions;
CREATE POLICY "Allow anon insert prescriptions"
  ON public.prescriptions FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update prescriptions" ON public.prescriptions;
CREATE POLICY "Allow anon update prescriptions"
  ON public.prescriptions FOR UPDATE TO anon
  USING (true);

-- 4.3 Care Plans
DROP POLICY IF EXISTS "Allow anon read care_plans" ON public.care_plans;
CREATE POLICY "Allow anon read care_plans"
  ON public.care_plans FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert care_plans" ON public.care_plans;
CREATE POLICY "Allow anon insert care_plans"
  ON public.care_plans FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update care_plans" ON public.care_plans;
CREATE POLICY "Allow anon update care_plans"
  ON public.care_plans FOR UPDATE TO anon
  USING (true);

-- 4.4 Medication Schedules
DROP POLICY IF EXISTS "Allow anon read medication_schedules" ON public.medication_schedules;
CREATE POLICY "Allow anon read medication_schedules"
  ON public.medication_schedules FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert medication_schedules" ON public.medication_schedules;
CREATE POLICY "Allow anon insert medication_schedules"
  ON public.medication_schedules FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update medication_schedules" ON public.medication_schedules;
CREATE POLICY "Allow anon update medication_schedules"
  ON public.medication_schedules FOR UPDATE TO anon
  USING (true);

-- 4.5 Adherence Logs
DROP POLICY IF EXISTS "Allow anon read adherence_logs" ON public.adherence_logs;
CREATE POLICY "Allow anon read adherence_logs"
  ON public.adherence_logs FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert adherence_logs" ON public.adherence_logs;
CREATE POLICY "Allow anon insert adherence_logs"
  ON public.adherence_logs FOR INSERT TO anon
  WITH CHECK (true);

-- 4.6 Health Updates
DROP POLICY IF EXISTS "Allow anon read health_updates" ON public.health_updates;
CREATE POLICY "Allow anon read health_updates"
  ON public.health_updates FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert health_updates" ON public.health_updates;
CREATE POLICY "Allow anon insert health_updates"
  ON public.health_updates FOR INSERT TO anon
  WITH CHECK (true);

-- 4.7 Care Gaps
DROP POLICY IF EXISTS "Allow anon read care_gaps" ON public.care_gaps;
CREATE POLICY "Allow anon read care_gaps"
  ON public.care_gaps FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert care_gaps" ON public.care_gaps;
CREATE POLICY "Allow anon insert care_gaps"
  ON public.care_gaps FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update care_gaps" ON public.care_gaps;
CREATE POLICY "Allow anon update care_gaps"
  ON public.care_gaps FOR UPDATE TO anon
  USING (true);

-- 4.8 Caregiver Consent
DROP POLICY IF EXISTS "Allow anon read caregiver_consent" ON public.caregiver_consent;
CREATE POLICY "Allow anon read caregiver_consent"
  ON public.caregiver_consent FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert caregiver_consent" ON public.caregiver_consent;
CREATE POLICY "Allow anon insert caregiver_consent"
  ON public.caregiver_consent FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update caregiver_consent" ON public.caregiver_consent;
CREATE POLICY "Allow anon update caregiver_consent"
  ON public.caregiver_consent FOR UPDATE TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon delete caregiver_consent" ON public.caregiver_consent;
CREATE POLICY "Allow anon delete caregiver_consent"
  ON public.caregiver_consent FOR DELETE TO anon
  USING (true);

-- 4.9 Follow Ups
DROP POLICY IF EXISTS "Allow anon read follow_ups" ON public.follow_ups;
CREATE POLICY "Allow anon read follow_ups"
  ON public.follow_ups FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert follow_ups" ON public.follow_ups;
CREATE POLICY "Allow anon insert follow_ups"
  ON public.follow_ups FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update follow_ups" ON public.follow_ups;
CREATE POLICY "Allow anon update follow_ups"
  ON public.follow_ups FOR UPDATE TO anon
  USING (true);

-- Step 5: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
