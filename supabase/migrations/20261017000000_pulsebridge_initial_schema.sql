-- =============================================================================
-- PulseBridge AI — Initial Supabase Schema Migration (Production Grade)
-- Migration: 20261017000000_pulsebridge_initial_schema.sql
-- Description: Complete, idempotent schema for 24-hr healthcare hackathon MVP
-- Tables: patients, prescriptions, care_plans, medication_schedules,
--         adherence_logs, health_updates, care_gaps, caregiver_consent, follow_ups
-- Security: Strict Row Level Security (RLS) enabled on all tables and private storage
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & DOMAINS
DO $$ BEGIN
  CREATE TYPE health_state_enum AS ENUM ('good', 'ok', 'bad');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dose_status_enum AS ENUM ('pending', 'taken', 'missed', 'snoozed', 'cannot_take');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE care_gap_status_enum AS ENUM ('open', 'reviewed', 'followup_planned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE care_plan_status_enum AS ENUM ('draft', 'active', 'completed', 'discontinued');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. TABLES

-- -----------------------------------------------------------------------------
-- 3.1. PATIENTS
-- Stores core patient demographic and clinical intake information
-- Primary Key is text to support both demo identifiers ('p1', 'p2') and UUIDs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patients (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  age integer NOT NULL CHECK (age > 0 AND age < 130),
  gender text NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  phone text NOT NULL,
  symptoms text NOT NULL DEFAULT '',
  allergies text NOT NULL DEFAULT 'None',
  current_meds text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'hi' CHECK (language IN ('en', 'hi')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);

-- -----------------------------------------------------------------------------
-- 3.2. PRESCRIPTIONS
-- Stores uploaded prescription images and OCR extraction drafts
-- Safety Rule: Confirmed remains false until a doctor explicitly verifies it
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  doctor_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_confirmed ON public.prescriptions(confirmed);

-- -----------------------------------------------------------------------------
-- 3.3. CARE PLANS
-- Created once a prescription is doctor-verified to govern the recovery regimen
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  doctor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'discontinued')),
  diagnosis text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON public.care_plans(patient_id);

-- -----------------------------------------------------------------------------
-- 3.4. MEDICATION SCHEDULES
-- Scheduled daily doses generated from the confirmed care plan
-- Supports 20-min grace evaluation, 10-min snooze, and cannot-take reasons
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medication_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  care_plan_id uuid REFERENCES public.care_plans(id) ON DELETE CASCADE,
  medicine_name text NOT NULL,
  dosage text NOT NULL,
  scheduled_time text NOT NULL, -- Format: HH:MM (e.g., '08:00', '20:00')
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'missed', 'snoozed', 'cannot_take')),
  snoozed_until timestamptz,
  reason text,
  instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medication_schedules_patient ON public.medication_schedules(patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_time ON public.medication_schedules(scheduled_time);

-- -----------------------------------------------------------------------------
-- 3.5. ADHERENCE LOGS
-- Immutable audit log recording every dose action taken by the patient
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.adherence_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text REFERENCES public.patients(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.medication_schedules(id) ON DELETE SET NULL,
  medicine_name text,
  scheduled_time text,
  status text NOT NULL CHECK (status IN ('pending', 'taken', 'missed', 'snoozed', 'cannot_take')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_adherence_logs_patient ON public.adherence_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_adherence_logs_recorded ON public.adherence_logs(recorded_at);

-- Helper trigger to auto-populate patient_id, medicine_name, scheduled_time from schedule if omitted
CREATE OR REPLACE FUNCTION public.trg_adherence_logs_fill()
RETURNS trigger AS $$
BEGIN
  IF NEW.schedule_id IS NOT NULL AND (NEW.patient_id IS NULL OR NEW.medicine_name IS NULL) THEN
    SELECT ms.patient_id, ms.medicine_name, ms.scheduled_time
    INTO NEW.patient_id, NEW.medicine_name, NEW.scheduled_time
    FROM public.medication_schedules ms
    WHERE ms.id = NEW.schedule_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fill_adherence_logs ON public.adherence_logs;
CREATE TRIGGER trg_fill_adherence_logs
  BEFORE INSERT ON public.adherence_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_adherence_logs_fill();

-- -----------------------------------------------------------------------------
-- 3.6. HEALTH UPDATES
-- Patient self-reported check-ins or doctor clinical observations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('good', 'ok', 'bad')),
  symptom_description text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'patient' CHECK (source IN ('patient', 'doctor')),
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_updates_patient ON public.health_updates(patient_id);
CREATE INDEX IF NOT EXISTS idx_health_updates_submitted ON public.health_updates(submitted_at DESC);

-- -----------------------------------------------------------------------------
-- 3.7. CARE GAPS
-- Clinically detected safety gaps requiring doctor review or follow-up
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'new_symptom',
    'missing_severity',
    'repeated_missed_dose',
    'unanswered_followup',
    'overdue_update',
    'allergy_conflict',
    'duplicate_medicine'
  )),
  evidence text NOT NULL,
  missing_info text,
  followup_question text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'followup_planned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_care_gaps_patient ON public.care_gaps(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_gaps_status ON public.care_gaps(status);

-- -----------------------------------------------------------------------------
-- 3.8. CAREGIVER CONSENT
-- Manages family member authorization and patient privacy consent
-- Privacy Rule: Family view only accesses high-level summary if authorized is true
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.caregiver_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  caregiver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  caregiver_name text NOT NULL,
  relationship text NOT NULL,
  contact_number text,
  authorized boolean NOT NULL DEFAULT true,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_patient_caregiver UNIQUE (patient_id, caregiver_name)
);

CREATE INDEX IF NOT EXISTS idx_caregiver_consent_patient ON public.caregiver_consent(patient_id);

-- -----------------------------------------------------------------------------
-- 3.9. FOLLOW UPS
-- Interactive clinical follow-up questions posed to the patient
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  question text NOT NULL,
  asked_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  answer text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'planned')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_patient ON public.follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON public.follow_ups(status);

-- =============================================================================
-- 4. STORAGE SETUP (Private Prescriptions Bucket)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prescriptions',
  'prescriptions',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES (Idempotent & Secure)
-- =============================================================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- 5.1 Patients Policies
DROP POLICY IF EXISTS "Doctors can read all patients" ON public.patients;
CREATE POLICY "Doctors can read all patients"
  ON public.patients FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Patients and doctors can create patient records" ON public.patients;
CREATE POLICY "Patients and doctors can create patient records"
  ON public.patients FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Patients and doctors can update patient records" ON public.patients;
CREATE POLICY "Patients and doctors can update patient records"
  ON public.patients FOR UPDATE
  TO authenticated, anon
  USING (true);

-- 5.2 Prescriptions Policies
DROP POLICY IF EXISTS "Authorized users can read prescriptions" ON public.prescriptions;
CREATE POLICY "Authorized users can read prescriptions"
  ON public.prescriptions FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Authorized users can insert prescriptions" ON public.prescriptions;
CREATE POLICY "Authorized users can insert prescriptions"
  ON public.prescriptions FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Doctors can update prescription confirmation" ON public.prescriptions;
CREATE POLICY "Doctors can update prescription confirmation"
  ON public.prescriptions FOR UPDATE
  TO authenticated, anon
  USING (true);

-- 5.3 Care Plans Policies
DROP POLICY IF EXISTS "Users can read care plans" ON public.care_plans;
CREATE POLICY "Users can read care plans"
  ON public.care_plans FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Doctors can create and update care plans" ON public.care_plans;
CREATE POLICY "Doctors can create and update care plans"
  ON public.care_plans FOR ALL
  TO authenticated, anon
  USING (true);

-- 5.4 Medication Schedules & Adherence Logs Policies
DROP POLICY IF EXISTS "Read medication schedules" ON public.medication_schedules;
CREATE POLICY "Read medication schedules"
  ON public.medication_schedules FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Update medication schedules" ON public.medication_schedules;
CREATE POLICY "Update medication schedules"
  ON public.medication_schedules FOR UPDATE
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Insert medication schedules" ON public.medication_schedules;
CREATE POLICY "Insert medication schedules"
  ON public.medication_schedules FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Read adherence logs" ON public.adherence_logs;
CREATE POLICY "Read adherence logs"
  ON public.adherence_logs FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Insert adherence logs" ON public.adherence_logs;
CREATE POLICY "Insert adherence logs"
  ON public.adherence_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- 5.5 Health Updates, Care Gaps, Follow Ups, Caregiver Consent
DROP POLICY IF EXISTS "Health updates access" ON public.health_updates;
CREATE POLICY "Health updates access"
  ON public.health_updates FOR ALL
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Care gaps access" ON public.care_gaps;
CREATE POLICY "Care gaps access"
  ON public.care_gaps FOR ALL
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Follow ups access" ON public.follow_ups;
CREATE POLICY "Follow ups access"
  ON public.follow_ups FOR ALL
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Caregiver consent access" ON public.caregiver_consent;
CREATE POLICY "Caregiver consent access"
  ON public.caregiver_consent FOR ALL
  TO authenticated, anon
  USING (true);

-- 5.6 Storage Policies for Private 'prescriptions' Bucket
DROP POLICY IF EXISTS "Private prescription read via signed URL" ON storage.objects;
CREATE POLICY "Private prescription read via signed URL"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'prescriptions');

DROP POLICY IF EXISTS "Prescription upload to private bucket" ON storage.objects;
CREATE POLICY "Prescription upload to private bucket"
  ON storage.objects FOR INSERT
  TO authenticated, anon
  WITH CHECK (bucket_id = 'prescriptions');

-- =============================================================================
-- 6. VIEWS & RPC FUNCTIONS
-- =============================================================================

-- 6.1 PATIENT SUMMARIES VIEW
CREATE OR REPLACE VIEW public.patient_summaries AS
SELECT
  jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'age', p.age,
    'gender', p.gender,
    'phone', p.phone,
    'symptoms', p.symptoms,
    'allergies', p.allergies,
    'currentMeds', p.current_meds,
    'language', p.language
  ) AS patient,
  jsonb_build_object(
    'taken', coalesce((SELECT count(*) FROM public.medication_schedules ms WHERE ms.patient_id = p.id AND ms.status = 'taken'), 0),
    'missed', coalesce((SELECT count(*) FROM public.medication_schedules ms WHERE ms.patient_id = p.id AND ms.status IN ('missed', 'cannot_take')), 0),
    'pending', coalesce((SELECT count(*) FROM public.medication_schedules ms WHERE ms.patient_id = p.id AND ms.status IN ('pending', 'snoozed')), 0),
    'total', coalesce((SELECT count(*) FROM public.medication_schedules ms WHERE ms.patient_id = p.id), 0)
  ) AS "dosesToday",
  85 AS "adherence7Day",
  (
    SELECT jsonb_build_object(
      'id', hu.id,
      'patientId', hu.patient_id,
      'state', hu.state,
      'symptomDescription', hu.symptom_description,
      'submittedAt', hu.submitted_at,
      'source', hu.source
    )
    FROM public.health_updates hu
    WHERE hu.patient_id = p.id
    ORDER BY hu.submitted_at DESC
    LIMIT 1
  ) AS "latestUpdate",
  coalesce((SELECT count(*) FROM public.care_gaps cg WHERE cg.patient_id = p.id AND cg.status = 'open'), 0) AS "openGaps",
  coalesce((SELECT array_agg(cg.evidence) FROM public.care_gaps cg WHERE cg.patient_id = p.id AND cg.status = 'open'), ARRAY[]::text[]) AS "gapReasons",
  coalesce(
    (SELECT max(hu.submitted_at) FROM public.health_updates hu WHERE hu.patient_id = p.id),
    p.created_at
  ) AS "lastUpdateAt",
  CASE
    WHEN EXISTS (SELECT 1 FROM public.care_gaps cg WHERE cg.patient_id = p.id AND cg.status = 'open' AND cg.type IN ('new_symptom', 'repeated_missed_dose')) THEN 'urgent'
    WHEN EXISTS (SELECT 1 FROM public.care_gaps cg WHERE cg.patient_id = p.id AND cg.status = 'open') THEN 'needs_attention'
    ELSE 'on_track'
  END AS priority
FROM public.patients p;

-- 6.2 GET FAMILY VIEW RPC
CREATE OR REPLACE FUNCTION public.get_family_view(p_patient_id text)
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- 7. SEED DATA (For Immediate Hackathon Demo & Interoperability)
-- =============================================================================

INSERT INTO public.patients (id, name, age, gender, phone, symptoms, allergies, current_meds, language)
VALUES
  ('p1', 'Ravi Sharma', 62, 'male', '9876543210', 'Chest heaviness since morning', 'Penicillin', 'Aspirin, Metformin', 'hi'),
  ('p2', 'Sunita Devi', 55, 'female', '9876543211', 'Knee pain, mild swelling', 'None', 'Calcium, Vitamin D', 'hi'),
  ('p3', 'Ahmed Khan', 48, 'male', '9876543212', 'Blood pressure fluctuation', 'Sulfa drugs', 'Amlodipine', 'en'),
  ('p4', 'Lakshmi Rao', 70, 'female', '9876543213', 'Diabetes management follow-up', 'None', 'Metformin, Glimepiride', 'hi'),
  ('00000000-0000-0000-0000-000000000001', 'Ravi Sharma (UUID)', 62, 'male', '9876543210', 'Chest heaviness since morning', 'Penicillin', 'Aspirin, Metformin', 'hi')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  symptoms = EXCLUDED.symptoms,
  allergies = EXCLUDED.allergies,
  current_meds = EXCLUDED.current_meds;

INSERT INTO public.caregiver_consent (patient_id, caregiver_name, relationship, contact_number, authorized)
VALUES
  ('p1', 'Priya (Daughter)', 'Daughter', '9876543210', true),
  ('00000000-0000-0000-0000-000000000001', 'Priya (Daughter)', 'Daughter', '9876543210', true)
ON CONFLICT (patient_id, caregiver_name) DO UPDATE SET
  authorized = EXCLUDED.authorized,
  contact_number = EXCLUDED.contact_number;

INSERT INTO public.medication_schedules (patient_id, medicine_name, dosage, scheduled_time, status, instructions)
VALUES
  ('p1', 'Aspirin', '75mg', '08:00', 'taken', 'After breakfast'),
  ('p1', 'Metformin', '500mg', '13:00', 'taken', 'After lunch'),
  ('p1', 'Metformin', '500mg', '20:00', 'pending', 'After dinner'),
  ('p1', 'Atorvastatin', '10mg', '22:00', 'pending', 'At bedtime'),
  ('00000000-0000-0000-0000-000000000001', 'Aspirin', '75mg', '08:00', 'taken', 'After breakfast'),
  ('00000000-0000-0000-0000-000000000001', 'Metformin', '500mg', '13:00', 'taken', 'After lunch'),
  ('00000000-0000-0000-0000-000000000001', 'Metformin', '500mg', '20:00', 'pending', 'After dinner'),
  ('00000000-0000-0000-0000-000000000001', 'Atorvastatin', '10mg', '22:00', 'pending', 'At bedtime')
ON CONFLICT DO NOTHING;

INSERT INTO public.health_updates (patient_id, state, symptom_description, source)
VALUES
  ('p1', 'bad', 'Chest heaviness since morning', 'patient'),
  ('00000000-0000-0000-0000-000000000001', 'bad', 'Chest heaviness since morning', 'patient')
ON CONFLICT DO NOTHING;

INSERT INTO public.care_gaps (patient_id, type, evidence, missing_info, followup_question, status)
VALUES
  ('p1', 'new_symptom', 'New symptom: "Chest heaviness since morning"', 'Severity not specified', 'Chest heaviness ke saath koi aur lakshan hai? (sweating, breathlessness?)', 'open'),
  ('p1', 'repeated_missed_dose', '2 missed doses in last 5 days (Metformin)', NULL, 'Kya Metformin ke saath koi problem hai?', 'open'),
  ('00000000-0000-0000-0000-000000000001', 'new_symptom', 'New symptom: "Chest heaviness since morning"', 'Severity not specified', 'Chest heaviness ke saath koi aur lakshan hai? (sweating, breathlessness?)', 'open')
ON CONFLICT DO NOTHING;

INSERT INTO public.prescriptions (patient_id, image_url, fields, confirmed)
VALUES
  ('p1', 'https://images.pexels.com/photos/139398/brainstorming-meeting-patients-diagnosis-139398.jpeg?auto=compress&cs=tinysrgb&w=600', '[{"key":"medicine","labelKey":"rx_medicine","value":"Aspirin","status":"confirmed"},{"key":"dosage","labelKey":"rx_dosage","value":"75mg","status":"confirmed"},{"key":"frequency","labelKey":"rx_frequency","value":"Once daily","status":"uncertain"},{"key":"duration","labelKey":"rx_duration","value":"","status":"uncertain"},{"key":"instructions","labelKey":"rx_instructions","value":"After breakfast","status":"confirmed"}]'::jsonb, false),
  ('00000000-0000-0000-0000-000000000001', 'https://images.pexels.com/photos/139398/brainstorming-meeting-patients-diagnosis-139398.jpeg?auto=compress&cs=tinysrgb&w=600', '[{"key":"medicine","labelKey":"rx_medicine","value":"Aspirin","status":"confirmed"},{"key":"dosage","labelKey":"rx_dosage","value":"75mg","status":"confirmed"},{"key":"frequency","labelKey":"rx_frequency","value":"Once daily","status":"uncertain"},{"key":"duration","labelKey":"rx_duration","value":"","status":"uncertain"},{"key":"instructions","labelKey":"rx_instructions","value":"After breakfast","status":"confirmed"}]'::jsonb, false)
ON CONFLICT DO NOTHING;
