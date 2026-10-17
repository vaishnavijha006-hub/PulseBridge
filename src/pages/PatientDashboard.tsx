import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Check,
  Clock,
  X,
  Bell,
  Pill,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  HelpCircle,
  FileText,
  Calendar,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  User,
  HeartPulse,
  ChevronLeft,
  Users,
} from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { DemoBadge } from '@/components/DemoBanner';
import { StatusBadge } from '@/components/StatusBadge';
import { FamilyConsentManager } from '@/components/FamilyConsentManager';
import { cn } from '@/utils/cn';
import { useLanguage } from '@/i18n/LanguageContext';
import { evaluateDoseTiming, DOSE_REASON_OPTIONS, applyOverdueEvaluations, generateReminders } from '@/utils/reminderEngine';
import { evaluatePrescriptionSafety } from '@/services/prescriptionSafetyWorkflow';
import type { MedicationSchedule, DoseStatus, HealthState, FollowUp, PrescriptionDraft, MedicalReport, PatientProfile } from '@/types';
import { demoMedicalReports } from '@/data/demoData';

interface PatientDashboardProps {
  schedules: MedicationSchedule[];
  followUps: FollowUp[];
  prescriptionDraft?: PrescriptionDraft | null;
  reports?: MedicalReport[];
  patientId?: string;
  patientProfile?: Partial<PatientProfile> | null;
  onDoseAction: (scheduleId: string, action: DoseStatus, reason?: string) => void;
  onHealthUpdate: (state: HealthState, description: string) => void;
  onFollowUpAnswer: (followUpId: string, answer: string) => void;
  onBack: () => void;
  onNavigateRole?: (role: 'doctor' | 'admin' | 'family' | 'patient_intake') => void;
}

type PatientTab = 'meds' | 'reports' | 'checkin' | 'family';

export function PatientDashboard({
  schedules: initialSchedules,
  followUps,
  prescriptionDraft,
  reports = demoMedicalReports['p1'] ?? [],
  patientId,
  patientProfile,
  onDoseAction,
  onHealthUpdate,
  onFollowUpAnswer,
  onBack,
  onNavigateRole,
}: PatientDashboardProps) {
  const { t, lang } = useLanguage();
  const displayName = patientProfile?.name || (patientId === 'p1' ? 'Ravi Sharma' : (patientId || 'Patient'));
  const displayId = patientId || 'p1';
  const initialLetter = (displayName[0] || 'P').toUpperCase();
  const [schedules, setSchedules] = useState<MedicationSchedule[]>(initialSchedules);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PatientTab>('meds');

  // Sync internal schedules with prop and apply 20-minute grace window overdue calculations
  useEffect(() => {
    const { schedules: evaluated } = applyOverdueEvaluations(initialSchedules);
    setSchedules(evaluated);
  }, [initialSchedules]);

  // Periodic ticker every 60s to re-check grace windows and overdue doses
  useEffect(() => {
    const interval = setInterval(() => {
      setSchedules((prev) => {
        const { schedules: updated, overdueCount } = applyOverdueEvaluations(prev);
        return overdueCount > 0 ? updated : prev;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleDoseAction = useCallback(
    (scheduleId: string, action: DoseStatus, medName: string, reason?: string) => {
      try {
        onDoseAction(scheduleId, action, reason);
        if (action === 'taken') {
          setConfirmation(`${medName} — ${t('dose_taken_confirm')}`);
        } else if (action === 'snoozed') {
          setConfirmation(`${medName} — ${lang === 'hi' ? '10 मिनट के लिए स्नूज़ किया गया' : 'Snoozed for 10 min'}`);
        } else if (action === 'cannot_take') {
          setConfirmation(`${medName} — ${lang === 'hi' ? 'कारण दर्ज किया गया' : 'Reason recorded'}: ${reason || 'Noted'}`);
        } else if (action === 'missed') {
          setConfirmation(`${medName} — ${t('dose_missed')}`);
        }
        setTimeout(() => setConfirmation(null), 3500);
        setExpandedId(null);
      } catch {
        setError(t('error_retry'));
        setTimeout(() => setError(null), 3000);
      }
    },
    [onDoseAction, t, lang]
  );

  // Evaluate prescription safety and auto-readiness workflow status
  const isApprovalPending = Boolean(prescriptionDraft && !prescriptionDraft.confirmed);

  const patientForSafety = useMemo<PatientProfile>(
    () => ({
      id: patientId || 'p1',
      name: displayName,
      age: patientProfile?.age || 45,
      gender: patientProfile?.gender || 'other',
      phone: patientProfile?.phone || '',
      symptoms: patientProfile?.symptoms || '',
      allergies: patientProfile?.allergies ?? 'None',
      currentMeds: patientProfile?.currentMeds ?? 'None',
      language: (patientProfile?.language as any) || 'en',
    }),
    [patientId, displayName, patientProfile]
  );

  const safetyAssessment = useMemo(() => {
    if (!prescriptionDraft) return null;
    return evaluatePrescriptionSafety(prescriptionDraft, patientForSafety, schedules);
  }, [prescriptionDraft, patientForSafety, schedules]);

  const pendingFollowUps = followUps.filter((f) => f.status === 'pending');
  const rawTakenCount = schedules.filter((s) => s.status === 'taken').length;
  const rawTotalCount = schedules.length;

  // When approval is pending, do not display active schedules or reminders (Requirement 6)
  const takenCount = isApprovalPending ? 0 : rawTakenCount;
  const totalCount = isApprovalPending ? 0 : rawTotalCount;
  const progressPercent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  // Next scheduled dose helper (suppressed while approval is pending)
  const nextDose = useMemo(() => {
    if (isApprovalPending) return null;
    return schedules.find((s) => s.status === 'pending' || s.status === 'snoozed');
  }, [isApprovalPending, schedules]);

  const activeReminders = useMemo(() => {
    if (isApprovalPending) return [];
    return generateReminders(schedules, followUps);
  }, [isApprovalPending, schedules, followUps]);

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans selection:bg-teal-500/20 selection:text-teal-900">
      {/* Patient Top Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              title="Back"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('back')}</span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <PulseBridgeLogo variant="light" size="sm" showTagline={false} />
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200/70 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
              <HeartPulse className="w-3.5 h-3.5 text-teal-600" />
              <span>{t('nav_patient_dash')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Patient identity badge */}
            <div className="hidden md:flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200/80 px-2.5 py-1 text-xs">
              <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold">
                {initialLetter}
              </div>
              <span className="font-semibold text-slate-700">{displayName}</span>
              <span className="text-[10px] text-slate-400 font-mono">ID: {displayId}</span>
            </div>

            {onNavigateRole && (
              <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3 mr-1">
                <button
                  onClick={() => onNavigateRole('patient_intake')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold border border-teal-200/80 transition-colors flex items-center gap-1"
                  title={t('nav_patient_intake')}
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span className="hidden sm:inline">{t('nav_patient_intake')}</span>
                </button>
                <div className="hidden lg:flex items-center gap-1.5">
                  <button
                    onClick={() => onNavigateRole('doctor')}
                    className="px-2.5 py-1 text-xs rounded-md text-slate-600 hover:text-teal-700 hover:bg-slate-100 transition-colors"
                  >
                    {t('role_doctor')}
                  </button>
                  <button
                    onClick={() => onNavigateRole('admin')}
                    className="px-2.5 py-1 text-xs rounded-md text-slate-600 hover:text-teal-700 hover:bg-slate-100 transition-colors"
                  >
                    {t('role_admin')}
                  </button>
                </div>
              </div>
            )}

            <LanguageToggle variant="light" />
          </div>
        </div>
      </header>

      {/* Main Patient Companion Area */}
      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Reassuring Greeting & Progress Hero Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-teal-50/40 p-6 sm:p-8 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-teal-100/70 text-teal-800 px-3 py-1 text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('patient_recovery_status')}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {t('dash_namaste')}, <span className="text-teal-600 font-bold">Ravi</span>
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-lg leading-relaxed">
                {lang === 'hi'
                  ? 'आपकी देखभाल योजना डॉक्टर द्वारा सत्यापित है। आज की दवाइयां समय पर लें और अपनी सेहत का ध्यान रखें।'
                  : "Your post-discharge care regimen is verified by Dr. Sharma. Stay on track with today's medication routine."}
              </p>
            </div>

            {/* Next dose pill */}
            {nextDose && (
              <div className="rounded-2xl border border-teal-200/80 bg-teal-50/80 p-4 flex flex-col gap-1 min-w-[200px] flex-shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  Next Upcoming Dose
                </span>
                <span className="text-base font-extrabold text-slate-900 truncate">
                  {nextDose.medicineName} {nextDose.dosage}
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  {nextDose.scheduledTime} · {nextDose.instructions}
                </span>
              </div>
            )}
          </div>

          {/* Medication progress visual bar */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600">{t('patient_doses_progress')}</span>
              <span className="text-teal-700 font-mono">
                {takenCount} of {totalCount} completed ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
              <span>{t('patient_grace_notice')}</span>
            </div>
          </div>
        </div>

        {/* Floating Confirmation Toast */}
        {confirmation && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-scale-in max-w-md w-full px-4">
            <div className="flex items-center gap-3 rounded-2xl bg-teal-700 text-white px-5 py-3.5 shadow-xl border border-teal-500/30">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span className="font-semibold text-sm leading-snug">{confirmation}</span>
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-scale-in max-w-md w-full px-4">
            <div className="flex items-center gap-3 rounded-2xl bg-danger-600 text-white px-5 py-3.5 shadow-xl">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Prescription Verification Status Banner (Requirement 6) */}
        {prescriptionDraft && (
          <div
            className={cn(
              'rounded-2xl border p-4 flex items-start gap-3 transition-all',
              prescriptionDraft.confirmed
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : safetyAssessment?.workflowState === 'allergy_alert'
                ? 'border-danger-300 bg-danger-50 text-danger-900'
                : safetyAssessment?.workflowState === 'prescription_conflict'
                ? 'border-amber-400 bg-amber-50 text-amber-900'
                : safetyAssessment?.workflowState === 'uncertain_fields'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-teal-300 bg-teal-50 text-teal-900'
            )}
          >
            {prescriptionDraft.confirmed ? (
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : safetyAssessment?.workflowState === 'allergy_alert' ? (
              <ShieldAlert className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5 animate-pulse" />
            ) : safetyAssessment?.workflowState === 'prescription_conflict' ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            ) : (
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold">
                {prescriptionDraft.confirmed
                  ? 'Doctor approved — reminders activated'
                  : safetyAssessment?.patientStatusLabel || 'Prescription extracted — awaiting doctor approval'}
              </span>
              <p className="text-xs leading-relaxed opacity-90">
                {prescriptionDraft.confirmed
                  ? `Care plan verified and locked by ${prescriptionDraft.confirmedBy || 'your physician'}. Your scheduled reminders and daily medication plan are now live.`
                  : safetyAssessment?.workflowState === 'allergy_alert'
                  ? 'A potential conflict with your documented allergies was detected. For your safety, doctor review is required before medication schedules begin.'
                  : safetyAssessment?.workflowState === 'prescription_conflict'
                  ? 'A conflict with your active medications was detected. Schedule is paused awaiting doctor reconciliation.'
                  : safetyAssessment?.workflowState === 'uncertain_fields'
                  ? 'Your prescription was extracted, but dosage or duration parameters require physician verification. Schedule is paused awaiting doctor review.'
                  : 'Your prescription details have been extracted and are pending doctor confirmation. Dosing plans and reminders will activate once confirmed.'}
              </p>
            </div>
          </div>
        )}

        {/* Active Smart Reminders (In-App Simulation) */}
        {activeReminders.length > 0 && (
          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-teal-900">
                  Active Smart Reminders
                </span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                In-App Simulated Channel
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {activeReminders.map((rem) => (
                <div
                  key={rem.id}
                  className={cn(
                    'rounded-xl border p-2.5 flex items-start justify-between gap-3 text-xs',
                    rem.escalated
                      ? 'border-danger-300 bg-danger-50 text-danger-900'
                      : rem.type === 'missed_dose'
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-teal-200 bg-white text-navy-800',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {rem.escalated ? (
                      <AlertTriangle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5 animate-pulse" />
                    ) : (
                      <Clock className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-semibold">{rem.message}</span>
                      {rem.escalated && (
                        <span className="text-[10px] font-bold text-danger-700 uppercase tracking-wide">
                          ⚠️ 20-min escalation triggered — unacknowledged dose
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-navy-500 whitespace-nowrap">
                    {rem.scheduledFor}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('meds')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'meds'
                ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            )}
          >
            <Pill className="w-4 h-4 text-teal-600" />
            <span>{t('patient_tab_meds')}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
              {takenCount}/{totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'reports'
                ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            )}
          >
            <FileText className="w-4 h-4 text-teal-600" />
            <span>{t('patient_tab_reports')}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
              {reports.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('checkin')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'checkin'
                ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            )}
          >
            <Bell className="w-4 h-4 text-teal-600" />
            <span>{t('patient_feeling_title')}</span>
          </button>

          <button
            onClick={() => setActiveTab('family')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'family'
                ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            )}
          >
            <Users className="w-4 h-4 text-teal-600" />
            <span>{t('patient_tab_family')}</span>
          </button>
        </div>

        {/* TAB 1: TODAY'S MEDICINES */}
        {activeTab === 'meds' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-teal-600" />
                  {t('dash_today_meds')}
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800">
                  {takenCount} of {totalCount} {t('dose_taken')}
                </span>
              </div>

              {isApprovalPending ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-6 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col gap-1 max-w-md">
                    <h3 className="text-base font-bold text-amber-900">
                      Medication Schedule Paused — Awaiting Doctor Approval
                    </h3>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Your prescription is undergoing clinical safety verification. To preserve patient safety, active medication schedules and reminders remain paused until an authorized physician confirms your care plan.
                    </p>
                  </div>
                </div>
              ) : schedules.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
                  {t('empty_no_data')}
                </div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {schedules.map((schedule) => (
                    <DoseCard
                      key={schedule.id}
                      schedule={schedule}
                      expanded={expandedId === schedule.id}
                      onToggle={() =>
                        setExpandedId(expandedId === schedule.id ? null : schedule.id)
                      }
                      onAction={(action, reason) =>
                        handleDoseAction(
                          schedule.id,
                          action,
                          schedule.medicineName,
                          reason
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Follow-up Questions in Meds view */}
            {pendingFollowUps.length > 0 && (
              <section className="flex flex-col gap-3 pt-4 border-t border-slate-200">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-teal-600" />
                  {t('dash_followup_q')}
                </h2>
                <div className="flex flex-col gap-3">
                  {pendingFollowUps.map((f) => (
                    <FollowUpCard
                      key={f.id}
                      followUp={f}
                      onAnswer={(answer) => onFollowUpAnswer(f.id, answer)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: MY MEDICAL REPORTS & INSTRUCTIONS */}
        {activeTab === 'reports' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-1">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                {t('patient_tab_reports')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('patient_reports_summary')}
              </p>
            </div>

            {reports.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">
                {t('patient_no_reports')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 shadow-sm hover:border-teal-300 transition-all"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full uppercase">
                          {report.reportType}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {report.date}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {report.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {report.facilityOrLab} · {report.orderingDoctor}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-xs text-slate-700 leading-relaxed font-sans line-clamp-4">
                      {report.rawText.slice(0, 320)}...
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                      <span>Doctor Verified Document</span>
                      <span className="text-teal-700 font-semibold">Available for Doctor Review</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DAILY HEALTH CHECK-IN */}
        {activeTab === 'checkin' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <HealthCheckIn onSubmit={onHealthUpdate} />

            <section className="flex flex-col gap-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-teal-600" />
                {t('dash_followup_q')}
              </h2>
              {pendingFollowUps.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-400 text-sm">
                  {t('dash_followup_none')}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pendingFollowUps.map((f) => (
                    <FollowUpCard
                      key={f.id}
                      followUp={f}
                      onAnswer={(answer) => onFollowUpAnswer(f.id, answer)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 4: FAMILY RECOVERY CIRCLE (CONSENT-BASED) */}
        {activeTab === 'family' && (
          <FamilyConsentManager patientId="p1" />
        )}
      </main>
    </div>
  );
}

function DoseCard({
  schedule,
  expanded,
  onToggle,
  onAction,
}: {
  schedule: MedicationSchedule;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: DoseStatus, reason?: string) => void;
}) {
  const { t, lang } = useLanguage();
  const [showReasonPicker, setShowReasonPicker] = useState(false);

  // Evaluate timing and 20-min grace window
  const timing = evaluateDoseTiming(schedule);

  const statusBadge = (() => {
    switch (schedule.status) {
      case 'taken':
        return (
          <StatusBadge
            status="taken"
            label={t('dose_taken')}
            icon={<Check className="w-3 h-3" />}
          />
        );
      case 'cannot_take':
        return (
          <StatusBadge
            status="missed"
            label={schedule.reason ? `Cannot Take (${schedule.reason})` : 'Cannot Take'}
            icon={<X className="w-3 h-3" />}
          />
        );
      case 'missed':
        return (
          <StatusBadge
            status="missed"
            label={t('dose_missed')}
            icon={<X className="w-3 h-3" />}
          />
        );
      case 'snoozed':
        return (
          <StatusBadge
            status="snoozed"
            label={
              timing.snoozeRemainingMinutes
                ? `Snoozed (${timing.snoozeRemainingMinutes}m left)`
                : t('dose_snoozed')
            }
            icon={<Clock className="w-3 h-3" />}
          />
        );
      default:
        if (timing.isOverdue) {
          return (
            <StatusBadge
              status="uncertain"
              label={lang === 'hi' ? 'ओवरड्यू (20 मिनट ग्रेस समाप्त)' : 'Overdue (>20m grace window)'}
              icon={<AlertTriangle className="w-3 h-3" />}
            />
          );
        }
        if (timing.isInGracePeriod) {
          return (
            <StatusBadge
              status="open"
              label={lang === 'hi' ? 'अभी का समय (ग्रेस विंडो सक्रिय)' : 'Due Now (in gentle grace window)'}
              icon={<Clock className="w-3 h-3" />}
            />
          );
        }
        return (
          <StatusBadge
            status="pending"
            label={t('dose_pending')}
            icon={<Clock className="w-3 h-3" />}
          />
        );
    }
  })();

  const isActionable = schedule.status === 'pending' || schedule.status === 'snoozed';

  return (
    <div
      className={cn(
        'rounded-2xl sm:rounded-3xl border bg-white transition-all duration-200 overflow-hidden shadow-sm',
        schedule.status === 'taken'
          ? 'border-emerald-200 bg-emerald-50/20'
          : schedule.status === 'missed' || schedule.status === 'cannot_take'
          ? 'border-danger-200 bg-danger-50/20'
          : timing.isOverdue
          ? 'border-amber-300 bg-amber-50/30'
          : 'border-slate-200 hover:border-teal-300'
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          <div
            className={cn(
              'flex w-12 h-12 sm:w-14 sm:h-14 items-center justify-center rounded-2xl flex-shrink-0 transition-colors',
              schedule.status === 'taken'
                ? 'bg-emerald-100 text-emerald-700'
                : schedule.status === 'missed' || schedule.status === 'cannot_take'
                ? 'bg-danger-100 text-danger-600'
                : timing.isOverdue
                ? 'bg-amber-100 text-amber-700'
                : 'bg-teal-50 text-teal-600'
            )}
          >
            <Pill className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>

          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {schedule.medicineName}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                {schedule.dosage}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-snug">
              {schedule.instructions}
            </p>

            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                {t('dose_scheduled')}: <strong>{schedule.scheduledTime}</strong>
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {statusBadge}
              {schedule.reason && (
                <span className="text-xs text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded-md">
                  Note: {schedule.reason}
                </span>
              )}
            </div>
          </div>
        </div>

        {isActionable && (
          <button
            onClick={onToggle}
            className="flex w-9 h-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-colors flex-shrink-0"
            aria-label="Toggle actions"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Primary quick action when closed */}
      {isActionable && !expanded && (
        <div className="px-4 sm:px-5 pb-4">
          <button
            onClick={() => onAction('taken')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 text-white py-3.5 text-sm sm:text-base font-bold hover:bg-teal-700 transition-all shadow-md shadow-teal-600/20 active:scale-[0.99] min-h-[48px]"
          >
            <Check className="w-5 h-5" />
            <span>{t('dose_take_action')}</span>
          </button>
        </div>
      )}

      {/* Expanded actions: Taken, Missed, Snooze 10m, Cannot Take with Reason */}
      {isActionable && expanded && (
        <div className="px-4 sm:px-5 pb-4 flex flex-col gap-2.5 animate-scale-in border-t border-slate-100 pt-3">
          <button
            onClick={() => onAction('taken')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 text-white py-3.5 text-sm sm:text-base font-bold hover:bg-teal-700 transition-all shadow-md shadow-teal-600/20 min-h-[48px]"
          >
            <Check className="w-5 h-5" />
            <span>{t('dose_take_action')}</span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onAction('missed')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-danger-200 bg-white text-danger-700 py-2.5 text-xs sm:text-sm font-semibold hover:bg-danger-50 transition-colors min-h-[44px]"
            >
              <X className="w-4 h-4" />
              <span>{t('dose_missed_action')}</span>
            </button>

            <button
              onClick={() => onAction('snoozed')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-800 py-2.5 text-xs sm:text-sm font-semibold hover:bg-amber-100 transition-colors min-h-[44px]"
            >
              <Clock className="w-4 h-4" />
              <span>Snooze 10m</span>
            </button>

            <button
              onClick={() => setShowReasonPicker(!showReasonPicker)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs sm:text-sm font-semibold transition-colors min-h-[44px]',
                showReasonPicker
                  ? 'border-slate-400 bg-slate-100 text-slate-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              )}
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>{t('dose_cannot')}</span>
            </button>
          </div>

          {/* Reason picker for "Cannot Take" */}
          {showReasonPicker && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex flex-col gap-2 mt-1">
              <span className="text-xs font-bold text-slate-700">
                {lang === 'hi' ? 'दवाई न ले पाने का कारण चुनें:' : 'Select reason for being unable to take:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {DOSE_REASON_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onAction('cannot_take', opt.defaultLabel);
                      setShowReasonPicker(false);
                    }}
                    className="text-left text-xs font-medium px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700 transition-colors"
                  >
                    • {opt.defaultLabel}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HealthCheckIn({
  onSubmit,
}: {
  onSubmit: (state: HealthState, description: string) => void;
}) {
  const { t, lang } = useLanguage();
  const [selected, setSelected] = useState<HealthState | null>(null);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const choices: { state: HealthState; emoji: string; label: string; color: string }[] = [
    {
      state: 'good',
      emoji: '😊',
      label: t('dash_feel_good'),
      color: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    },
    {
      state: 'ok',
      emoji: '😐',
      label: t('dash_feel_ok'),
      color: 'border-amber-300 bg-amber-50 text-amber-800',
    },
    {
      state: 'bad',
      emoji: '😟',
      label: t('dash_feel_bad'),
      color: 'border-danger-300 bg-danger-50 text-danger-800',
    },
  ];

  const handleSubmit = () => {
    if (!selected) return;
    onSubmit(selected, description);
    setSubmitted(true);
    setSelected(null);
    setDescription('');
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 flex flex-col gap-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-teal-600" />
        <h2 className="text-lg font-bold text-slate-900">{t('dash_how_feel')}</h2>
      </div>

      {submitted ? (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 animate-scale-in">
          <Check className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span className="text-sm font-semibold">{t('success_saved')}</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {choices.map((c) => (
              <button
                key={c.state}
                onClick={() => setSelected(c.state)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all min-h-[96px] justify-center',
                  selected === c.state
                    ? cn(c.color, 'ring-2 ring-teal-500 shadow-sm')
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                )}
              >
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-xs font-bold text-center">{c.label}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex flex-col gap-3 animate-fade-in pt-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  lang === 'hi'
                    ? 'कृपया अपने लक्षण या परेशानी बताएं (उदा. हल्का सिरदर्द या दर्द 4/10)...'
                    : 'Describe any symptoms or discomfort (e.g., mild dizziness, surgical site pain 3/10)...'
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              />
              <button
                onClick={handleSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 text-white py-3.5 text-sm font-bold hover:bg-teal-700 transition-colors min-h-[46px] shadow-sm"
              >
                <span>{t('dash_submit_update')}</span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FollowUpCard({
  followUp,
  onAnswer,
}: {
  followUp: FollowUp;
  onAnswer: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!answer.trim()) return;
    onAnswer(answer);
    setSent(true);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-bold text-slate-900 leading-snug">{followUp.question}</p>
      </div>

      {sent ? (
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl p-3 border border-emerald-200">
          <Check className="w-4 h-4 text-emerald-600" />
          Response saved for Dr. Sharma to review.
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your response to Dr. Sharma here..."
            className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!answer.trim()}
            className="rounded-xl bg-teal-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
