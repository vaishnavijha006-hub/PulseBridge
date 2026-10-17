import { useState, useCallback } from 'react';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { LandingPage } from '@/pages/LandingPage';
import { PatientIntakeWizard } from '@/pages/PatientIntakeWizard';
import { PrescriptionProcessing } from '@/pages/PrescriptionProcessing';
import { PatientDashboard } from '@/pages/PatientDashboard';
import { DoctorDashboard } from '@/pages/DoctorDashboard';
import { FamilyRecoveryCircle } from '@/pages/FamilyRecoveryCircle';
import { dataService } from '@/services/dataService';
import { detectCareGaps } from '@/services/careGapRules';
import {
  getPatientSummaries,
  demoSchedules,
  demoCareGaps,
  demoPrescriptionDrafts,
  demoFollowUps,
  demoFamilyView,
  demoPatients,
  demoHealthUpdates,
} from '@/data/demoData';
import type { PatientProfile, MedicationSchedule, DoseStatus, HealthState, CareGap, PrescriptionDraft, FollowUp, PrescriptionField } from '@/types';

type View = 'landing' | 'patient_intake' | 'patient_processing' | 'patient_dashboard' | 'doctor' | 'family';

const DEMO_PATIENT_ID = 'p1';

function AppContent() {
  const [view, setView] = useState<View>('landing');
  const [prescriptionPreview, setPrescriptionPreview] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<MedicationSchedule[]>(demoSchedules[DEMO_PATIENT_ID] ?? []);
  const [careGaps, setCareGaps] = useState<Record<string, CareGap[]>>(demoCareGaps);
  const [prescriptionDrafts, setPrescriptionDrafts] = useState<Record<string, PrescriptionDraft>>(demoPrescriptionDrafts);
  const [followUps, setFollowUps] = useState<Record<string, FollowUp[]>>(demoFollowUps);
  const [patientProfile, setPatientProfile] = useState<Partial<PatientProfile> | null>(null);

  const handleRoleSelect = useCallback((role: 'patient' | 'doctor' | 'family') => {
    if (role === 'patient') setView('patient_intake');
    else if (role === 'doctor') setView('doctor');
    else setView('family');
  }, []);

  const handleIntakeComplete = useCallback((profile: Partial<PatientProfile>, _file: File | null) => {
    setPatientProfile(profile);
    setView('patient_processing');
  }, []);

  const handleProcessingComplete = useCallback(() => {
    setSchedules(demoSchedules[DEMO_PATIENT_ID] ?? []);
    setView('patient_dashboard');
  }, []);

  const handleDoseAction = useCallback((scheduleId: string, action: DoseStatus) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === scheduleId ? { ...s, status: action } : s)),
    );
    void dataService.recordAdherence(scheduleId, action);
  }, []);

  const handleHealthUpdate = useCallback((state: HealthState, description: string) => {
    const patient = demoPatients.find((p) => p.id === DEMO_PATIENT_ID);
    if (!patient) return;

    const newUpdate = {
      id: `h-new-${Date.now()}`,
      patientId: DEMO_PATIENT_ID,
      state,
      symptomDescription: description,
      submittedAt: new Date().toISOString(),
      source: 'patient' as const,
    };

    const allUpdates = [newUpdate, ...(demoHealthUpdates[DEMO_PATIENT_ID] ?? [])];
    const allSchedules = schedules;
    const allFollowUps = followUps[DEMO_PATIENT_ID] ?? [];

    const { gaps: newGaps } = detectCareGaps(patient, allUpdates, allSchedules, allFollowUps);

    setCareGaps((prev) => {
      const existing = prev[DEMO_PATIENT_ID] ?? [];
      const withIds = newGaps.map((g) => ({
        ...g,
        id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'open' as const,
      }));
      const filtered = withIds.filter((ng) => !existing.some((eg) => eg.type === ng.type && eg.evidence === ng.evidence));
      return {
        ...prev,
        [DEMO_PATIENT_ID]: [...filtered, ...existing],
      };
    });
  }, [schedules, followUps]);

  const handleFollowUpAnswer = useCallback((followUpId: string, answer: string) => {
    setFollowUps((prev) => {
      const updated = { ...prev };
      for (const pid of Object.keys(updated)) {
        updated[pid] = updated[pid].map((f) =>
          f.id === followUpId
            ? { ...f, answer, answeredAt: new Date().toISOString(), status: 'answered' as const }
            : f,
        );
      }
      return updated;
    });
    void dataService.updateFollowUp(followUpId, answer);
  }, []);

  const handleConfirmCarePlan = useCallback((patientId: string, fields: PrescriptionField[]) => {
    setPrescriptionDrafts((prev) => ({
      ...prev,
      [patientId]: prev[patientId] ? { ...prev[patientId], confirmed: true, fields } : prev[patientId],
    }));
    void dataService.confirmCarePlan(patientId, fields);
  }, []);

  const handleCareGapAction = useCallback((gapId: string, action: 'reviewed' | 'followup_planned') => {
    setCareGaps((prev) => {
      const updated = { ...prev };
      for (const pid of Object.keys(updated)) {
        updated[pid] = updated[pid].map((g) =>
          g.id === gapId ? { ...g, status: action } : g,
        );
      }
      return updated;
    });
    void dataService.updateCareGapStatus(gapId, action);
  }, []);

  const handleFamilyToggleAccess = useCallback((authorized: boolean) => {
    void dataService.updateCaregiverAccess(DEMO_PATIENT_ID, authorized);
  }, []);

  void patientProfile;
  const summaries = getPatientSummaries();

  return (
    <>
      {view === 'landing' && <LandingPage onRoleSelect={handleRoleSelect} />}
      {view === 'patient_intake' && (
        <PatientIntakeWizard
          onComplete={(profile, file) => {
            if (file) setPrescriptionPreview(URL.createObjectURL(file));
            handleIntakeComplete(profile, file);
          }}
          onBack={() => setView('landing')}
        />
      )}
      {view === 'patient_processing' && (
        <PrescriptionProcessing
          imageUrl={prescriptionPreview}
          onComplete={handleProcessingComplete}
          onBack={() => setView('patient_intake')}
        />
      )}
      {view === 'patient_dashboard' && (
        <PatientDashboard
          schedules={schedules}
          followUps={followUps[DEMO_PATIENT_ID] ?? []}
          onDoseAction={handleDoseAction}
          onHealthUpdate={handleHealthUpdate}
          onFollowUpAnswer={handleFollowUpAnswer}
          onBack={() => setView('landing')}
        />
      )}
      {view === 'doctor' && (
        <DoctorDashboard
          summaries={summaries}
          careGaps={careGaps}
          prescriptionDrafts={prescriptionDrafts}
          followUps={followUps}
          onConfirmCarePlan={handleConfirmCarePlan}
          onCareGapAction={handleCareGapAction}
          onBack={() => setView('landing')}
        />
      )}
      {view === 'family' && (
        <FamilyRecoveryCircle
          view={{ ...demoFamilyView, caregiverAccess: { ...demoFamilyView.caregiverAccess } }}
          onBack={() => setView('landing')}
          onToggleAccess={handleFamilyToggleAccess}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider initialLang="hi">
      <AppContent />
    </LanguageProvider>
  );
}
