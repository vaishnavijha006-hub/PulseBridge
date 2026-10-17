import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatientIntakeWizard } from '@/pages/PatientIntakeWizard';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { validatePhoneNumber, normalizePhoneNumber, formatPhoneNumber } from '@/utils/phone';

describe('Phone Number 10-Digit Validation Integration', () => {
  describe('1. Phone Utility Engine', () => {
    it('verifies strict 10-digit phone number rule', () => {
      expect(validatePhoneNumber('9876543210').valid).toBe(true);
      expect(validatePhoneNumber('+91 98765 43210').valid).toBe(true);
      expect(validatePhoneNumber('09876543210').valid).toBe(true);
      expect(validatePhoneNumber('98765').valid).toBe(false);
      expect(validatePhoneNumber('9876543210123').valid).toBe(false);
      expect(validatePhoneNumber('98765ABCD1').valid).toBe(false);
    });

    it('normalizes formatted phone number down to core 10 digits', () => {
      expect(normalizePhoneNumber('+91 98765 43210')).toBe('9876543210');
      expect(normalizePhoneNumber('(987) 654-3210')).toBe('9876543210');
      expect(formatPhoneNumber('9876543210')).toBe('98765 43210');
    });
  });

  describe('2. Patient Intake Wizard — Phone Validation Flow', () => {
    it('blocks advancing when phone number has fewer than 10 digits', () => {
      render(
        <LanguageProvider initialLang="en">
          <PatientIntakeWizard onComplete={vi.fn()} onBack={vi.fn()} />
        </LanguageProvider>
      );

      // Advance from language to profile step
      fireEvent.click(screen.getByText('Continue'));

      // Fill name and 5-digit invalid phone
      fireEvent.change(screen.getByPlaceholderText('Ravi Sharma'), { target: { value: 'Test User' } });
      const phoneInput = screen.getByPlaceholderText('9876543210');
      fireEvent.change(phoneInput, { target: { value: '98765' } });

      // Click Continue to try advancing
      fireEvent.click(screen.getByText('Continue'));

      // Must display 10-digit error message and stay on Profile step
      expect(screen.getByText(/Phone number must be exactly 10 digits/i)).toBeInTheDocument();
      expect(screen.queryByText(/What symptoms are you experiencing/i)).not.toBeInTheDocument();
    });

    it('blocks advancing when phone number has more than 10 digits', () => {
      render(
        <LanguageProvider initialLang="en">
          <PatientIntakeWizard onComplete={vi.fn()} onBack={vi.fn()} />
        </LanguageProvider>
      );

      // Advance to profile step
      fireEvent.click(screen.getByText('Continue'));

      // Fill 12-digit invalid phone
      const phoneInput = screen.getByPlaceholderText('9876543210');
      fireEvent.change(phoneInput, { target: { value: '987654321099' } });

      // Click Continue
      fireEvent.click(screen.getByText('Continue'));

      expect(screen.getByText(/Phone number must be exactly 10 digits/i)).toBeInTheDocument();
      expect(screen.queryByText(/What symptoms are you experiencing/i)).not.toBeInTheDocument();
    });

    it('blocks advancing when phone number contains letters', () => {
      render(
        <LanguageProvider initialLang="en">
          <PatientIntakeWizard onComplete={vi.fn()} onBack={vi.fn()} />
        </LanguageProvider>
      );

      // Advance to profile step
      fireEvent.click(screen.getByText('Continue'));

      const phoneInput = screen.getByPlaceholderText('9876543210');
      fireEvent.change(phoneInput, { target: { value: '98765ABCDE' } });

      fireEvent.click(screen.getByText('Continue'));

      expect(screen.getByText(/Phone number must contain only numeric digits/i)).toBeInTheDocument();
      expect(screen.queryByText(/What symptoms are you experiencing/i)).not.toBeInTheDocument();
    });

    it('allows advancing when a valid 10-digit phone number is provided', () => {
      render(
        <LanguageProvider initialLang="en">
          <PatientIntakeWizard onComplete={vi.fn()} onBack={vi.fn()} />
        </LanguageProvider>
      );

      // Advance to profile step
      fireEvent.click(screen.getByText('Continue'));

      // Fill valid 10-digit phone
      const phoneInput = screen.getByPlaceholderText('9876543210');
      fireEvent.change(phoneInput, { target: { value: '9876543210' } });

      // Click Continue
      fireEvent.click(screen.getByText('Continue'));

      // Should advance successfully to symptoms step
      expect(screen.getByText(/What symptoms are you experiencing/i)).toBeInTheDocument();
    });

    it('displays Hindi error message when language is Hindi and phone is invalid', () => {
      render(
        <LanguageProvider initialLang="hi">
          <PatientIntakeWizard onComplete={vi.fn()} onBack={vi.fn()} />
        </LanguageProvider>
      );

      // Advance to profile step in Hindi
      fireEvent.click(screen.getByText('आगे बढ़ें'));

      const phoneInput = screen.getByPlaceholderText('9876543210');
      fireEvent.change(phoneInput, { target: { value: '123' } });

      // Click Continue in Hindi
      fireEvent.click(screen.getByText('आगे बढ़ें'));

      // Must display Hindi translation
      expect(screen.getByText(/फ़ोन नंबर ठीक 10 अंकों का होना चाहिए/i)).toBeInTheDocument();
    });
  });
});
