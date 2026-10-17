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

function getViewFromLocation(): View {
  if (typeof window === 'undefined') return 'landing';
  const params = new URLSearchParams(window.location.search);
  const q = params.get('view') || params.get('tab') || params.get('page');
  if (q && ['landing', 'patient_intake', 'patient_processing', 'patient_dashboard', 'doctor', 'family', 'admin'].includes(q)) {
    return q as View;
  }
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === 'intake' || hash === 'patient-intake' || hash === 'patient_intake') {
    return 'patient_intake';
  }
  if (hash === 'patient' || hash === 'patient-dashboard' || hash === 'patient_dashboard') {
    return 'patient_dashboard';
  }
  if (hash === 'doctor') return 'doctor';
  if (hash === 'family') return 'family';
  if (hash === 'admin') return 'admin';
  return 'landing';
}

function AppContent() {
  const [view, setViewState] = useState<View>(() => getViewFromLocation());

  const setView = useCallback((nextView: View) => {
    setViewState(nextView);
    if (typeof window !== 'undefined') {
      const hash = nextView === 'landing' ? '' : `#${nextView.replace('_', '-')}`;
      const url = hash ? `${window.location.pathname}${hash}` : window.location.pathname;
      window.history.pushState(null, '', url);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setViewState(getViewFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);
  const [activePatientId, setActivePatientId] = useState<string>(DEMO_PATIENT_ID);
  const [prescriptionPreview, setPrescriptionPreview] = useState<string | null>(null);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
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
          dataService.fetchMedicationSchedules(activePatientId),
          dataService.fetchPrescriptionDraft(activePatientId),
          dataService.fetchCareGaps(activePatientId),
          dataService.fetchFollowUps(activePatientId),
          dataService.fetchPatientSummaries(),
          dataService.fetchFamilyView(activePatientId),
          dataService.fetchMedicalReports(activePatientId),
        ]);
        if (!mounted) return;
        if (sched) setSchedules(sched);
        if (drafts) setPrescriptionDrafts((prev) => ({ ...prev, [activePatientId]: drafts }));
        if (gaps && gaps.length > 0) setCareGaps((prev) => ({ ...prev, [activePatientId]: gaps }));
        if (fUps && fUps.length > 0) setFollowUps((prev) => ({ ...prev, [activePatientId]: fUps }));
        if (summs && summs.length > 0) setSummaries(summs);
        if (fam) setFamilyView(fam);
        if (rep && rep.length > 0) setReports((prev) => ({ ...prev, [activePatientId]: rep }));
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
  }, [activePatientId]);

  const handleRoleSelect = useCallback((role: 'patient' | 'doctor' | 'family' | 'admin' | 'patient_intake') => {
    if (role === 'patient') setView('patient_dashboard');
    else if (role === 'patient_intake') setView('patient_intake');
    else if (role === 'doctor') setView('doctor');
    else if (role === 'admin') setView('admin');
    else setView('family');
  }, []);

  const handleIntakeComplete = useCallback(async (profile: Partial<PatientProfile>, file: File | null) => {
    setPatientProfile(profile);
    setPrescriptionFile(file);

    // 1. Establish patient entity and capture the actual returned patient ID
    const saveRes = await dataService.savePatientIntake(profile);
    if ('error' in saveRes || !saveRes.data?.id) {
      console.error('Failed to save patient intake:', 'error' in saveRes ? saveRes.error : 'No patient ID returned');
      return; // Stop downstream scan rather than attaching to a different patient
    }

    const newPatientId = saveRes.data.id;
    setActivePatientId(newPatientId);

    // 2. Upload prescription image under new patient ID if file present
    if (file) {
      const uploadRes = await dataService.uploadPrescriptionImage(newPatientId, file);
      if ('url' in uploadRes) {
        setPrescriptionPreview(uploadRes.url);
      }
    }

    setView('patient_processing');
  }, []);

  const handleProcessingComplete = useCallback(async (draft?: PrescriptionDraft) => {
    const targetPatientId = draft?.patientId || activePatientId;
    if (draft) {
      setPrescriptionDrafts((prev) => ({
        ...prev,
        [targetPatientId]: draft,
      }));
    }
    const sched = await dataService.fetchMedicationSchedules(targetPatientId);
    setSchedules(sched.length > 0 ? sched : (targetPatientId === DEMO_PATIENT_ID ? (demoSchedules[DEMO_PATIENT_ID] ?? []) : []));
    setView('patient_dashboard');
  }, [activePatientId]);

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
    const patient =
      patientProfile?.id === activePatientId
        ? (patientProfile as PatientProfile)
        : demoPatients.find((p) => p.id === activePatientId) || demoPatients.find((p) => p.id === DEMO_PATIENT_ID);
    if (!patient) return;

    const updateRes = await dataService.submitHealthUpdate(activePatientId, state, description);
    const newUpdate = 'data' in updateRes ? updateRes.data : {
      id: `h-new-${Date.now()}`,
      patientId: activePatientId,
      state,
      symptomDescription: description,
      submittedAt: new Date().toISOString(),
      source: 'patient' as const,
    };

    const allUpdates = [newUpdate, ...(demoHealthUpdates[activePatientId] ?? [])];
    const allSchedules = schedules;
    const allFollowUps = followUps[activePatientId] ?? [];

    const { gaps: newGaps } = detectCareGaps(patient, allUpdates, allSchedules, allFollowUps);

    for (const gap of newGaps) {
      await dataService.createCareGap({ ...gap, status: 'open' });
    }

    setCareGaps((prev) => {
      const existing = prev[activePatientId] ?? [];
      const withIds = newGaps.map((g) => ({
        ...g,
        id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'open' as const,
      }));
      const filtered = withIds.filter((ng) => !existing.some((eg) => eg.type === ng.type && eg.evidence === ng.evidence));
      return {
        ...prev,
        [activePatientId]: [...filtered, ...existing],
      };
    });
  }, [activePatientId, patientProfile, schedules, followUps]);

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
      return res;
    }

    // 1. Update prescription draft in state
    setPrescriptionDrafts((prev) => ({
      ...prev,
      [patientId]: prev[patientId]
        ? {
            ...prev[patientId],
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            confirmedBy: 'Dr. Anita Desai, MD',
            fields: fields.map((f) => ({ ...f, status: 'confirmed' })),
            status: 'doctor_approved',
          }
        : {
            id: `rx-${patientId}`,
            patientId,
            imageUrl: '',
            uploadedAt: new Date().toISOString(),
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            confirmedBy: 'Dr. Anita Desai, MD',
            fields: fields.map((f) => ({ ...f, status: 'confirmed' })),
            status: 'doctor_approved',
          },
    }));

    // 2. Refresh medication schedules from data service
    const refreshedSchedules = await dataService.fetchMedicationSchedules(patientId);

    // 3. Update schedules in state if this patient is the active patient (prevent stale async overwrite)
    if (patientId === activePatientId) {
      setSchedules(refreshedSchedules);
    }

    // 4. Refresh patient summaries for doctor dashboard
    try {
      const updatedSummaries = await dataService.fetchPatientSummaries();
      if (updatedSummaries && updatedSummaries.length > 0) {
        setSummaries(updatedSummaries);
      }
    } catch {
      // Keep existing summaries if fetch fails
    }

    return res;
  }, [activePatientId]);

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
    await dataService.updateCaregiverAccess(activePatientId, authorized);
    const updated = await dataService.fetchFamilyView(activePatientId);
    if (updated) {
      setFamilyView(updated);
    } else {
      setFamilyView((prev) => ({
        ...prev,
        caregiverAccess: { ...prev.caregiverAccess, authorized },
      }));
    }
  }, [activePatientId]);

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
          file={prescriptionFile}
          patientId={activePatientId}
          onComplete={handleProcessingComplete}
          onBack={() => setView('patient_intake')}
        />
      )}
      {view === 'patient_dashboard' && (
        <PatientDashboard
          schedules={schedules}
          followUps={followUps[activePatientId] ?? []}
          prescriptionDraft={prescriptionDrafts[activePatientId] ?? null}
          reports={reports[activePatientId] ?? []}
          patientId={activePatientId}
          patientProfile={patientProfile}
          onDoseAction={handleDoseAction}
          onHealthUpdate={handleHealthUpdate}
          onFollowUpAnswer={handleFollowUpAnswer}
          onBack={() => setView('landing')}
          onNavigateRole={(role) => {
            if (role === 'doctor') setView('doctor');
            else if (role === 'admin') setView('admin');
            else if (role === 'patient_intake') setView('patient_intake');
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
          onNavigateRole={(role) => {
            if (role === 'doctor') setView('doctor');
            else if (role === 'patient') setView('patient_dashboard');
            else if (role === 'admin') setView('admin');
          }}
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
