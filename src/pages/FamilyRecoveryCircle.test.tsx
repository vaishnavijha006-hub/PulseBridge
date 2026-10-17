import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { FamilyRecoveryCircle } from './FamilyRecoveryCircle';
import { PatientDashboard } from './PatientDashboard';
import { familyConsentService } from '@/services/familyConsentService';
import { demoSchedules, demoFollowUps, demoMedicalReports } from '@/data/demoData';

describe('FamilyRecoveryCircle — Consent-Based Family Experience', () => {
  beforeEach(() => {
    familyConsentService.resetToDemo();
  });

  it('renders authorized family companion view with allowed information', () => {
    render(
      <LanguageProvider initialLang="en">
        <FamilyRecoveryCircle onBack={vi.fn()} />
      </LanguageProvider>
    );

    expect(screen.getByText('Papa ka aaj ka din')).toBeInTheDocument();
    expect(screen.getByText('Active — Authorized by patient')).toBeInTheDocument();
    expect(screen.getByText('Daily Medication Progress')).toBeInTheDocument();
    expect(screen.getAllByText('Send Note of Encouragement')[0]).toBeInTheDocument();
  });

  it('allows family member to send an encouragement note', () => {
    render(
      <LanguageProvider initialLang="en">
        <FamilyRecoveryCircle onBack={vi.fn()} />
      </LanguageProvider>
    );

    const textarea = screen.getByPlaceholderText(/Write a warm message/i);
    fireEvent.change(textarea, { target: { value: 'Stay strong Papa! Thinking of you.' } });

    const sendBtn = screen.getByRole('button', { name: /Send Note of Encouragement/i });
    fireEvent.click(sendBtn);

    expect(screen.getByText('"Stay strong Papa! Thinking of you."')).toBeInTheDocument();
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
