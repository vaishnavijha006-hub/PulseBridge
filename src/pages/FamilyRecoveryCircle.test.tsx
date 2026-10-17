import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { FamilyRecoveryCircle } from './FamilyRecoveryCircle';
import { PatientDashboard } from './PatientDashboard';
import { familyConsentService } from '@/services/familyConsentService';
import { demoSchedules, demoFollowUps, demoMedicalReports } from '@/data/demoData';

describe('FamilyRecoveryCircle — Dedicated Premium Healthcare Dashboard', () => {
  beforeEach(() => {
    familyConsentService.resetToDemo();
  });

  it('renders top navigation, non-alarming welcome section, and patient connection card', () => {
    render(
      <LanguageProvider initialLang="en">
        <FamilyRecoveryCircle onBack={vi.fn()} />
      </LanguageProvider>
    );

    // Top Navigation & Branding
    expect(screen.getByText('Family Recovery Circle')).toBeInTheDocument();

    // Welcome Section
    expect(screen.getByText('Support their recovery, together.')).toBeInTheDocument();
    expect(
      screen.getByText('Stay connected with the updates your loved one has chosen to share.')
    ).toBeInTheDocument();
    expect(screen.getByText(/PulseBridge does not provide 24\/7 continuous ICU telemetry/i)).toBeInTheDocument();

    // Patient Connection Card
    expect(screen.getByText('Active & Verified')).toBeInTheDocument();
    expect(screen.getAllByText('Ravi Sharma')[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Daughter/i)[0]).toBeInTheDocument();
  });

  it('renders shared recovery updates timeline with permitted categories and permits acknowledgment', () => {
    render(
      <LanguageProvider initialLang="en">
        <FamilyRecoveryCircle onBack={vi.fn()} />
      </LanguageProvider>
    );

    // Medication adherence card
    expect(screen.getByText('Daily Medication Progress')).toBeInTheDocument();
    expect(screen.getByText('Medication Adherence Log • Today')).toBeInTheDocument();

    // Vitals check-in card
    expect(screen.getByText('Daily Health Status')).toBeInTheDocument();
    expect(screen.getByText('Patient Daily Check-in • Today')).toBeInTheDocument();

    // Acknowledge action
    const ackBtn = screen.getAllByRole('button', { name: /Acknowledge Update/i })[0];
    fireEvent.click(ackBtn);
    expect(screen.getAllByText('Acknowledged by Family')[0]).toBeInTheDocument();
  });

  it('allows family member to send an encouragement note with quick prompts', () => {
    render(
      <LanguageProvider initialLang="en">
        <FamilyRecoveryCircle onBack={vi.fn()} />
      </LanguageProvider>
    );

    // Quick prompt click
    const quickPrompt = screen.getByText('Proud of your recovery progress today! ❤️');
    fireEvent.click(quickPrompt);

    const textarea = screen.getByPlaceholderText(/Write a warm message/i);
    expect(textarea).toHaveValue('Proud of your recovery progress today! ❤️');

    const sendBtn = screen.getByRole('button', { name: /Send Note of Encouragement/i });
    fireEvent.click(sendBtn);

    expect(screen.getByText('"Proud of your recovery progress today! ❤️"')).toBeInTheDocument();
  });

  it('switches between tabs and displays milestones and privacy center', () => {
    render(
      <LanguageProvider initialLang="en">
        <FamilyRecoveryCircle onBack={vi.fn()} />
      </LanguageProvider>
    );

    // Switch to Milestones Tab
    const milestonesTab = screen.getByText('Care Milestones');
    fireEvent.click(milestonesTab);

    expect(screen.getByText('Authorized Follow-up Consultations')).toBeInTheDocument();
    expect(screen.getByText('Dr. S. Sharma, MD')).toBeInTheDocument();
    expect(screen.getByText('Day 1 Post-Discharge Adherence')).toBeInTheDocument();

    // Switch to Privacy & Permissions Tab
    const privacyTab = screen.getByText('Privacy & Permissions');
    fireEvent.click(privacyTab);

    expect(screen.getByText('Family Privacy & Boundaries Center')).toBeInTheDocument();
    expect(screen.getByText('Permitted Sharing Categories')).toBeInTheDocument();
    expect(screen.getByText('Protected Clinical Boundaries (Withheld)')).toBeInTheDocument();
    expect(screen.getByText('Raw clinical prescription monographs & chemical compounds')).toBeInTheDocument();
    expect(screen.getByText('Doctor internal SOAP clinical notes & physician hypotheses')).toBeInTheDocument();
  });

  it('displays secure fail-closed state when patient revokes access with NO self-authorization button', () => {
    // Revoke access as patient
    familyConsentService.revokeConsent('fcm_1', 'p1');

    render(
      <LanguageProvider initialLang="en">
        <FamilyRecoveryCircle onBack={vi.fn()} />
      </LanguageProvider>
    );

    // Shows revoked status
    expect(screen.getAllByText('Access Revoked')[0]).toBeInTheDocument();
    expect(
      screen.getAllByText('Access to this patient’s recovery updates has been revoked by the patient.')[0]
    ).toBeInTheDocument();

    // Sensitive categories must NOT be rendered
    expect(screen.queryByText('Daily Medication Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Call karein')).not.toBeInTheDocument();

    // Security check: Family member CANNOT self-authorize
    expect(screen.queryByText('Authorize Access')).not.toBeInTheDocument();
  });
});

describe('PatientDashboard — Family Consent Management', () => {
  beforeEach(() => {
    familyConsentService.resetToDemo();
  });

  it('allows patient to navigate to Family Circle tab and view members', () => {
    render(
      <LanguageProvider initialLang="en">
        <PatientDashboard
          schedules={demoSchedules['p1']}
          followUps={demoFollowUps['p1']}
          reports={demoMedicalReports['p1']}
          onDoseAction={vi.fn()}
          onHealthUpdate={vi.fn()}
          onFollowUpAnswer={vi.fn()}
          onBack={vi.fn()}
        />
      </LanguageProvider>
    );

    // Click Family Circle tab
    const familyTab = screen.getByText('Family Circle');
    fireEvent.click(familyTab);

    expect(screen.getByText('Consent-Based Family Recovery Circle')).toBeInTheDocument();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByText('Invite Family Member')).toBeInTheDocument();
  });

  it('allows patient to immediately revoke and restore family access', () => {
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <LanguageProvider initialLang="en">
        <PatientDashboard
          schedules={demoSchedules['p1']}
          followUps={demoFollowUps['p1']}
          reports={demoMedicalReports['p1']}
          onDoseAction={vi.fn()}
          onHealthUpdate={vi.fn()}
          onFollowUpAnswer={vi.fn()}
          onBack={vi.fn()}
        />
      </LanguageProvider>
    );

    const familyTab = screen.getByText('Family Circle');
    fireEvent.click(familyTab);

    // Find and click Revoke Access button
    const revokeBtn = screen.getAllByText('Revoke Access')[0];
    fireEvent.click(revokeBtn);

    // Verify revoked badge
    expect(screen.getAllByText('Access Revoked')[0]).toBeInTheDocument();

    // Restore access
    const restoreBtn = screen.getAllByText('Restore Access')[0];
    fireEvent.click(restoreBtn);

    expect(screen.getAllByText('Access Active')[0]).toBeInTheDocument();
  });
});
