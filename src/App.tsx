import { useState, useCallback, useEffect, useRef } from 'react';
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
  const activePatientIdRef = useRef<string>(DEMO_PATIENT_ID);
  const [currentPatient, setCurrentPatient] = useState<PatientProfile | null>(() => demoPatients.find((p) => p.id === DEMO_PATIENT_ID) ?? null);
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
        const targetId = activePatientIdRef.current || DEMO_PATIENT_ID;
        const [sched, drafts, gaps, fUps, summs, fam, rep, pat] = await Promise.all([
          dataService.fetchMedicationSchedules(targetId),
          dataService.fetchPrescriptionDraft(targetId),
          dataService.fetchCareGaps(targetId),
          dataService.fetchFollowUps(targetId),
          dataService.fetchPatientSummaries(),
          dataService.fetchFamilyView(targetId),
          dataService.fetchMedicalReports(targetId),
          dataService.fetchPatient(targetId),
        ]);
        if (!mounted) return;
        if (pat) setCurrentPatient(pat);
        if (sched && sched.length > 0) {
          setSchedules(sched);
        } else if (targetId === DEMO_PATIENT_ID) {
          setSchedules(demoSchedules[DEMO_PATIENT_ID] ?? []);
        } else {
          setSchedules([]);
        }
        if (drafts) setPrescriptionDrafts((prev) => ({ ...prev, [targetId]: drafts }));
        if (gaps && gaps.length > 0) setCareGaps((prev) => ({ ...prev, [targetId]: gaps }));
        if (fUps && fUps.length > 0) setFollowUps((prev) => ({ ...prev, [targetId]: fUps }));
        if (summs && summs.length > 0) setSummaries(summs);
        if (fam) setFamilyView(fam);
        if (rep && rep.length > 0) setReports((prev) => ({ ...prev, [targetId]: rep }));
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
  }, [setView]);

  const handleIntakeComplete = useCallback(async (profile: Partial<PatientProfile>, file: File | null) => {
    try {
      const res = await dataService.savePatientIntake(profile);
      if ('error' in res || !res.data) {
        console.error('Failed to save patient intake:', 'error' in res ? res.error : 'Unknown error');
        return;
      }

      const newPatient = res.data;
      const newPatientId = newPatient.id;

      activePatientIdRef.current = newPatientId;
      setActivePatientId(newPatientId);
      setCurrentPatient(newPatient);
      setPatientProfile(newPatient);

      if (file) {
        const uploadRes = await dataService.uploadPrescriptionImage(newPatientId, file);
        if ('url' in uploadRes) {
          setPrescriptionPreview(uploadRes.url);
          await dataService.savePrescriptionDraft(newPatientId, uploadRes.url, [
            { key: 'medicine', labelKey: 'rx_field_medicine', value: newPatient.currentMeds || 'Prescribed Medicine', status: 'uncertain' },
            { key: 'dosage', labelKey: 'rx_field_dosage', value: 'As directed', status: 'uncertain' },
            { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily', status: 'uncertain' },
            { key: 'duration', labelKey: 'rx_field_duration', value: '5 days', status: 'uncertain' },
            { key: 'instructions', labelKey: 'rx_field_instructions', value: 'Take after meals', status: 'uncertain' },
          ]);
        }
      }

      setView('patient_processing');
    } catch (err) {
      console.error('Error during intake completion:', err);
    }
  }, [setView]);

  const handleProcessingComplete = useCallback(async () => {
    const targetPatientId = activePatientIdRef.current || activePatientId;
    try {
      const [sched, userFollowUps, userReports, userPatient] = await Promise.all([
        dataService.fetchMedicationSchedules(targetPatientId),
        dataService.fetchFollowUps(targetPatientId),
        dataService.fetchMedicalReports(targetPatientId),
        dataService.fetchPatient(targetPatientId),
      ]);

      if (userPatient) {
        setCurrentPatient(userPatient);
      }
      if (sched && sched.length > 0) {
        setSchedules(sched);
      } else if (targetPatientId === DEMO_PATIENT_ID) {
        setSchedules(demoSchedules[DEMO_PATIENT_ID] ?? []);
      } else {
        setSchedules([]);
      }
      if (userFollowUps && userFollowUps.length > 0) {
        setFollowUps((prev) => ({ ...prev, [targetPatientId]: userFollowUps }));
      }
      if (userReports && userReports.length > 0) {
        setReports((prev) => ({ ...prev, [targetPatientId]: userReports }));
      }
    } catch (err) {
      console.warn('Could not fetch patient data after processing:', err);
      if (targetPatientId === DEMO_PATIENT_ID) {
        setSchedules(demoSchedules[DEMO_PATIENT_ID] ?? []);
      } else {
        setSchedules([]);
      }
    }
    setView('patient_dashboard');
  }, [activePatientId, setView]);

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
    const targetPatientId = activePatientIdRef.current || activePatientId;
    const patient = currentPatient || demoPatients.find((p) => p.id === targetPatientId) || {
      id: targetPatientId,
      name: 'Patient',
      age: 40,
      gender: 'other' as const,
      phone: '',
      symptoms: '',
      allergies: 'None',
      currentMeds: '',
      language: 'hi' as const,
    };

    const updateRes = await dataService.submitHealthUpdate(targetPatientId, state, description);
    const newUpdate = 'data' in updateRes ? updateRes.data : {
      id: `h-new-${Date.now()}`,
      patientId: targetPatientId,
      state,
      symptomDescription: description,
      submittedAt: new Date().toISOString(),
      source: 'patient' as const,
    };

    const existingUpdates = demoHealthUpdates[targetPatientId] ?? [];
    const allUpdates = [newUpdate, ...existingUpdates];
    const allSchedules = schedules;
    const allFollowUps = followUps[targetPatientId] ?? [];

    const { gaps: newGaps } = detectCareGaps(patient, allUpdates, allSchedules, allFollowUps);

    for (const gap of newGaps) {
      await dataService.createCareGap({ ...gap, status: 'open' });
    }

    setCareGaps((prev) => {
      const existing = prev[targetPatientId] ?? [];
      const withIds = newGaps.map((g) => ({
        ...g,
        id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'open' as const,
      }));
      const filtered = withIds.filter((ng) => !existing.some((eg) => eg.type === ng.type && eg.evidence === ng.evidence));
      return {
        ...prev,
        [targetPatientId]: [...filtered, ...existing],
      };
    });
  }, [activePatientId, currentPatient, schedules, followUps]);

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
          patient={currentPatient}
          patientId={activePatientId}
          schedules={schedules}
          followUps={followUps[activePatientId] ?? []}
          reports={reports[activePatientId] ?? []}
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
