import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { DoctorDashboard } from '@/pages/DoctorDashboard';
import { PatientDashboard } from '@/pages/PatientDashboard';
import { dataService } from '@/services/dataService';
import { careActionService } from '@/services/careActionService';
import type { PatientSummary, PrescriptionDraft, PrescriptionField, PatientProfile, CareGap } from '@/types';
import { demoPatients, demoCareGaps, demoPrescriptionDrafts, demoFollowUps, demoMedicalReports } from '@/data/demoData';

describe('Doctor-to-Patient End-to-End Care Workflow', () => {
  const mockPatientId = 'p-test-kavita-909';
  const mockPatient: PatientProfile = {
    id: mockPatientId,
    name: 'Kavita Rao',
    age: 52,
    gender: 'female',
    phone: '+91 98765 11223',
    symptoms: 'Shortness of breath on exertion',
    allergies: 'Sulfa',
    currentMeds: 'Metoprolol 25mg',
    language: 'en',
  };

  const mockSummary: PatientSummary = {
    patient: mockPatient,
    dosesToday: { taken: 0, missed: 0, pending: 0, total: 0 },
    adherence7Day: 100,
    latestUpdate: null,
    openGaps: 1,
    gapReasons: ['New symptom reported'],
    lastUpdateAt: new Date().toISOString(),
    priority: 'urgent',
    triageScore: 82,
    pendingRxCount: 1,
  };

  const mockDraft: PrescriptionDraft = {
    id: 'rx-draft-kavita-1',
    patientId: mockPatientId,
    imageUrl: 'https://example.com/prescription.png',
    uploadedAt: new Date().toISOString(),
    fields: [
      { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Metoprolol Tartrate', status: 'uncertain' },
      { key: 'dosage', labelKey: 'rx_field_dosage', value: '25mg', status: 'uncertain' },
      { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Twice daily', status: 'uncertain' },
      { key: 'duration', labelKey: 'rx_field_duration', value: '30 days', status: 'uncertain' },
      { key: 'instructions', labelKey: 'rx_field_instructions', value: 'Take with food', status: 'uncertain' },
    ],
    confirmed: false,
  };

  const mockCareGap: CareGap = {
    id: 'gap-kavita-1',
    patientId: mockPatientId,
    type: 'new_symptom',
    evidence: 'Reported shortness of breath during exertion',
    timestamp: new Date().toISOString(),
    missingInfo: null,
    followupQuestion: 'Are you experiencing chest discomfort as well?',
    status: 'open',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Doctor can find, filter, and open review chart for the intended patient', () => {
    render(
      <LanguageProvider initialLang="en">
        <DoctorDashboard
          summaries={[mockSummary]}
          careGaps={{ [mockPatientId]: [mockCareGap] }}
          prescriptionDrafts={{ [mockPatientId]: mockDraft }}
          followUps={{ [mockPatientId]: [] }}
          onConfirmCarePlan={vi.fn()}
          onCareGapAction={vi.fn()}
          onBack={vi.fn()}
        />
      </LanguageProvider>
    );

    // Patient card appears in the Doctor Clinical Command Center
    expect(screen.getByText('Kavita Rao')).toBeInTheDocument();

    // Click on Kavita's card to open her Clinical Detail view
    const patientCard = screen.getByText('Kavita Rao').closest('button');
    expect(patientCard).not.toBeNull();
    fireEvent.click(patientCard!);

    // Doctor is now inside Kavita's EHR Clinical Chart
    expect(screen.getAllByText('Kavita Rao').length).toBeGreaterThan(0);
    expect(screen.getByText(/Shortness of breath on exertion/i)).toBeInTheDocument();
    expect(screen.getByText('Clinical Summary')).toBeInTheDocument();
    expect(screen.getByText('Prescription Verification')).toBeInTheDocument();
    expect(screen.getByText('Care Gaps')).toBeInTheDocument();
  });

  it('2. Care-plan confirmation validates critical fields and activates schedules strictly for that patient ID', async () => {
    // Attempting confirmation with empty critical fields fails
    const incompleteFields: PrescriptionField[] = [
      { key: 'medicine', labelKey: 'rx_field_medicine', value: '', status: 'uncertain' },
      { key: 'dosage', labelKey: 'rx_field_dosage', value: '25mg', status: 'confirmed' },
    ];
    const failRes = await dataService.confirmCarePlan(mockPatientId, incompleteFields);
    expect('error' in failRes).toBe(true);

    // Valid complete fields succeed
    const validFields: PrescriptionField[] = [
      { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Metoprolol Tartrate', status: 'confirmed' },
      { key: 'dosage', labelKey: 'rx_field_dosage', value: '25mg', status: 'confirmed' },
      { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Twice daily', status: 'confirmed' },
      { key: 'duration', labelKey: 'rx_field_duration', value: '30 days', status: 'confirmed' },
      { key: 'instructions', labelKey: 'rx_field_instructions', value: 'Take with food', status: 'confirmed' },
    ];
    const successRes = await dataService.confirmCarePlan(mockPatientId, validFields);
    expect('ok' in successRes).toBe(true);

    // Verify medication schedules are populated for mockPatientId
    const kavitaSchedules = await dataService.fetchMedicationSchedules(mockPatientId);
    expect(kavitaSchedules.length).toBeGreaterThan(0);
    expect(kavitaSchedules[0].medicineName).toBe('Metoprolol Tartrate');
    expect(kavitaSchedules[0].status).toBe('pending');

    // Verify patient data isolation: p1 demo schedules remain intact and not overwritten
    const p1Schedules = await dataService.fetchMedicationSchedules('p1');
    expect(p1Schedules.some((s) => s.medicineName === 'Atorvastatin')).toBe(true);
  });

  it("3. Patient dashboard displays doctor-confirmed medication schedule and clears awaiting-review banner", () => {
    const confirmedDraft: PrescriptionDraft = {
      ...mockDraft,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
    };

    const activeSchedule = [
      {
        id: 's-kavita-1',
        medicineId: 'm-101',
        medicineName: 'Metoprolol Tartrate',
        dosage: '25mg',
        scheduledTime: '08:00',
        status: 'pending' as const,
        instructions: 'Take with food',
      },
    ];

    render(
      <LanguageProvider initialLang="en">
        <PatientDashboard
          patient={mockPatient}
          patientId={mockPatientId}
          schedules={activeSchedule}
          followUps={[]}
          prescriptionDraft={confirmedDraft}
          onDoseAction={vi.fn()}
          onHealthUpdate={vi.fn()}
          onFollowUpAnswer={vi.fn()}
          onBack={vi.fn()}
        />
      </LanguageProvider>
    );

    // Confirmed medicine is visible on the dashboard
    expect(screen.getByText('Metoprolol Tartrate')).toBeInTheDocument();
    expect(screen.getByText('25mg')).toBeInTheDocument();
    expect(screen.getByText('Kavita Rao')).toBeInTheDocument();

    // The "Prescription Uploaded — Awaiting Doctor Review & Lock" banner should NOT be displayed
    expect(screen.queryByText(/Awaiting Doctor Review & Lock/i)).not.toBeInTheDocument();
  });

  it('4. Care-gap status updates do not leak between different patient IDs', async () => {
    // Seed care gap for mock patient
    await dataService.createCareGap({
      patientId: mockPatientId,
      type: 'new_symptom',
      evidence: 'Kavita shortness of breath',
      timestamp: new Date().toISOString(),
      missingInfo: null,
      followupQuestion: 'Shortness of breath on stairs?',
      status: 'open',
    });

    const kavitaGapsBefore = await dataService.fetchCareGaps(mockPatientId);
    expect(kavitaGapsBefore.length).toBeGreaterThan(0);
    const targetGapId = kavitaGapsBefore[0].id;

    // Doctor plans follow-up on Kavita's gap
    const updateRes = await dataService.updateCareGapStatus(targetGapId, 'followup_planned');
    expect('ok' in updateRes).toBe(true);

    const kavitaGapsAfter = await dataService.fetchCareGaps(mockPatientId);
    const updated = kavitaGapsAfter.find((g) => g.id === targetGapId);
    expect(updated?.status).toBe('followup_planned');

    // Patient p1 care gaps are separate
    const p1Gaps = await dataService.fetchCareGaps('p1');
    expect(p1Gaps.every((g) => g.id !== targetGapId)).toBe(true);
  });

  it('5. Closed-loop care actions isolate patient boundaries', () => {
    // Reset store
    careActionService.resetToDemo();

    const res = careActionService.create({
      patientId: mockPatientId,
      title: 'Post-op Echocardiogram Recheck',
      description: 'Assess left ventricular ejection fraction post-symptom report',
      priority: 'urgent',
      assignedRole: 'doctor',
      assignedTo: 'Dr. S. Sharma',
    });

    expect(res.success).toBe(true);
    if (!res.success) throw new Error(res.error);

    const newAction = res.data;
    expect(newAction.patientId).toBe(mockPatientId);
    expect(newAction.status).toBe('open');

    // Only Kavita's list contains this action
    const kavitaActions = careActionService.getByPatient(mockPatientId);
    expect(kavitaActions.some((a) => a.id === newAction.id)).toBe(true);

    // Other patients do NOT contain Kavita's action
    const p1Actions = careActionService.getByPatient('p1');
    expect(p1Actions.some((a) => a.id === newAction.id)).toBe(false);
  });

  it('6. Existing demo patient (Ravi Sharma) workflows continue to function correctly', () => {
    const p1Summary: PatientSummary = {
      patient: demoPatients[0],
      dosesToday: { taken: 2, missed: 0, pending: 2, total: 4 },
      adherence7Day: 85,
      latestUpdate: null,
      openGaps: 1,
      gapReasons: ['Chest heaviness reported'],
      lastUpdateAt: new Date().toISOString(),
      priority: 'urgent',
      triageScore: 100,
      criticalSafetyOverride: true,
      criticalAlertMessage: 'Emergency protocol: chest heaviness',
    };

    render(
      <LanguageProvider initialLang="en">
        <DoctorDashboard
          summaries={[p1Summary]}
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

    // Critical emergency override banner for Ravi Sharma appears
    expect(screen.getByText(/Emergency Protocol Triggered/i)).toBeInTheDocument();
    expect(screen.getAllByText('Ravi Sharma')[0]).toBeInTheDocument();
  });
});
