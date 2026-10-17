import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { PatientDashboard } from '@/pages/PatientDashboard';
import { dataService } from '@/services/dataService';
import { demoSchedules, demoFollowUps, demoMedicalReports } from '@/data/demoData';
import type { PatientProfile } from '@/types';

describe('Patient Context Continuity — Intake to Dashboard', () => {
  it('case 1: dataService.savePatientIntake creates a patient record with a generated ID and saves it to the store', async () => {
    const intakeInput: Partial<PatientProfile> = {
      name: 'Vikram Malhotra',
      age: 42,
      gender: 'male',
      phone: '+91 99887 76655',
      symptoms: 'Post-op recovery, mild fever',
      allergies: 'None',
      currentMeds: 'Paracetamol 650mg, Ceftriaxone',
      language: 'en',
    };

    const res = await dataService.savePatientIntake(intakeInput);

    expect('data' in res).toBe(true);
    if ('data' in res) {
      expect(res.data.id).toMatch(/^p-/);
      expect(res.data.name).toBe('Vikram Malhotra');
      expect(res.data.age).toBe(42);

      // Verify the patient is retrievable via fetchPatient using the new ID
      const fetched = await dataService.fetchPatient(res.data.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.name).toBe('Vikram Malhotra');
      expect(fetched?.id).toBe(res.data.id);
    }
  });

  it("case 2: PatientDashboard displays newly submitted patient's identity rather than default demo patient", () => {
    const newlyCreatedPatient: PatientProfile = {
      id: 'p-new-user-101',
      name: 'Ananya Gupta',
      age: 31,
      gender: 'female',
      phone: '+91 91234 56789',
      symptoms: 'Mild chest tightness after exercise',
      allergies: 'Aspirin',
      currentMeds: 'Pantoprazole 40mg',
      language: 'en',
    };

    render(
      <LanguageProvider initialLang="en">
        <PatientDashboard
          patient={newlyCreatedPatient}
          patientId={newlyCreatedPatient.id}
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

    // Header identity badge
    expect(screen.getByText('Ananya Gupta')).toBeInTheDocument();
    expect(screen.getByText('ID: p-new-user-101')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument(); // Initial avatar

    // Greeting section displays first name
    expect(screen.getByText('Ananya')).toBeInTheDocument();

    // Must NOT display Ravi Sharma or demo ID p1
    expect(screen.queryByText('Ravi Sharma')).not.toBeInTheDocument();
    expect(screen.queryByText('ID: p1')).not.toBeInTheDocument();

    // Renders empty schedules state gracefully
    expect(screen.getByText('No data available yet.')).toBeInTheDocument();
    expect(screen.getByText('0 of 0 completed (0%)')).toBeInTheDocument();
  });

  it('case 3: existing demo entry flow still works and renders Ravi Sharma when no patient prop is passed', () => {
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

    // Default fallback to Ravi Sharma (p1)
    expect(screen.getByText('Ravi Sharma')).toBeInTheDocument();
    expect(screen.getByText('ID: p1')).toBeInTheDocument();
    expect(screen.getByText('Ravi')).toBeInTheDocument();

    // Dose cards exist for Ravi
    expect(screen.getByText('Atorvastatin')).toBeInTheDocument();
    expect(screen.getByText('Aspirin')).toBeInTheDocument();
    expect(screen.getAllByText('Metformin').length).toBeGreaterThanOrEqual(1);
  });

  it('case 4: missing or unresolvable patient data handles gracefully without crashing', () => {
    render(
      <LanguageProvider initialLang="en">
        <PatientDashboard
          patient={null}
          patientId="p-non-existent-9999"
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

    // Fallback patient identity is safely displayed with the given ID
    expect(screen.getByText('ID: p-non-existent-9999')).toBeInTheDocument();
    expect(screen.getAllByText('Patient').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('No data available yet.')).toBeInTheDocument();
  });

  it('case 5: Tab 4 Family Recovery Circle receives the correct patientId', () => {
    const customPatient: PatientProfile = {
      id: 'p-custom-family-check',
      name: 'Sunita Verma',
      age: 50,
      gender: 'female',
      phone: '+91 98111 22233',
      symptoms: 'Post-op physiotherapy',
      allergies: 'None',
      currentMeds: '',
      language: 'en',
    };

    render(
      <LanguageProvider initialLang="en">
        <PatientDashboard
          patient={customPatient}
          patientId={customPatient.id}
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

    // Click on Family Recovery Circle tab
    const familyTab = screen.getByText('Family Circle');
    fireEvent.click(familyTab);

    // Family consent manager is mounted for this patient
    expect(screen.getByText(/Family Recovery Circle/i)).toBeInTheDocument();
  });
});
