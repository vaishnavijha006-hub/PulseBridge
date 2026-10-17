/**
 * Ayushman Bharat Health Account (ABHA) — Utility & Validation Engine
 * PulseBridge AI
 *
 * Rules:
 * 1. Official ABHA number is 14 digits, typically displayed as XX-XXXX-XXXX-XXXX.
 * 2. Spaces and hyphens are accepted during entry and normalized for storage.
 * 3. ABHA address (PHR handle) is typically 3-32 characters, e.g. username@abdm.
 * 4. Status model:
 *    - 'not_provided': Patient omitted ABHA details.
 *    - 'unverified': Patient entered format-valid details; official ABDM gateway verification is not configured.
 *    - 'verified': Only valid when genuine cryptographic/ABDM gateway verification evidence is present.
 * 5. Format validation does NOT imply official verification.
 */

import type { AbhaVerificationStatus } from '@/types';

/**
 * Normalizes an ABHA number by removing hyphens and whitespace.
 */
export function normalizeAbhaNumber(raw?: string | null): string {
  if (!raw) return '';
  return raw.replace(/[\s-]/g, '').trim();
}

/**
 * Formats a 14-digit normalized or raw ABHA number into XX-XXXX-XXXX-XXXX.
 * If input is not 14 digits, returns the trimmed raw input.
 */
export function formatAbhaNumber(raw?: string | null): string {
  if (!raw) return '';
  const digits = normalizeAbhaNumber(raw);
  if (digits.length === 14 && /^\d{14}$/.test(digits)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`;
  }
  return raw.trim();
}

/**
 * Validates an ABHA number format.
 * Returns valid=true if empty (as it is strictly optional).
 * If provided, must normalize to exactly 14 numeric digits.
 */
export function validateAbhaNumber(raw?: string | null): {
  valid: boolean;
  error?: string;
  normalized: string;
  formatted: string;
} {
  if (!raw || !raw.trim()) {
    return { valid: true, normalized: '', formatted: '' };
  }

  const normalized = normalizeAbhaNumber(raw);

  if (!/^\d+$/.test(normalized)) {
    return {
      valid: false,
      error: 'ABHA number must contain only numbers (e.g. 12-3456-7890-1234).',
      normalized,
      formatted: raw.trim(),
    };
  }

  if (normalized.length !== 14) {
    return {
      valid: false,
      error: `ABHA number must be exactly 14 digits (entered ${normalized.length} digits).`,
      normalized,
      formatted: raw.trim(),
    };
  }

  return {
    valid: true,
    normalized,
    formatted: formatAbhaNumber(normalized),
  };
}

/**
 * Validates an ABHA address (PHR handle).
 * Optional: returns valid=true if empty.
 * If provided: 3 to 32 characters, alphanumeric with optional dot, hyphen, underscore, and optional @domain.
 */
export function validateAbhaAddress(raw?: string | null): {
  valid: boolean;
  error?: string;
  cleaned: string;
} {
  if (!raw || !raw.trim()) {
    return { valid: true, cleaned: '' };
  }

  const cleaned = raw.trim().toLowerCase();

  // Pattern: 3-32 chars username, optional @abdm or other domain
  const phrPattern = /^[a-z0-9][a-z0-9._-]{2,31}(@[a-z0-9.-]+)?$/;

  if (!phrPattern.test(cleaned)) {
    return {
      valid: false,
      error: 'ABHA address should be 3-32 characters (e.g. username@abdm or firstname.lastname).',
      cleaned,
    };
  }

  return { valid: true, cleaned };
}

/**
 * Deterministically resolves ABHA verification status.
 * Safety Rule: Presence of format-valid details NEVER produces 'verified'.
 */
export function resolveAbhaVerificationStatus(input: {
  abhaNumber?: string | null;
  abhaAddress?: string | null;
  abhaVerificationStatus?: AbhaVerificationStatus | null;
  isOfficiallyVerified?: boolean;
}): AbhaVerificationStatus {
  // If explicitly verified by genuine gateway evidence
  if (input.isOfficiallyVerified === true || input.abhaVerificationStatus === 'verified') {
    return 'verified';
  }

  const normNum = normalizeAbhaNumber(input.abhaNumber);
  const normAddr = (input.abhaAddress || '').trim();

  if (normNum.length > 0 || normAddr.length > 0) {
    return 'unverified';
  }

  return 'not_provided';
}
