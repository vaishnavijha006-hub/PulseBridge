import { useState, useCallback, useEffect } from 'react';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { LandingPage } from '@/pages/LandingPage';
import { PatientIntakeWizard } from '@/pages/PatientIntakeWizard';
import { PrescriptionProcessing } from '@/pages/PrescriptionProcessing';
import { PatientDashboard } from '@/pages/PatientDashboard';
import { DoctorDashboard } from '@/pages/DoctorDashboard';
import { FamilyRecoveryCircle } from '@/pages/FamilyRecoveryCircle';
import { AdminDashboard } from '@/pages/AdminDashboard';
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
  demoMedicalReports,
} from '@/data/demoData';
import type {
  PatientProfile,
  MedicationSchedule,
  DoseStatus,
  HealthState,
  CareGap,
  PrescriptionDraft,
  FollowUp,
  PrescriptionField,
  PatientSummary,
  FamilyView,
  MedicalReport,
} from '@/types';

type View = 'landing' | 'patient_intake' | 'patient_processing' | 'patient_dashboard' | 'doctor' | 'family' | 'admin';

const DEMO_PATIENT_ID = 'p1';

function AppContent() {
  const [view, setView] = useState<View>('landing');
  const [prescriptionPreview, setPrescriptionPreview] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<MedicationSchedule[]>(demoSchedules[DEMO_PATIENT_ID] ?? []);
  const [careGaps, setCareGaps] = useState<Record<string, CareGap[]>>(demoCareGaps);
  const [prescriptionDrafts, setPrescriptionDrafts] = useState<Record<string, PrescriptionDraft>>(demoPrescriptionDrafts);
  const [followUps, setFollowUps] = useState<Record<string, FollowUp[]>>(demoFollowUps);
  const [reports, setReports] = useState<Record<string, MedicalReport[]>>(demoMedicalReports);
  const [patientProfile, setPatientProfile] = useState<Partial<PatientProfile> | null>(null);
  const [familyView, setFamilyView] = useState<FamilyView>(demoFamilyView);

  const [summaries, setSummaries] = useState<PatientSummary[]>(getPatientSummaries());

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [sched, drafts, gaps, fUps, summs, fam, rep] = await Promise.all([
          dataService.fetchMedicationSchedules(DEMO_PATIENT_ID),
          dataService.fetchPrescriptionDraft(DEMO_PATIENT_ID),
          dataService.fetchCareGaps(DEMO_PATIENT_ID),
          dataService.fetchFollowUps(DEMO_PATIENT_ID),
          dataService.fetchPatientSummaries(),
          dataService.fetchFamilyView(DEMO_PATIENT_ID),
          dataService.fetchMedicalReports(DEMO_PATIENT_ID),
        ]);
        if (!mounted) return;
        if (sched && sched.length > 0) setSchedules(sched);
        if (drafts) setPrescriptionDrafts((prev) => ({ ...prev, [DEMO_PATIENT_ID]: drafts }));
        if (gaps && gaps.length > 0) setCareGaps((prev) => ({ ...prev, [DEMO_PATIENT_ID]: gaps }));
        if (fUps && fUps.length > 0) setFollowUps((prev) => ({ ...prev, [DEMO_PATIENT_ID]: fUps }));
        if (summs && summs.length > 0) setSummaries(summs);
        if (fam) setFamilyView(fam);
        if (rep && rep.length > 0) setReports((prev) => ({ ...prev, [DEMO_PATIENT_ID]: rep }));
      } catch (err) {
        console.warn('Could not fetch remote data, keeping initialized state:', err);
      }
    }
    void loadData();

    // Subscribe to Realtime / Live updates across schedules, updates, gaps
    const unsubscribe = dataService.subscribeToLiveUpdates(() => {
      void loadData();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleRoleSelect = useCallback((role: 'patient' | 'doctor' | 'family' | 'admin' | 'patient_intake') => {
    if (role === 'patient') setView('patient_dashboard');
    else if (role === 'patient_intake') setView('patient_intake');
    else if (role === 'doctor') setView('doctor');
    else if (role === 'admin') setView('admin');
    else setView('family');
  }, []);

  const handleIntakeComplete = useCallback(async (profile: Partial<PatientProfile>, file: File | null) => {
    setPatientProfile(profile);
    if (file) {
      const uploadRes = await dataService.uploadPrescriptionImage(DEMO_PATIENT_ID, file);
      if ('url' in uploadRes) {
        setPrescriptionPreview(uploadRes.url);
      }
    }
    await dataService.savePatientIntake(profile);
    setView('patient_processing');
  }, []);

  const handleProcessingComplete = useCallback(async () => {
    const sched = await dataService.fetchMedicationSchedules(DEMO_PATIENT_ID);
    setSchedules(sched.length > 0 ? sched : demoSchedules[DEMO_PATIENT_ID] ?? []);
    setView('patient_dashboard');
  }, []);

  const handleDoseAction = useCallback(async (scheduleId: string, action: DoseStatus, reason?: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === scheduleId ? { ...s, status: action, reason: reason || s.reason } : s)),
    );
    const res = await dataService.recordAdherence(scheduleId, action, reason);
    if ('error' in res) {
      console.error('Failed to record adherence:', res.error);
    }
  }, []);


  const handleHealthUpdate = useCallback(async (state: HealthState, description: string) => {
    const patient = demoPatients.find((p) => p.id === DEMO_PATIENT_ID);
    if (!patient) return;

    const updateRes = await dataService.submitHealthUpdate(DEMO_PATIENT_ID, state, description);
    const newUpdate = 'data' in updateRes ? updateRes.data : {
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

    for (const gap of newGaps) {
      await dataService.createCareGap({ ...gap, status: 'open' });
    }


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

  const handleFollowUpAnswer = useCallback(async (followUpId: string, answer: string) => {
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
    await dataService.updateFollowUp(followUpId, answer);
  }, []);

  const handleConfirmCarePlan = useCallback(async (patientId: string, fields: PrescriptionField[]) => {
    const res = await dataService.confirmCarePlan(patientId, fields);
    if ('error' in res) {
      console.error('Cannot confirm care plan:', res.error);
      return;
    }
    setPrescriptionDrafts((prev) => ({
      ...prev,
      [patientId]: prev[patientId] ? { ...prev[patientId], confirmed: true, fields } : prev[patientId],
    }));
  }, []);

  const handleCareGapAction = useCallback(async (gapId: string, action: 'reviewed' | 'followup_planned') => {
    setCareGaps((prev) => {
      const updated = { ...prev };
      for (const pid of Object.keys(updated)) {
        updated[pid] = updated[pid].map((g) =>
          g.id === gapId ? { ...g, status: action } : g,
        );
      }
      return updated;
    });
    await dataService.updateCareGapStatus(gapId, action);
  }, []);

  const handleFamilyToggleAccess = useCallback(async (authorized: boolean) => {
    await dataService.updateCaregiverAccess(DEMO_PATIENT_ID, authorized);
    const updated = await dataService.fetchFamilyView(DEMO_PATIENT_ID);
    if (updated) {
      setFamilyView(updated);
    } else {
      setFamilyView((prev) => ({
        ...prev,
        caregiverAccess: { ...prev.caregiverAccess, authorized },
      }));
    }
  }, []);

  void patientProfile;


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
          reports={reports[DEMO_PATIENT_ID] ?? []}
          onDoseAction={handleDoseAction}
          onHealthUpdate={handleHealthUpdate}
          onFollowUpAnswer={handleFollowUpAnswer}
          onBack={() => setView('landing')}
          onNavigateRole={(role) => {
            if (role === 'doctor') setView('doctor');
            else if (role === 'admin') setView('admin');
            else setView('family');
          }}
        />
      )}
      {view === 'doctor' && (
        <DoctorDashboard
          summaries={summaries}
          careGaps={careGaps}
          prescriptionDrafts={prescriptionDrafts}
          followUps={followUps}
          reports={reports}
          onConfirmCarePlan={handleConfirmCarePlan}
          onCareGapAction={handleCareGapAction}
          onBack={() => setView('landing')}
          onNavigateRole={(role) => {
            if (role === 'patient') setView('patient_dashboard');
            else if (role === 'admin') setView('admin');
            else setView('family');
          }}
        />
      )}
      {view === 'family' && (
        <FamilyRecoveryCircle
          view={familyView}
          onBack={() => setView('landing')}
          onToggleAccess={handleFamilyToggleAccess}
        />
      )}
      {view === 'admin' && (
        <AdminDashboard
          onBack={() => setView('landing')}
          onNavigateRole={(role) => {
            if (role === 'doctor') setView('doctor');
            else if (role === 'patient') setView('patient_dashboard');
            else setView('family');
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
