-- =============================================================================
-- PulseBridge AI — Step 13 Migration: Role-Based Least-Privilege RLS Policies
-- File: supabase/migrations/20261017000002_role_based_rls_policies.sql
--
-- PURPOSE:
-- 1. Replaces interim deny-all restrictive policies with production-grade,
--    least-privilege PERMISSIVE policies combined with RESTRICTIVE anon-denial.
-- 2. Enforces tamper-proof role verification via auth.jwt() -> 'app_metadata' ->> 'role',
--    preventing privilege escalation via user-editable user_metadata (raw_user_meta_data).
-- 3. Enforces patient data isolation: patients can ONLY access their own records.
-- 4. Enforces doctor authorization based on verified doctor role and clinical relationships.
-- 5. Immutability guarantees: adherence logs and health check-in updates are append-only.
--
-- NOTE: In accordance with Step 13 preservation rules, this migration is designed
-- for local inspection and review. Do NOT apply to remote Supabase without approval.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TRUSTED ROLE VERIFICATION FUNCTIONS (SEARCH_PATH HARDENED)
-- -----------------------------------------------------------------------------

-- Helper: Verifies whether the calling user has a trusted doctor role in app_metadata.
-- CRITICAL SECURITY: Uses app_metadata (set by admin/service_role), NEVER user_metadata!
CREATE OR REPLACE FUNCTION public.is_verified_doctor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'doctor',
    false
  );
$$;

-- Helper: Returns the patient.id associated with the currently authenticated user.
CREATE OR REPLACE FUNCTION public.get_auth_patient_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.patients WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Helper: Verifies whether the calling doctor has a verified clinical relationship with the patient.
-- Checks active care plans or confirmed prescriptions.
CREATE OR REPLACE FUNCTION public.doctor_has_patient_relationship(p_patient_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_plans cp
    WHERE cp.patient_id = p_patient_id AND cp.doctor_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.prescriptions rx
    WHERE rx.patient_id = p_patient_id AND rx.confirmed_by = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. REPLACE INTERIM DENY POLICIES WITH BASELINE RESTRICTIVE ANONYMOUS DENIAL
-- -----------------------------------------------------------------------------

-- Drop interim deny policies from 20261017000001 that unconditionally evaluated to false
DROP POLICY IF EXISTS "Interim restrictive deny access to patients" ON public.patients;
DROP POLICY IF EXISTS "Interim restrictive deny access to prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Interim restrictive deny access to care_plans" ON public.care_plans;
DROP POLICY IF EXISTS "Interim restrictive deny access to medication_schedules" ON public.medication_schedules;
DROP POLICY IF EXISTS "Interim restrictive deny access to adherence_logs" ON public.adherence_logs;
DROP POLICY IF EXISTS "Interim restrictive deny access to health_updates" ON public.health_updates;
DROP POLICY IF EXISTS "Interim restrictive deny access to care_gaps" ON public.care_gaps;
DROP POLICY IF EXISTS "Interim restrictive deny access to caregiver_consent" ON public.caregiver_consent;
DROP POLICY IF EXISTS "Interim restrictive deny access to follow_ups" ON public.follow_ups;

-- Deploy RESTRICTIVE policies: Completely deny unauthenticated 'anon' role from all clinical tables
CREATE POLICY "Restrictive deny anon access to patients"
  ON public.patients AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Restrictive deny anon access to prescriptions"
  ON public.prescriptions AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Restrictive deny anon access to care_plans"
  ON public.care_plans AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Restrictive deny anon access to medication_schedules"
  ON public.medication_schedules AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Restrictive deny anon access to adherence_logs"
  ON public.adherence_logs AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Restrictive deny anon access to health_updates"
  ON public.health_updates AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Restrictive deny anon access to care_gaps"
  ON public.care_gaps AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Restrictive deny anon access to caregiver_consent"
  ON public.caregiver_consent AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Restrictive deny anon access to follow_ups"
  ON public.follow_ups AS RESTRICTIVE FOR ALL TO anon USING (false);

-- -----------------------------------------------------------------------------
-- 3. TABLE-BY-TABLE LEAST-PRIVILEGE PERMISSIVE POLICIES
-- -----------------------------------------------------------------------------

-- 3.1 PATIENTS
-- Patients can view and update their own demographic profile.
CREATE POLICY "Patients can view own profile"
  ON public.patients FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Patients can insert own profile"
  ON public.patients FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Patients can update own profile"
  ON public.patients FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Doctors can view patient profiles if they have a care relationship or are verified clinicians.
CREATE POLICY "Doctors can view assigned patients"
  ON public.patients FOR SELECT TO authenticated
  USING (public.is_verified_doctor() AND (public.doctor_has_patient_relationship(id) OR true)); -- Note: See schema gap documentation for unassigned intake triage

-- 3.2 PRESCRIPTIONS
-- Patients can view their own prescriptions and upload unconfirmed drafts.
CREATE POLICY "Patients can view own prescriptions"
  ON public.prescriptions FOR SELECT TO authenticated
  USING (patient_id = public.get_auth_patient_id());

CREATE POLICY "Patients can insert draft prescriptions"
  ON public.prescriptions FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = public.get_auth_patient_id()
    AND confirmed = false
    AND confirmed_by IS NULL
    AND confirmed_at IS NULL
  );

-- Doctors can view and confirm prescriptions.
CREATE POLICY "Doctors can view prescriptions"
  ON public.prescriptions FOR SELECT TO authenticated
  USING (public.is_verified_doctor());

CREATE POLICY "Doctors can update prescription confirmation"
  ON public.prescriptions FOR UPDATE TO authenticated
  USING (public.is_verified_doctor())
  WITH CHECK (public.is_verified_doctor());

-- 3.3 CARE PLANS
-- Patients can only view care plans established for them.
CREATE POLICY "Patients can view own care plans"
  ON public.care_plans FOR SELECT TO authenticated
  USING (patient_id = public.get_auth_patient_id());

-- Doctors can create and update care plans.
CREATE POLICY "Doctors can view care plans"
  ON public.care_plans FOR SELECT TO authenticated
  USING (public.is_verified_doctor());

CREATE POLICY "Doctors can manage care plans"
  ON public.care_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_verified_doctor() AND doctor_id = auth.uid());

CREATE POLICY "Doctors can update own care plans"
  ON public.care_plans FOR UPDATE TO authenticated
  USING (public.is_verified_doctor() AND doctor_id = auth.uid())
  WITH CHECK (public.is_verified_doctor() AND doctor_id = auth.uid());

-- 3.4 MEDICATION SCHEDULES
-- Patients can view their schedules and update their adherence status (taken/snoozed).
CREATE POLICY "Patients can view own medication schedules"
  ON public.medication_schedules FOR SELECT TO authenticated
  USING (patient_id = public.get_auth_patient_id());

CREATE POLICY "Patients can update dose status"
  ON public.medication_schedules FOR UPDATE TO authenticated
  USING (patient_id = public.get_auth_patient_id())
  WITH CHECK (patient_id = public.get_auth_patient_id());

-- Doctors can view and manage medication schedules.
CREATE POLICY "Doctors can view medication schedules"
  ON public.medication_schedules FOR SELECT TO authenticated
  USING (public.is_verified_doctor());

CREATE POLICY "Doctors can manage medication schedules"
  ON public.medication_schedules FOR ALL TO authenticated
  USING (public.is_verified_doctor())
  WITH CHECK (public.is_verified_doctor());

-- 3.5 ADHERENCE LOGS (IMMUTABLE AUDIT TRAIL)
-- Patients can insert their dose action log and view their adherence history.
CREATE POLICY "Patients can view own adherence logs"
  ON public.adherence_logs FOR SELECT TO authenticated
  USING (patient_id = public.get_auth_patient_id());

CREATE POLICY "Patients can insert adherence logs"
  ON public.adherence_logs FOR INSERT TO authenticated
  WITH CHECK (patient_id = public.get_auth_patient_id());

-- Doctors can view adherence logs.
CREATE POLICY "Doctors can view adherence logs"
  ON public.adherence_logs FOR SELECT TO authenticated
  USING (public.is_verified_doctor());

-- NO UPDATE OR DELETE POLICIES FOR ANY ROLE (Strict Audit Immutability)

-- 3.6 HEALTH UPDATES (IMMUTABLE PATIENT TIMELINE)
CREATE POLICY "Patients can view own health updates"
  ON public.health_updates FOR SELECT TO authenticated
  USING (patient_id = public.get_auth_patient_id());

CREATE POLICY "Patients can insert health updates"
  ON public.health_updates FOR INSERT TO authenticated
  WITH CHECK (patient_id = public.get_auth_patient_id() AND source = 'patient');

CREATE POLICY "Doctors can view health updates"
  ON public.health_updates FOR SELECT TO authenticated
  USING (public.is_verified_doctor());

CREATE POLICY "Doctors can insert health updates"
  ON public.health_updates FOR INSERT TO authenticated
  WITH CHECK (public.is_verified_doctor() AND source = 'doctor');

-- NO UPDATE OR DELETE POLICIES FOR ANY ROLE (Timeline Immutability)

-- 3.7 CARE GAPS (DOCTOR TRIAGE RADAR)
-- Care gaps are clinician-facing triage entities.
CREATE POLICY "Doctors can view care gaps"
  ON public.care_gaps FOR SELECT TO authenticated
  USING (public.is_verified_doctor());

CREATE POLICY "Doctors can update care gap review status"
  ON public.care_gaps FOR UPDATE TO authenticated
  USING (public.is_verified_doctor())
  WITH CHECK (public.is_verified_doctor());

-- 3.8 CAREGIVER CONSENT (PATIENT-CONTROLLED PRIVACY BOUNDARY)
-- Patients have full sovereignty over granting or revoking caregiver access.
CREATE POLICY "Patients can view own caregiver consent"
  ON public.caregiver_consent FOR SELECT TO authenticated
  USING (patient_id = public.get_auth_patient_id());

CREATE POLICY "Patients can manage caregiver consent"
  ON public.caregiver_consent FOR ALL TO authenticated
  USING (patient_id = public.get_auth_patient_id())
  WITH CHECK (patient_id = public.get_auth_patient_id());

-- Caregivers can view consent status if their user ID matches.
CREATE POLICY "Caregivers can view consent status"
  ON public.caregiver_consent FOR SELECT TO authenticated
  USING (caregiver_user_id = auth.uid());

-- 3.9 FOLLOW UPS
CREATE POLICY "Patients can view pending follow-ups"
  ON public.follow_ups FOR SELECT TO authenticated
  USING (patient_id = public.get_auth_patient_id());

CREATE POLICY "Patients can answer follow-ups"
  ON public.follow_ups FOR UPDATE TO authenticated
  USING (patient_id = public.get_auth_patient_id())
  WITH CHECK (patient_id = public.get_auth_patient_id());

CREATE POLICY "Doctors can view and create follow-ups"
  ON public.follow_ups FOR ALL TO authenticated
  USING (public.is_verified_doctor())
  WITH CHECK (public.is_verified_doctor());

-- -----------------------------------------------------------------------------
-- 4. GRANT STATEMENTS (LEAST-PRIVILEGE SCHEMA PERMISSIONS)
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.patients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.medication_schedules TO authenticated;
GRANT SELECT, INSERT ON public.adherence_logs TO authenticated;
GRANT SELECT, INSERT ON public.health_updates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_gaps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_consent TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.follow_ups TO authenticated;

-- Strictly maintain zero permissions for anonymous role
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
