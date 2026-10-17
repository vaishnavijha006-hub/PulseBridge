-- =============================================================================
-- Migration: 20261017000005_add_abha_support.sql
-- Description: Adds optional ABHA (Ayushman Bharat Health Account) fields to patients
-- Safety & Compatibility Rules:
-- 1. All new columns are nullable or have safe defaults ('not_provided').
-- 2. No existing data is modified or deleted.
-- 3. Check constraint enforces valid verification statuses: ('not_provided', 'unverified', 'verified').
-- 4. No Aadhaar or OTP data is ever stored.
-- =============================================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS abha_number text,
  ADD COLUMN IF NOT EXISTS abha_address text,
  ADD COLUMN IF NOT EXISTS abha_verification_status text NOT NULL DEFAULT 'not_provided';

-- Check constraint for abha_verification_status
DO $$ BEGIN
  ALTER TABLE public.patients
    ADD CONSTRAINT patients_abha_verification_status_check
    CHECK (abha_verification_status IN ('not_provided', 'unverified', 'verified'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional lookup index for ABHA number
CREATE INDEX IF NOT EXISTS idx_patients_abha_number
  ON public.patients(abha_number)
  WHERE abha_number IS NOT NULL;

COMMENT ON COLUMN public.patients.abha_number IS 'Normalized or formatted 14-digit Ayushman Bharat Health Account (ABHA) number';
COMMENT ON COLUMN public.patients.abha_address IS 'Self-declared ABHA address (PHR handle), e.g. username@abdm';
COMMENT ON COLUMN public.patients.abha_verification_status IS 'ABHA verification status: not_provided, unverified (format valid but unverified with NHA), or verified';
