import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  formatPhoneNumber,
  validatePhoneNumber,
} from './phone';

describe('Phone Number Validation & Utility Engine', () => {
  describe('normalizePhoneNumber', () => {
    it('normalizes standard 10-digit number', () => {
      expect(normalizePhoneNumber('9876543210')).toBe('9876543210');
    });

    it('strips spaces, dashes, dots, and parentheses', () => {
      expect(normalizePhoneNumber('98765 43210')).toBe('9876543210');
      expect(normalizePhoneNumber('98765-43210')).toBe('9876543210');
      expect(normalizePhoneNumber('(987) 654-3210')).toBe('9876543210');
      expect(normalizePhoneNumber('987.654.3210')).toBe('9876543210');
    });

    it('strips +91 country code to extract the core 10 digits', () => {
      expect(normalizePhoneNumber('+91 98765 43210')).toBe('9876543210');
      expect(normalizePhoneNumber('+919876543210')).toBe('9876543210');
    });

    it('strips leading 0 trunk prefix when 11 digits total', () => {
      expect(normalizePhoneNumber('09876543210')).toBe('9876543210');
    });

    it('handles null, undefined, or empty strings gracefully', () => {
      expect(normalizePhoneNumber('')).toBe('');
      expect(normalizePhoneNumber(null)).toBe('');
      expect(normalizePhoneNumber(undefined)).toBe('');
    });
  });

  describe('formatPhoneNumber', () => {
    it('formats a 10-digit number into 5+5 group', () => {
      expect(formatPhoneNumber('9876543210')).toBe('98765 43210');
    });

    it('can optionally include +91 country prefix', () => {
      expect(formatPhoneNumber('9876543210', true)).toBe('+91 98765 43210');
    });

    it('preserves non-10 digit input without mangling', () => {
      expect(formatPhoneNumber('12345')).toBe('12345');
    });
  });

  describe('validatePhoneNumber', () => {
    it('passes valid 10-digit phone numbers', () => {
      const res = validatePhoneNumber('9876543210');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('9876543210');
      expect(res.formatted).toBe('98765 43210');
    });

    it('passes 10-digit phone number with +91 country prefix', () => {
      const res = validatePhoneNumber('+91 98765 43210');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('9876543210');
    });

    it('passes 10-digit phone number with 0 trunk prefix', () => {
      const res = validatePhoneNumber('09876543210');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('9876543210');
    });

    it('rejects phone numbers with fewer than 10 digits', () => {
      const res = validatePhoneNumber('98765');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exactly 10 digits');
      expect(res.error).toContain('currently 5 digits');
    });

    it('rejects phone numbers with more than 10 digits', () => {
      const res = validatePhoneNumber('987654321099');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exactly 10 digits');
      expect(res.error).toContain('currently 12 digits');
    });

    it('rejects phone numbers containing letters or invalid characters', () => {
      const res = validatePhoneNumber('98765ABC10');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('only numeric digits');
    });

    it('allows empty phone numbers when required=false', () => {
      expect(validatePhoneNumber('', false).valid).toBe(true);
      expect(validatePhoneNumber(null, false).valid).toBe(true);
    });

    it('rejects empty phone numbers when required=true', () => {
      const res = validatePhoneNumber('', true);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('required');
    });
  });
});
