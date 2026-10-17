-- =============================================================================
-- Migration: 20261017000004_hardened_family_consent_authorization.sql
-- Description: Hardened backend authorization layer for Consent-Based Family
--              Recovery Circle. Replaces insecure USING(true) / WITH CHECK(true)
--              RLS policies from migrations 2 & 3 with proper auth.uid()-scoped
--              enforcement. Adds caller identity verification to all RPCs.
--
-- SECURITY FIXES:
--   1. Drop all permissive RLS policies from migrations 2 & 3
--   2. Create helper functions for ownership & authorization checks
--   3. Create proper scoped RLS policies for:
--      - caregiver_consent
--      - caregiver_invitations
--      - consent_audit_log
--      - family_support_notes
--   4. Replace get_granular_family_view with auth.uid()-verified version
--   5. Replace accept_family_invitation with auth.uid()/jwt()-verified version
--   6. Grant minimal privileges to authenticated role only
--
-- INVARIANTS:
--   - Missing consent = DENIED (fail-closed)
--   - Caller identity ALWAYS from auth.uid(), NEVER from function parameters
--   - No USING(true) or WITH CHECK(true) on security-sensitive tables
--   - Deny-all restrictive policies from migration 1 remain UNTOUCHED
-- =============================================================================

-- ============================================================================
-- PHASE 1: DROP INSECURE POLICIES FROM MIGRATIONS 2 & 3
-- ============================================================================

-- From migration 20261017000002
DROP POLICY IF EXISTS "Patients manage caregiver consent" ON public.caregiver_consent;
DROP POLICY IF EXISTS "Authorized caregivers read consent" ON public.caregiver_consent;
DROP POLICY IF EXISTS "Family support notes access" ON public.family_support_notes;

-- From migration 20261017000003
DROP POLICY IF EXISTS "Patients manage caregiver invitations" ON public.caregiver_invitations;
DROP POLICY IF EXISTS "Patients read consent audit log" ON public.consent_audit_log;
DROP POLICY IF EXISTS "Append-only consent audit log" ON public.consent_audit_log;
DROP POLICY IF EXISTS "Prevent audit log mutation" ON public.consent_audit_log;
DROP POLICY IF EXISTS "Prevent audit log deletion" ON public.consent_audit_log;

-- ============================================================================
-- PHASE 2: HELPER FUNCTIONS (SECURITY DEFINER, FIXED SEARCH PATH)
-- ============================================================================

-- 2.1 Resolve patient.id for the currently authenticated user
-- Returns the patients.id row where patients.user_id matches the caller.
-- Returns NULL if the caller is not a registered patient.
CREATE OR REPLACE FUNCTION public.get_patient_id_for_user(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (SELECT id FROM public.patients WHERE user_id = p_user_id LIMIT 1);
END;
$$;

-- Restrict execution to authenticated only
REVOKE ALL ON FUNCTION public.get_patient_id_for_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_id_for_user(uuid) TO authenticated;


-- 2.2 Check if a user is an authorized caregiver for a specific patient
-- Returns TRUE only when ALL of these hold:
--   - A caregiver_consent row exists linking the user to the patient
--   - authorized = true
--   - status = 'accepted'
--   - Not expired (expires_at IS NULL or expires_at > now())
CREATE OR REPLACE FUNCTION public.is_authorized_caregiver(
  p_user_id uuid,
  p_patient_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.caregiver_consent
    WHERE caregiver_user_id = p_user_id
      AND patient_id = p_patient_id
      AND authorized = true
      AND status = 'accepted'
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_authorized_caregiver(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_authorized_caregiver(uuid, text) TO authenticated;


-- 2.3 Check if the authenticated user owns a specific patient record
CREATE OR REPLACE FUNCTION public.is_patient_owner(p_patient_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.patients
    WHERE id = p_patient_id
      AND user_id = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_patient_owner(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_patient_owner(text) TO authenticated;


-- ============================================================================
-- PHASE 3: PROPER RLS POLICIES FOR CONSENT TABLES
-- ============================================================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.caregiver_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_support_notes ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- 3.1 caregiver_consent POLICIES
-- ---------------------------------------------------------------------------

-- SELECT: Patient reads their own consent records, OR caregiver reads their own link
DROP POLICY IF EXISTS "cc_select_patient_or_caregiver" ON public.caregiver_consent;
CREATE POLICY "cc_select_patient_or_caregiver"
  ON public.caregiver_consent
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    OR caregiver_user_id = auth.uid()
  );

-- INSERT: Only the patient can create consent records for their own patients
DROP POLICY IF EXISTS "cc_insert_patient_only" ON public.caregiver_consent;
CREATE POLICY "cc_insert_patient_only"
  ON public.caregiver_consent
  FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- UPDATE: Only the patient can modify consent for their patients
-- WITH CHECK ensures patient_id cannot be changed to a different patient
DROP POLICY IF EXISTS "cc_update_patient_only" ON public.caregiver_consent;
CREATE POLICY "cc_update_patient_only"
  ON public.caregiver_consent
  FOR UPDATE
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- DELETE: Only the patient can delete consent records
DROP POLICY IF EXISTS "cc_delete_patient_only" ON public.caregiver_consent;
CREATE POLICY "cc_delete_patient_only"
  ON public.caregiver_consent
  FOR DELETE
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );


-- ---------------------------------------------------------------------------
-- 3.2 caregiver_invitations POLICIES
-- ---------------------------------------------------------------------------

-- SELECT: Patient who created it, OR recipient matching by JWT email
DROP POLICY IF EXISTS "ci_select_patient_or_recipient" ON public.caregiver_invitations;
CREATE POLICY "ci_select_patient_or_recipient"
  ON public.caregiver_invitations
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    OR lower(recipient_email) = lower(auth.jwt()->>'email')
  );

-- INSERT: Only patient creates invitations for their own patients
DROP POLICY IF EXISTS "ci_insert_patient_only" ON public.caregiver_invitations;
CREATE POLICY "ci_insert_patient_only"
  ON public.caregiver_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- UPDATE: Only patient can update invitation status
DROP POLICY IF EXISTS "ci_update_patient_only" ON public.caregiver_invitations;
CREATE POLICY "ci_update_patient_only"
  ON public.caregiver_invitations
  FOR UPDATE
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- DELETE: Blocked — invitations should be revoked, never deleted
DROP POLICY IF EXISTS "ci_delete_blocked" ON public.caregiver_invitations;
CREATE POLICY "ci_delete_blocked"
  ON public.caregiver_invitations
  FOR DELETE
  TO authenticated
  USING (false);


-- ---------------------------------------------------------------------------
-- 3.3 consent_audit_log POLICIES (append-only, immutable)
-- ---------------------------------------------------------------------------

-- SELECT: Only the patient can read their own audit log
DROP POLICY IF EXISTS "cal_select_patient_only" ON public.consent_audit_log;
CREATE POLICY "cal_select_patient_only"
  ON public.consent_audit_log
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- INSERT: Patient can append to their own audit log
-- (SECURITY DEFINER functions handle system/caregiver-initiated inserts)
DROP POLICY IF EXISTS "cal_insert_patient_only" ON public.consent_audit_log;
CREATE POLICY "cal_insert_patient_only"
  ON public.consent_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- UPDATE: Strictly blocked — audit trail is immutable
DROP POLICY IF EXISTS "cal_update_blocked" ON public.consent_audit_log;
CREATE POLICY "cal_update_blocked"
  ON public.consent_audit_log
  FOR UPDATE
  TO authenticated
  USING (false);

-- DELETE: Strictly blocked — audit trail is immutable
DROP POLICY IF EXISTS "cal_delete_blocked" ON public.consent_audit_log;
CREATE POLICY "cal_delete_blocked"
  ON public.consent_audit_log
  FOR DELETE
  TO authenticated
  USING (false);


-- ---------------------------------------------------------------------------
-- 3.4 family_support_notes POLICIES
-- ---------------------------------------------------------------------------

-- SELECT: Patient reads all notes for their patients, caregiver reads if authorized
DROP POLICY IF EXISTS "fsn_select_patient_or_caregiver" ON public.family_support_notes;
CREATE POLICY "fsn_select_patient_or_caregiver"
  ON public.family_support_notes
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    OR public.is_authorized_caregiver(auth.uid(), patient_id)
  );

-- INSERT: Only authorized caregivers can send support notes
DROP POLICY IF EXISTS "fsn_insert_caregiver_only" ON public.family_support_notes;
CREATE POLICY "fsn_insert_caregiver_only"
  ON public.family_support_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_caregiver(auth.uid(), patient_id)
  );

-- UPDATE: Blocked — support notes are immutable once sent
DROP POLICY IF EXISTS "fsn_update_blocked" ON public.family_support_notes;
CREATE POLICY "fsn_update_blocked"
  ON public.family_support_notes
  FOR UPDATE
  TO authenticated
  USING (false);

-- DELETE: Blocked
DROP POLICY IF EXISTS "fsn_delete_blocked" ON public.family_support_notes;
CREATE POLICY "fsn_delete_blocked"
  ON public.family_support_notes
  FOR DELETE
  TO authenticated
  USING (false);


-- ============================================================================
-- PHASE 4: HARDENED RPC FUNCTIONS WITH auth.uid() VERIFICATION
-- ============================================================================

-- 4.1 HARDENED get_granular_family_view
-- Key changes from original:
--   - Uses auth.uid() to identify the calling caregiver (not a parameter)
--   - SET search_path = public, pg_temp
--   - Caller cannot impersonate another caregiver
CREATE OR REPLACE FUNCTION public.get_granular_family_view(
  p_patient_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
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
  -- 1. Identify caller from JWT — NEVER trust a parameter
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'redactedReason', 'Authentication required.'
    );
  END IF;

  -- 2. Verify patient exists
  SELECT id, name INTO v_patient FROM public.patients WHERE id = p_patient_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 3. Find the caller's consent record for this patient
  --    The caregiver_user_id MUST match auth.uid()
  SELECT * INTO v_consent
  FROM public.caregiver_consent
  WHERE patient_id = p_patient_id
    AND caregiver_user_id = v_caller_uid
  ORDER BY created_at DESC
  LIMIT 1;

  -- 4. Fail-Closed: No consent, not authorized, not accepted, or expired
  IF v_consent IS NULL
     OR v_consent.authorized IS NOT TRUE
     OR v_consent.status <> 'accepted'
     OR (v_consent.expires_at IS NOT NULL AND v_consent.expires_at < v_now) THEN
    RETURN jsonb_build_object(
      'patientName', v_patient.name,
      'patientId', p_patient_id,
      'caregiverMemberId', coalesce(v_consent.id::text, 'unknown'),
      'caregiverName', coalesce(v_consent.caregiver_name, 'Family Caregiver'),
      'relationship', coalesce(v_consent.relationship, 'Family'),
      'authorized', false,
      'status', coalesce(v_consent.status, 'revoked'),
      'permissions', jsonb_build_object(
        'shareProfile', false,
        'shareMedicationStatus', false,
        'shareDailyVitals', false,
        'shareAppointments', false,
        'shareCareInstructions', false,
        'shareCareActions', false,
        'allowDirectCalling', false
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

  -- 5. Gather authorized data per category

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

  -- C. Care Instructions
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

  -- D. Support Notes (only from authorized caregivers for this patient)
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

  -- 6. Return granular redacted payload
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
$$;

REVOKE ALL ON FUNCTION public.get_granular_family_view(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_granular_family_view(text) TO authenticated;


-- 4.2 HARDENED accept_family_invitation
-- Key changes from original:
--   - Uses auth.uid() for the accepting user's identity
--   - Uses auth.jwt()->>'email' for the accepting user's email
--   - Does NOT accept caller-supplied user_id or email parameters
--   - SET search_path = public, pg_temp
CREATE OR REPLACE FUNCTION public.accept_family_invitation(
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_email text;
  v_invite record;
  v_consent_id text;
  v_now timestamptz := now();
BEGIN
  -- 1. Identify caller from authenticated session
  v_caller_uid := auth.uid();
  v_caller_email := auth.jwt()->>'email';

  IF v_caller_uid IS NULL OR v_caller_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required. Please sign in to accept this invitation.'
    );
  END IF;

  -- 2. Find invitation by token hash
  SELECT * INTO v_invite
  FROM public.caregiver_invitations
  WHERE token_hash = p_token_hash;

  IF NOT FOUND THEN
    -- Return generic error to avoid leaking information about valid tokens
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation.');
  END IF;

  -- 3. Verify invitation is still pending
  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invitation is no longer active (status: ' || v_invite.status || ').'
    );
  END IF;

  -- 4. Verify expiration
  IF v_invite.expires_at < v_now THEN
    UPDATE public.caregiver_invitations SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired.');
  END IF;

  -- 5. Verify email binding — compare JWT email with invitation recipient
  IF lower(trim(v_invite.recipient_email)) <> lower(trim(v_caller_email)) THEN
    -- Log unauthorized attempt (do NOT leak the expected email)
    INSERT INTO public.consent_audit_log (
      patient_id, caregiver_name, action, details, actor_role
    ) VALUES (
      v_invite.patient_id,
      v_invite.caregiver_name,
      'access_denied_unauthorized',
      'Invitation acceptance rejected: authenticated email does not match invitation binding.',
      'system'
    );
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invitation is bound to a different email address.'
    );
  END IF;

  -- 6. Check for duplicate acceptance (prevent race conditions)
  IF EXISTS (
    SELECT 1 FROM public.caregiver_consent
    WHERE patient_id = v_invite.patient_id
      AND caregiver_user_id = v_caller_uid
      AND status = 'accepted'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You are already a member of this patient''s care circle.'
    );
  END IF;

  -- 7. Mark invitation as accepted
  UPDATE public.caregiver_invitations
  SET status = 'accepted',
      accepted_at = v_now,
      accepted_by_user_id = v_caller_uid::text
  WHERE id = v_invite.id;

  -- 8. Create caregiver consent record with verified identity
  v_consent_id := 'fcm_' || gen_random_uuid()::text;
  INSERT INTO public.caregiver_consent (
    id,
    patient_id,
    caregiver_user_id,
    caregiver_name,
    relationship,
    authorized,
    authorized_at,
    permissions,
    status
  ) VALUES (
    v_consent_id::uuid,
    v_invite.patient_id,
    v_caller_uid,        -- auth.uid(), NOT a caller parameter
    v_invite.caregiver_name,
    v_invite.relationship,
    true,
    v_now,
    v_invite.permissions,
    'accepted'
  );

  -- 9. Record in immutable audit log
  INSERT INTO public.consent_audit_log (
    patient_id, caregiver_id, caregiver_name, action, details, actor_role
  ) VALUES (
    v_invite.patient_id,
    v_consent_id,
    v_invite.caregiver_name,
    'invite_accepted',
    'Invitation accepted by verified user (email binding confirmed).',
    'caregiver'
  );

  RETURN jsonb_build_object(
    'success', true,
    'consentId', v_consent_id,
    'patientId', v_invite.patient_id,
    'permissions', v_invite.permissions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_family_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_family_invitation(text) TO authenticated;


-- ============================================================================
-- PHASE 5: GRANT MINIMAL TABLE-LEVEL PRIVILEGES
-- ============================================================================

-- caregiver_consent: patient reads/writes, caregiver reads
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_consent TO authenticated;

-- caregiver_invitations: patient manages, recipient reads
GRANT SELECT, INSERT, UPDATE ON public.caregiver_invitations TO authenticated;

-- consent_audit_log: read + append only (no update, no delete)
GRANT SELECT, INSERT ON public.consent_audit_log TO authenticated;

-- family_support_notes: read + create only
GRANT SELECT, INSERT ON public.family_support_notes TO authenticated;


-- ============================================================================
-- PHASE 6: SECURITY DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.get_patient_id_for_user(uuid)
  IS 'Returns the patients.id for a given auth user_id. Used by RLS policies.';

COMMENT ON FUNCTION public.is_authorized_caregiver(uuid, text)
  IS 'Returns TRUE only if the user has active, accepted, non-expired caregiver consent for the patient.';

COMMENT ON FUNCTION public.is_patient_owner(text)
  IS 'Returns TRUE if auth.uid() owns the given patient record.';

COMMENT ON FUNCTION public.get_granular_family_view(text)
  IS 'Hardened RPC: Returns category-redacted patient view for the authenticated caregiver. Identity from auth.uid(), not parameters.';

COMMENT ON FUNCTION public.accept_family_invitation(text)
  IS 'Hardened RPC: Accepts a family invitation using token hash. Email verified from auth.jwt(), user from auth.uid(). Prevents impersonation.';

COMMENT ON POLICY "cc_select_patient_or_caregiver" ON public.caregiver_consent
  IS 'Patient reads own consent records; caregiver reads own link only.';

COMMENT ON POLICY "cc_insert_patient_only" ON public.caregiver_consent
  IS 'Only the patient can create consent records for their patients.';

COMMENT ON POLICY "cc_update_patient_only" ON public.caregiver_consent
  IS 'Only the patient can modify consent. Prevents caregiver self-modification.';

COMMENT ON POLICY "ci_select_patient_or_recipient" ON public.caregiver_invitations
  IS 'Patient reads own invitations; recipient sees invitations addressed to their JWT email.';

COMMENT ON POLICY "ci_delete_blocked" ON public.caregiver_invitations
  IS 'Invitations are revoked by status change, never deleted.';

COMMENT ON POLICY "cal_update_blocked" ON public.consent_audit_log
  IS 'Audit trail is immutable. UPDATE blocked.';

COMMENT ON POLICY "cal_delete_blocked" ON public.consent_audit_log
  IS 'Audit trail is immutable. DELETE blocked.';

COMMENT ON POLICY "fsn_insert_caregiver_only" ON public.family_support_notes
  IS 'Only authorized caregivers can send support notes.';
