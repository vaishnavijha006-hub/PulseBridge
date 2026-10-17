import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { PatientIntakeWizard } from '@/pages/PatientIntakeWizard';
import { PatientDashboard } from '@/pages/PatientDashboard';
import { DoctorDashboard } from '@/pages/DoctorDashboard';
import { dataService } from '@/services/dataService';
import { demoPatients } from '@/data/demoData';
import type { PatientProfile, PatientSummary } from '@/types';
import {
  validateAbhaNumber,
  validateAbhaAddress,
  formatAbhaNumber,
  normalizeAbhaNumber,
  resolveAbhaVerificationStatus,
} from '@/utils/abha';

describe('ABHA (Ayushman Bharat Health Account) Support Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. ABHA Utility & Validation Logic', () => {
    it('normalizes ABHA numbers by removing whitespace and hyphens', () => {
      expect(normalizeAbhaNumber('12-3456-7890-1234')).toBe('12345678901234');
      expect(normalizeAbhaNumber(' 12 3456 7890 1234 ')).toBe('12345678901234');
      expect(normalizeAbhaNumber('')).toBe('');
      expect(normalizeAbhaNumber(null)).toBe('');
    });

    it('formats a 14-digit number to standard XX-XXXX-XXXX-XXXX', () => {
      expect(formatAbhaNumber('12345678901234')).toBe('12-3456-7890-1234');
      expect(formatAbhaNumber('12-3456-7890-1234')).toBe('12-3456-7890-1234');
      expect(formatAbhaNumber('12345')).toBe('12345');
    });

    it('validates 14-digit number formats and rejects invalid lengths or non-numeric characters', () => {
      // Empty is valid because ABHA is optional
      expect(validateAbhaNumber('').valid).toBe(true);
      expect(validateAbhaNumber(undefined).valid).toBe(true);

      // Valid 14 digits
      const validRes = validateAbhaNumber('91-1234-5678-9012');
      expect(validRes.valid).toBe(true);
      expect(validRes.normalized).toBe('91123456789012');
      expect(validRes.formatted).toBe('91-1234-5678-9012');

      // Invalid: too short
      const shortRes = validateAbhaNumber('12-3456-7890');
      expect(shortRes.valid).toBe(false);
      expect(shortRes.error).toContain('14 digits');

      // Invalid: contains letters
      const nonNumRes = validateAbhaNumber('12-3456-ABCD-1234');
      expect(nonNumRes.valid).toBe(false);
      expect(nonNumRes.error).toContain('only numbers');
    });

    it('validates optional ABHA address format', () => {
      expect(validateAbhaAddress('').valid).toBe(true);
      expect(validateAbhaAddress('user@abdm').valid).toBe(true);
      expect(validateAbhaAddress('ravi.sharma@abdm').valid).toBe(true);
      expect(validateAbhaAddress('ab').valid).toBe(false); // Too short (< 3 chars)
    });

    it('deterministically marks format-valid numbers as "unverified" rather than "verified"', () => {
      // Safety Rule: Format passing does NOT grant "verified" status
      const status = resolveAbhaVerificationStatus({
        abhaNumber: '12-3456-7890-1234',
        abhaAddress: 'user@abdm',
      });
      expect(status).toBe('unverified');

      // Empty details produce 'not_provided'
      expect(resolveAbhaVerificationStatus({})).toBe('not_provided');

      // Only explicit genuine gateway evidence produces 'verified'
      expect(resolveAbhaVerificationStatus({ isOfficiallyVerified: true })).toBe('verified');
      expect(resolveAbhaVerificationStatus({ abhaVerificationStatus: 'verified' })).toBe('verified');
    });
  });

  describe('2. Patient Intake Wizard — ABHA Flow', () => {
    it('allows patient intake to proceed normally when ABHA details are omitted (not_provided)', () => {
      const onComplete = vi.fn();

      render(
        <LanguageProvider initialLang="en">
          <PatientIntakeWizard onComplete={onComplete} onBack={vi.fn()} />
        </LanguageProvider>
      );

      // Language step -> Continue
      fireEvent.click(screen.getByText('Continue'));

      // Profile step: Fill mandatory fields, omit ABHA
      fireEvent.change(screen.getByPlaceholderText('Ravi Sharma'), { target: { value: 'Meera Patel' } });
      fireEvent.change(screen.getByPlaceholderText('62'), { target: { value: '45' } });
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876500000' } });

      // Click Continue to symptoms step
      fireEvent.click(screen.getByText('Continue'));

      // We should advance to symptoms without any error
      expect(screen.getByText(/What symptoms are you experiencing/i)).toBeInTheDocument();
    });

    it('blocks advancing when an invalid ABHA number is entered, displaying clear format error', () => {
      render(
        <LanguageProvider initialLang="en">
          <PatientIntakeWizard onComplete={vi.fn()} onBack={vi.fn()} />
        </LanguageProvider>
      );

      // Skip language step
      fireEvent.click(screen.getByText('Continue'));

      // Enter invalid 8-digit ABHA number
      const abhaInput = screen.getByPlaceholderText('12-3456-7890-1234');
      fireEvent.change(abhaInput, { target: { value: '12-3456' } });

      // Attempt to proceed
      fireEvent.click(screen.getByText('Continue'));

      // Error banner appears and stops navigation
      expect(screen.getByText(/ABHA number must be exactly 14 digits/i)).toBeInTheDocument();
      expect(screen.queryByText(/What symptoms are you experiencing/i)).not.toBeInTheDocument();
    });

    it('displays truthful "ABHA (Unverified)" explainer when a valid ABHA number is entered', () => {
      render(
        <LanguageProvider initialLang="en">
          <PatientIntakeWizard onComplete={vi.fn()} onBack={vi.fn()} />
        </LanguageProvider>
      );

      // Skip language step
      fireEvent.click(screen.getByText('Continue'));

      // Enter valid 14-digit ABHA number
      const abhaInput = screen.getByPlaceholderText('12-3456-7890-1234');
      fireEvent.change(abhaInput, { target: { value: '14-8899-7766-5544' } });

      // Truthful notice appears
      expect(screen.getByText(/ABHA \(Unverified\)/i)).toBeInTheDocument();
      expect(screen.getByText(/official ABDM verification is not configured/i)).toBeInTheDocument();

      // Ensure NO green "ABHA Verified" badge exists
      expect(screen.queryByText('ABHA (Verified)')).not.toBeInTheDocument();
    });
  });

  describe('3. Data Persistence & Context Continuity with ABHA', () => {
    it('associates ABHA number and address with the generated patient ID upon save', async () => {
      const input: Partial<PatientProfile> = {
        name: 'Gaurav Sen',
        age: 38,
        gender: 'male',
        phone: '9988776655',
        symptoms: 'Arrhythmia review',
        allergies: 'None',
        currentMeds: 'Metoprolol 50mg',
        language: 'en',
        abhaNumber: '12-3456-7890-1234',
        abhaAddress: 'gaurav.sen@abdm',
      };

      const res = await dataService.savePatientIntake(input);
      expect('data' in res).toBe(true);
      if (!('data' in res)) throw new Error('Save failed');

      const savedPatient = res.data;
      expect(savedPatient.id).toMatch(/^p-/);
      expect(savedPatient.abhaNumber).toBe('12-3456-7890-1234');
      expect(savedPatient.abhaAddress).toBe('gaurav.sen@abdm');
      expect(savedPatient.abhaVerificationStatus).toBe('unverified');

      // Verify retrieval preserves the exact ABHA data
      const fetched = await dataService.fetchPatient(savedPatient.id);
      expect(fetched?.abhaNumber).toBe('12-3456-7890-1234');
      expect(fetched?.abhaVerificationStatus).toBe('unverified');
    });

    it('preserves existing demo patient workflow without ABHA data (backward compatibility)', async () => {
      const p1 = await dataService.fetchPatient('p1');
      expect(p1).not.toBeNull();
      expect(p1?.name).toBe('Ravi Sharma');
      // Defaults safely to 'not_provided' or undefined
      expect(p1?.abhaVerificationStatus ?? 'not_provided').toBe('not_provided');
    });
  });

  describe('4. Interface Truthfulness & Badge Verification', () => {
    it('Patient Dashboard displays ABHA details with explicit "ABHA (Unverified)" status tag and never a false verified badge', () => {
      const testPatient: PatientProfile = {
        id: 'p-test-abha-1',
        name: 'Kavita Iyer',
        age: 50,
        gender: 'female',
        phone: '9876543210',
        symptoms: 'Palpitations',
        allergies: 'None',
        currentMeds: 'Atenolol 25mg',
        language: 'en',
        abhaNumber: '99-8877-6655-4433',
        abhaAddress: 'kavita.iyer@abdm',
        abhaVerificationStatus: 'unverified',
      };

      render(
        <LanguageProvider initialLang="en">
          <PatientDashboard
            patient={testPatient}
            patientId={testPatient.id}
            schedules={[]}
            followUps={[]}
            reports={[]}
            onDoseAction={vi.fn()}
            onHealthUpdate={vi.fn()}
            onFollowUpAnswer={vi.fn()}
            onBack={vi.fn()}
          />
        </LanguageProvider>
      );

      // Verify ABHA number and address are rendered
      expect(screen.getByText('99-8877-6655-4433')).toBeInTheDocument();
      expect(screen.getByText('kavita.iyer@abdm')).toBeInTheDocument();

      // Truthful badge is shown
      expect(screen.getByText('ABHA (Unverified)')).toBeInTheDocument();
      expect(screen.getByText(/official ABDM verification is not configured/i)).toBeInTheDocument();

      // Never shows false "ABHA (Verified)" badge
      expect(screen.queryByText('ABHA (Verified)')).not.toBeInTheDocument();
    });

    it('Doctor Dashboard displays ABHA details and explicit "ABHA Unverified" notice in clinical chart', () => {
      const abhaPatient: PatientProfile = {
        id: 'p-doc-test-1',
        name: 'Suresh Menon',
        age: 58,
        gender: 'male',
        phone: '9876543219',
        symptoms: 'Elevated BP',
        allergies: 'None',
        currentMeds: 'Telmisartan 40mg',
        language: 'en',
        abhaNumber: '77-6655-4433-2211',
        abhaAddress: 'suresh.menon@abdm',
        abhaVerificationStatus: 'unverified',
      };

      const summary: PatientSummary = {
        patient: abhaPatient,
        dosesToday: { taken: 1, missed: 0, pending: 1, total: 2 },
        adherence7Day: 90,
        latestUpdate: null,
        openGaps: 0,
        gapReasons: [],
        lastUpdateAt: new Date().toISOString(),
        priority: 'on_track',
        triageScore: 20,
      };

      render(
        <LanguageProvider initialLang="en">
          <DoctorDashboard
            summaries={[summary]}
            careGaps={{}}
            prescriptionDrafts={{}}
            followUps={{}}
            onConfirmCarePlan={vi.fn()}
            onCareGapAction={vi.fn()}
            onBack={vi.fn()}
          />
        </LanguageProvider>
      );

      // Patient card on Doctor overview displays ABHA number and Unverified tag
      expect(screen.getByText(/ABHA: 77-6655-4433-2211/i)).toBeInTheDocument();
      expect(screen.getAllByText('Unverified').length).toBeGreaterThan(0);

      // Click card to open patient detail chart
      const card = screen.getByText('Suresh Menon').closest('button');
      expect(card).not.toBeNull();
      fireEvent.click(card!);

      // Detail demographics chart displays ABHA section
      expect(screen.getByText('77-6655-4433-2211')).toBeInTheDocument();
      expect(screen.getByText('suresh.menon@abdm')).toBeInTheDocument();
      expect(screen.getByText('ABHA Unverified')).toBeInTheDocument();
      expect(screen.getByText('Official ABDM verification not configured')).toBeInTheDocument();

      // Does not show "ABHA Verified"
      expect(screen.queryByText('ABHA Verified')).not.toBeInTheDocument();
    });
  });
});
