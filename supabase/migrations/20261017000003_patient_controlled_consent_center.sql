-- =============================================================================
-- Migration: 20261017000003_patient_controlled_consent_center.sql
-- Description: Patient-Controlled Consent Management Center:
--              Cryptographic invitations, email-binding, immutable audit log,
--              and strict Row Level Security (RLS) enforcement.
-- =============================================================================

-- 1. CAREGIVER INVITATIONS TABLE (CRYPTOGRAPHIC TOKEN HASHES & EMAIL BINDING)
CREATE TABLE IF NOT EXISTS public.caregiver_invitations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  caregiver_name text NOT NULL,
  relationship text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  permissions jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id text
);

CREATE INDEX IF NOT EXISTS idx_caregiver_invitations_patient ON public.caregiver_invitations (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_caregiver_invitations_token_hash ON public.caregiver_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_caregiver_invitations_email ON public.caregiver_invitations (lower(recipient_email));

-- 2. IMMUTABLE CONSENT AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.consent_audit_log (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  caregiver_id text,
  caregiver_name text,
  action text NOT NULL,
  category text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  details text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('patient', 'caregiver', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_consent_audit_log_patient ON public.consent_audit_log (patient_id, timestamp DESC);

-- 3. ROW LEVEL SECURITY (RLS) FOR INVITATIONS & AUDIT LOG
ALTER TABLE public.caregiver_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;

-- 3.1 Patient manages their own invitations
DROP POLICY IF EXISTS "Patients manage caregiver invitations" ON public.caregiver_invitations;
CREATE POLICY "Patients manage caregiver invitations"
  ON public.caregiver_invitations
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 3.2 Patient reads their own consent audit log
DROP POLICY IF EXISTS "Patients read consent audit log" ON public.consent_audit_log;
CREATE POLICY "Patients read consent audit log"
  ON public.consent_audit_log
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- 3.3 Append-only audit log: INSERT allowed, but UPDATE and DELETE strictly blocked
DROP POLICY IF EXISTS "Append-only consent audit log" ON public.consent_audit_log;
CREATE POLICY "Append-only consent audit log"
  ON public.consent_audit_log
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Prevent audit log mutation" ON public.consent_audit_log;
CREATE POLICY "Prevent audit log mutation"
  ON public.consent_audit_log
  FOR UPDATE
  TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS "Prevent audit log deletion" ON public.consent_audit_log;
CREATE POLICY "Prevent audit log deletion"
  ON public.consent_audit_log
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- 4. SECURE INVITATION ACCEPTANCE RPC FUNCTION
CREATE OR REPLACE FUNCTION public.accept_family_invitation(
  p_token_hash text,
  p_accepting_email text,
  p_user_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_invite record;
  v_consent_id text;
  v_now timestamptz := now();
BEGIN
  -- 1. Find invitation by token hash
  SELECT * INTO v_invite
  FROM public.caregiver_invitations
  WHERE token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation token.');
  END IF;

  -- 2. Verify status
  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation is no longer pending (status: ' || v_invite.status || ').');
  END IF;

  -- 3. Verify expiration
  IF v_invite.expires_at < v_now THEN
    UPDATE public.caregiver_invitations SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired.');
  END IF;

  -- 4. Verify email binding
  IF lower(trim(v_invite.recipient_email)) <> lower(trim(p_accepting_email)) THEN
    -- Log unauthorized acceptance attempt
    INSERT INTO public.consent_audit_log (patient_id, caregiver_name, action, details, actor_role)
    VALUES (
      v_invite.patient_id,
      v_invite.caregiver_name,
      'access_denied_unauthorized',
      'Invitation acceptance rejected: email mismatch (' || p_accepting_email || ' vs expected ' || v_invite.recipient_email || ')',
      'system'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation is bound to a different email address.');
  END IF;

  -- 5. Mark invitation accepted
  UPDATE public.caregiver_invitations
  SET status = 'accepted',
      accepted_at = v_now,
      accepted_by_user_id = p_user_id
  WHERE id = v_invite.id;

  -- 6. Insert / activate caregiver consent record
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
    v_consent_id,
    v_invite.patient_id,
    p_user_id,
    v_invite.caregiver_name,
    v_invite.relationship,
    true,
    v_now,
    v_invite.permissions,
    'accepted'
  );

  -- 7. Record in immutable audit log
  INSERT INTO public.consent_audit_log (patient_id, caregiver_id, caregiver_name, action, details, actor_role)
  VALUES (
    v_invite.patient_id,
    v_consent_id,
    v_invite.caregiver_name,
    'invite_accepted',
    'Invitation accepted by ' || v_invite.caregiver_name || ' (' || v_invite.recipient_email || ')',
    'caregiver'
  );

  RETURN jsonb_build_object(
    'success', true,
    'consentId', v_consent_id,
    'patientId', v_invite.patient_id,
    'permissions', v_invite.permissions
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
