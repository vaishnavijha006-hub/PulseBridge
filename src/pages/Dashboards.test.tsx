import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { DoctorDashboard } from '@/pages/DoctorDashboard';
import { PatientDashboard } from '@/pages/PatientDashboard';
import { getPatientSummaries, demoCareGaps, demoPrescriptionDrafts, demoFollowUps, demoMedicalReports, demoSchedules } from '@/data/demoData';

function TestLanguageConsumer() {
  const { lang, toggle, t } = useLanguage();
  return (
    <div>
      <span data-testid="current-lang">{lang}</span>
      <span data-testid="translated-title">{t('admin_title')}</span>
      <button onClick={toggle}>Toggle Lang</button>
    </div>
  );
}

describe('LanguageContext and Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to English and allows translating keys', () => {
    render(
      <LanguageProvider>
        <TestLanguageConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('current-lang').textContent).toBe('en');
    expect(screen.getByTestId('translated-title').textContent).toBe('System Operations Center');
  });

  it('toggles language and persists choice to localStorage', () => {
    render(
      <LanguageProvider>
        <TestLanguageConsumer />
      </LanguageProvider>
    );

    const btn = screen.getByText('Toggle Lang');
    fireEvent.click(btn);

    expect(screen.getByTestId('current-lang').textContent).toBe('hi');
    expect(screen.getByTestId('translated-title').textContent).toBe('सिस्टम ऑपरेशन्स केंद्र');
    expect(localStorage.getItem('pulsebridge_lang')).toBe('hi');
  });
});

describe('AdminDashboard — System Operations Center', () => {
  it('renders the System Operations Center with real metric values', () => {
    render(
      <LanguageProvider initialLang="en">
        <AdminDashboard onBack={vi.fn()} />
      </LanguageProvider>
    );

    expect(screen.getAllByText('System Operations Center')[0]).toBeInTheDocument();
    expect(screen.getByText('Live Infrastructure Status')).toBeInTheDocument();
    expect(screen.getByText('Registered Patients')).toBeInTheDocument();
    expect(screen.getByText('Active Care Actions')).toBeInTheDocument();
  });

  it('switches between tabs and displays the honest Enterprise IAM roadmap note', () => {
    render(
      <LanguageProvider initialLang="en">
        <AdminDashboard onBack={vi.fn()} />
      </LanguageProvider>
    );

    // Switch to Access tab
    const accessTab = screen.getByText('Role & Access Directory');
    fireEvent.click(accessTab);

    expect(screen.getByText('Configured system personas and clinical role boundary assignments.')).toBeInTheDocument();
    expect(screen.getByText('Dr. S. Sharma, MD')).toBeInTheDocument();
    expect(screen.getByText(/Enterprise IAM Roadmap/i)).toBeInTheDocument();

    // Switch to Security tab
    const securityTab = screen.getByText('Security & Compliance');
    fireEvent.click(securityTab);
    expect(screen.getByText('Row Level Security (RLS)')).toBeInTheDocument();
    expect(screen.getByText('Emergency Override Immunity')).toBeInTheDocument();
  });
});

describe('DoctorDashboard — Clinical Command Center', () => {
  it('renders Clinical Command Center and shows prominent emergency override banner', () => {
    const summaries = getPatientSummaries();
    render(
      <LanguageProvider initialLang="en">
        <DoctorDashboard
          summaries={summaries}
          careGaps={demoCareGaps}
          prescriptionDrafts={demoPrescriptionDrafts}
          followUps={demoFollowUps}
          reports={demoMedicalReports}
          onConfirmCarePlan={vi.fn()}
          onCareGapAction={vi.fn()}
          onBack={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByText('Clinical Command Center')).toBeInTheDocument();
    expect(screen.getByText(/Emergency Protocol Triggered/i)).toBeInTheDocument();
    expect(screen.getAllByText('CareGap Radar')[0]).toBeInTheDocument();
  });

  it('allows filtering patients by priority', () => {
    const summaries = getPatientSummaries();
    render(
      <LanguageProvider initialLang="en">
        <DoctorDashboard
          summaries={summaries}
          careGaps={demoCareGaps}
          prescriptionDrafts={demoPrescriptionDrafts}
          followUps={demoFollowUps}
          reports={demoMedicalReports}
          onConfirmCarePlan={vi.fn()}
          onCareGapAction={vi.fn()}
          onBack={vi.fn()}
        />
      </LanguageProvider>
    );

    const urgentFilter = screen.getAllByRole('button', { name: /Urgent/i })[0];
    fireEvent.click(urgentFilter);
    expect(screen.getAllByText('Ravi Sharma')[0]).toBeInTheDocument();
  });
});

describe('PatientDashboard — Personal Health Companion', () => {
  it('renders Personal Health Companion with medication progress and tabs', () => {
    const schedules = demoSchedules['p1'];
    render(
      <LanguageProvider initialLang="en">
        <PatientDashboard
          schedules={schedules}
          followUps={demoFollowUps['p1']}
          reports={demoMedicalReports['p1']}
          onDoseAction={vi.fn()}
          onHealthUpdate={vi.fn()}
          onFollowUpAnswer={vi.fn()}
          onBack={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByText('Patient Health Companion')).toBeInTheDocument();
    expect(screen.getByText("Today's Medication Progress")).toBeInTheDocument();

    // Check tabs
    const reportsTab = screen.getByText("My Medical Reports");
    fireEvent.click(reportsTab);
    expect(screen.getByText('Cardiac Biomarker & Lipid Panel')).toBeInTheDocument();
  });
});
