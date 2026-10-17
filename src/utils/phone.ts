/**
 * Phone Number Utility & Validation Engine
 * PulseBridge AI
 *
 * Rules:
 * 1. A valid phone number must contain exactly 10 numeric digits.
 * 2. Standard formatting characters (spaces, hyphens, dots, parentheses, and leading country code +91 or trunk prefix 0)
 *    are accepted during user input and normalized down to the core 10 digits.
 * 3. Validation rejects numbers with fewer than 10 digits, more than 10 digits, or non-numeric characters.
 */

/**
 * Normalizes a raw phone number down to its core numeric digits.
 * Handles +91 country code and 0 trunk prefix.
 */
export function normalizePhoneNumber(raw?: string | null): string {
  if (!raw) return '';
  let cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Formats a 10-digit phone number for display (e.g. 98765 43210).
 */
export function formatPhoneNumber(raw?: string | null, withCountryCode = false): string {
  if (!raw) return '';
  const digits = normalizePhoneNumber(raw);
  if (digits.length === 10 && /^\d{10}$/.test(digits)) {
    const formatted = `${digits.slice(0, 5)} ${digits.slice(5)}`;
    return withCountryCode ? `+91 ${formatted}` : formatted;
  }
  return raw.trim();
}

/**
 * Validates whether the given phone number satisfies the strict 10-digit requirement.
 * 
 * @param raw - The input phone number string.
 * @param required - If true, an empty or blank value is rejected. Defaults to false.
 */
export function validatePhoneNumber(raw?: string | null, required = false): {
  valid: boolean;
  error?: string;
  normalized: string;
  formatted: string;
} {
  if (!raw || !raw.trim()) {
    if (required) {
      return {
        valid: false,
        error: 'Phone number is required and must be exactly 10 digits.',
        normalized: '',
        formatted: '',
      };
    }
    return { valid: true, normalized: '', formatted: '' };
  }

  const normalized = normalizePhoneNumber(raw);

  // Check if there are non-digit characters after normalization
  if (!/^\d+$/.test(normalized)) {
    return {
      valid: false,
      error: 'Phone number must contain only numeric digits.',
      normalized,
      formatted: raw.trim(),
    };
  }

  // Check exact 10-digit length
  if (normalized.length !== 10) {
    return {
      valid: false,
      error: `Phone number must be exactly 10 digits (currently ${normalized.length} ${normalized.length === 1 ? 'digit' : 'digits'}).`,
      normalized,
      formatted: raw.trim(),
    };
  }

  return {
    valid: true,
    normalized,
    formatted: formatPhoneNumber(normalized),
  };
}
