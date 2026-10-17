import { useState, useCallback, useEffect, useMemo } from 'react';
import { Check, Clock, X, Bell, Pill, ChevronDown, ChevronUp, AlertTriangle, HelpCircle, ShieldAlert } from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { DemoBadge } from '@/components/DemoBanner';
import { StatusBadge } from '@/components/StatusBadge';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import { evaluateDoseTiming, DOSE_REASON_OPTIONS, applyOverdueEvaluations, generateReminders } from '@/utils/reminderEngine';
import type { MedicationSchedule, DoseStatus, HealthState, FollowUp, PrescriptionDraft } from '@/types';

interface PatientDashboardProps {
  schedules: MedicationSchedule[];
  followUps: FollowUp[];
  prescriptionDraft?: PrescriptionDraft | null;
  onDoseAction: (scheduleId: string, action: DoseStatus, reason?: string) => void;
  onHealthUpdate: (state: HealthState, description: string) => void;
  onFollowUpAnswer: (followUpId: string, answer: string) => void;
  onBack: () => void;
}

export function PatientDashboard({
  schedules: initialSchedules,
  followUps,
  prescriptionDraft,
  onDoseAction,
  onHealthUpdate,
  onFollowUpAnswer,
  onBack,
}: PatientDashboardProps) {
  const { t } = useLanguage();
  const [schedules, setSchedules] = useState<MedicationSchedule[]>(initialSchedules);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          setConfirmation(`${medName} — Snoozed for 10 min`);
        } else if (action === 'cannot_take') {
          setConfirmation(`${medName} — Reason recorded: ${reason || 'Noted'}`);
        } else if (action === 'missed') {
          setConfirmation(`${medName} — Marked missed`);
        }
        setTimeout(() => setConfirmation(null), 3500);
        setExpandedId(null);
      } catch {
        setError(t('error_retry'));
        setTimeout(() => setError(null), 3000);
      }
    },
    [onDoseAction, t]
  );

  const pendingFollowUps = followUps.filter((f) => f.status === 'pending');

  const activeReminders = useMemo(() => {
    return generateReminders(schedules, followUps);
  }, [schedules, followUps]);

  return (
    <div className="min-h-screen bg-surface-light flex flex-col">
      {/* Header */}
      <header className="border-b border-surface-border bg-white sticky top-0 z-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-navy-500 hover:text-navy-700 transition-colors">
            <ChevronUp className="w-4 h-4 rotate-90" />
          </button>
          <PulseBridgeLogo variant="light" size="sm" showTagline={false} />
          <div className="flex items-center gap-2">
            <DemoBadge variant="light" />
            <LanguageToggle variant="light" />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-2xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Greeting */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-navy-800">
            {t('dash_namaste')} <span className="text-teal-500">{t('dash_today_recovery')}</span>
          </h1>
          <p className="text-xs text-navy-400 mt-1">
            Doctor-verified care regimen · 20-min reminder grace period active
          </p>
        </div>

        {/* Confirmation toast */}
        {confirmation && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-scale-in max-w-md w-full px-4">
            <div className="flex items-center gap-3 rounded-2xl bg-teal-600 text-white px-5 py-3.5 shadow-xl shadow-teal-500/20 border border-teal-400/30">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span className="font-semibold text-sm leading-snug">{confirmation}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-scale-in max-w-md w-full px-4">
            <div className="flex items-center gap-3 rounded-2xl bg-danger-500 text-white px-5 py-3.5 shadow-xl">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Prescription Verification Status Banner */}
        {prescriptionDraft && !prescriptionDraft.confirmed && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-amber-900">
                Prescription Uploaded — Awaiting Doctor Review & Lock
              </span>
              <p className="text-xs text-amber-800 leading-relaxed">
                Your prescription details have been extracted. For patient safety, medication dosing plans and active reminders will start once verified and locked by your doctor.
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

        {/* Section 1: Today's Medicines with Smart Reminders */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy-700 flex items-center gap-2">
              <Pill className="w-5 h-5 text-teal-500" />
              {t('dash_today_meds')}
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-navy-100 text-navy-600">
              {schedules.filter((s) => s.status === 'taken').length}/{schedules.length} {t('dose_taken')}
            </span>
          </div>

          {schedules.length === 0 ? (
            <div className="rounded-2xl border border-surface-border bg-white p-6 text-center text-navy-400">
              {t('empty_no_data')}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {schedules.map((schedule) => (
                <DoseCard
                  key={schedule.id}
                  schedule={schedule}
                  expanded={expandedId === schedule.id}
                  onToggle={() => setExpandedId(expandedId === schedule.id ? null : schedule.id)}
                  onAction={(action, reason) =>
                    handleDoseAction(schedule.id, action, schedule.medicineName, reason)
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Section 2: How are you feeling */}
        <HealthCheckIn onSubmit={onHealthUpdate} />

        {/* Section 3: Follow-up questions */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-navy-700 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-teal-500" />
            {t('dash_followup_q')}
          </h2>
          {pendingFollowUps.length === 0 ? (
            <div className="rounded-2xl border border-surface-border bg-white p-6 text-center text-navy-400">
              {t('dash_followup_none')}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingFollowUps.map((f) => (
                <FollowUpCard key={f.id} followUp={f} onAnswer={(answer) => onFollowUpAnswer(f.id, answer)} />
              ))}
            </div>
          )}
        </section>
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
  const { t } = useLanguage();
  const [showReasonPicker, setShowReasonPicker] = useState(false);

  // Evaluate timing and 20-min grace window
  const timing = evaluateDoseTiming(schedule);

  const statusBadge = (() => {
    switch (schedule.status) {
      case 'taken':
        return <StatusBadge status="taken" label={t('dose_taken')} icon={<Check className="w-3 h-3" />} />;
      case 'cannot_take':
        return <StatusBadge status="missed" label={schedule.reason ? `Cannot Take (${schedule.reason})` : 'Cannot Take'} icon={<X className="w-3 h-3" />} />;
      case 'missed':
        return <StatusBadge status="missed" label={t('dose_missed')} icon={<X className="w-3 h-3" />} />;
      case 'snoozed':
        return (
          <StatusBadge
            status="snoozed"
            label={timing.snoozeRemainingMinutes ? `Snoozed (${timing.snoozeRemainingMinutes}m left)` : t('dose_snoozed')}
            icon={<Clock className="w-3 h-3" />}
          />
        );
      default:
        if (timing.isOverdue) {
          return <StatusBadge status="uncertain" label="Overdue (>20m grace)" icon={<AlertTriangle className="w-3 h-3" />} />;
        }
        if (timing.isInGracePeriod) {
          return <StatusBadge status="open" label="Due Now (in grace window)" icon={<Clock className="w-3 h-3" />} />;
        }
        return <StatusBadge status="pending" label={t('dose_pending')} icon={<Clock className="w-3 h-3" />} />;
    }
  })();

  const isActionable = schedule.status === 'pending' || schedule.status === 'snoozed';

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white transition-all duration-200 overflow-hidden',
        schedule.status === 'taken'
          ? 'border-success-200 bg-success-50/20'
          : schedule.status === 'missed' || schedule.status === 'cannot_take'
          ? 'border-danger-200 bg-danger-50/20'
          : timing.isOverdue
          ? 'border-amber-400/80 bg-amber-50/30'
          : 'border-surface-border',
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={cn(
              'flex w-12 h-12 items-center justify-center rounded-xl flex-shrink-0',
              schedule.status === 'taken'
                ? 'bg-success-100'
                : schedule.status === 'missed' || schedule.status === 'cannot_take'
                ? 'bg-danger-100'
                : timing.isOverdue
                ? 'bg-amber-100'
                : 'bg-teal-50',
            )}
          >
            <Pill
              className={cn(
                'w-6 h-6',
                schedule.status === 'taken'
                  ? 'text-success-600'
                  : schedule.status === 'missed' || schedule.status === 'cannot_take'
                  ? 'text-danger-500'
                  : timing.isOverdue
                  ? 'text-amber-600'
                  : 'text-teal-500',
              )}
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <span className="text-base font-bold text-navy-800 truncate">{schedule.medicineName}</span>
            <span className="text-sm text-navy-500">{schedule.dosage} · {schedule.instructions}</span>

            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-3.5 h-3.5 text-navy-400" />
              <span className="text-xs font-medium text-navy-500">
                {t('dose_scheduled')}: {schedule.scheduledTime}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {statusBadge}
              {schedule.reason && (
                <span className="text-xs text-navy-500 italic">
                  Note: {schedule.reason}
                </span>
              )}
            </div>
          </div>
        </div>

        {isActionable && (
          <button
            onClick={onToggle}
            className="flex w-8 h-8 items-center justify-center rounded-lg text-navy-400 hover:bg-surface-muted transition-colors flex-shrink-0"
            aria-label="Toggle actions"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Primary quick action when closed */}
      {isActionable && !expanded && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onAction('taken')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 text-white py-3.5 text-base font-bold hover:bg-teal-600 transition-colors min-h-[48px] shadow-sm"
          >
            <Check className="w-5 h-5" />
            {t('dose_take_action')}
          </button>
        </div>
      )}

      {/* Expanded actions: Taken, Missed, Snooze 10m, Cannot Take with Reason */}
      {isActionable && expanded && (
        <div className="px-4 pb-4 flex flex-col gap-2.5 animate-scale-in border-t border-surface-border/60 pt-3">
          <button
            onClick={() => onAction('taken')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 text-white py-3.5 text-base font-bold hover:bg-teal-600 transition-colors min-h-[48px] shadow-sm"
          >
            <Check className="w-5 h-5" />
            {t('dose_take_action')}
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onAction('missed')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-danger-200 bg-white text-danger-600 py-2.5 text-sm font-semibold hover:bg-danger-50 transition-colors min-h-[44px]"
            >
              <X className="w-4 h-4" />
              {t('dose_missed_action')}
            </button>

            <button
              onClick={() => onAction('snoozed')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/50 text-amber-700 py-2.5 text-sm font-semibold hover:bg-amber-100/60 transition-colors min-h-[44px]"
            >
              <Clock className="w-4 h-4" />
              Snooze 10m
            </button>

            <button
              onClick={() => setShowReasonPicker(!showReasonPicker)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition-colors min-h-[44px]',
                showReasonPicker
                  ? 'border-navy-400 bg-navy-100 text-navy-800'
                  : 'border-surface-border bg-white text-navy-600 hover:bg-surface-muted',
              )}
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs">{t('dose_cannot')}</span>
            </button>
          </div>

          {/* Reason picker for "Cannot Take" */}
          {showReasonPicker && (
            <div className="rounded-xl border border-surface-border bg-surface-muted p-3 flex flex-col gap-2 mt-1">
              <span className="text-xs font-bold text-navy-700">Select reason for unable to take:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {DOSE_REASON_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onAction('cannot_take', opt.defaultLabel);
                      setShowReasonPicker(false);
                    }}
                    className="text-left text-xs font-medium px-2.5 py-2 rounded-lg bg-white border border-surface-border text-navy-700 hover:border-teal-400 hover:text-teal-700 transition-colors"
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

function HealthCheckIn({ onSubmit }: { onSubmit: (state: HealthState, description: string) => void }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<HealthState | null>(null);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const choices: { state: HealthState; emoji: string; label: string; color: string }[] = [
    { state: 'good', emoji: '😊', label: t('dash_feel_good'), color: 'border-success-300 bg-success-50' },
    { state: 'ok', emoji: '😐', label: t('dash_feel_ok'), color: 'border-amber-300 bg-amber-50' },
    { state: 'bad', emoji: '😟', label: t('dash_feel_bad'), color: 'border-danger-300 bg-danger-50' },
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
    <section className="rounded-2xl border border-surface-border bg-white p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-teal-500" />
        <h2 className="text-lg font-bold text-navy-700">{t('dash_how_feel')}</h2>
      </div>

      {submitted ? (
        <div className="flex items-center gap-2 rounded-xl bg-success-50 border border-success-200 p-4 text-success-700 animate-scale-in">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{t('success_saved')}</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {choices.map((c) => (
              <button
                key={c.state}
                onClick={() => setSelected(c.state)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-3.5 transition-all min-h-[88px]',
                  selected === c.state ? cn(c.color, 'ring-2 ring-teal-400') : 'border-surface-border hover:bg-surface-muted',
                )}
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-xs font-semibold text-navy-700 text-center">{c.label}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex flex-col gap-3 animate-fade-in">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe any symptoms or pain (e.g. slight headache, pain 4/10)..."
                className="w-full rounded-xl border border-surface-border px-3.5 py-2.5 text-sm text-navy-800 placeholder:text-navy-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
              />
              <button
                onClick={handleSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 text-white py-3 text-sm font-bold hover:bg-teal-600 transition-colors min-h-[44px]"
              >
                Submit Update
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FollowUpCard({ followUp, onAnswer }: { followUp: FollowUp; onAnswer: (answer: string) => void }) {
  const [answer, setAnswer] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!answer.trim()) return;
    onAnswer(answer);
    setSent(true);
  };

  return (
    <div className="rounded-2xl border border-surface-border bg-white p-5 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-semibold text-navy-800 leading-snug">{followUp.question}</p>
      </div>

      {sent ? (
        <div className="flex items-center gap-2 text-xs font-semibold text-success-600 bg-success-50 rounded-lg p-2.5">
          <Check className="w-4 h-4" />
          Response saved for doctor review.
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here..."
            className="flex-1 rounded-xl border border-surface-border px-3 py-2 text-sm text-navy-800 placeholder:text-navy-400 focus:border-teal-400 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!answer.trim()}
            className="rounded-xl bg-teal-500 text-white px-4 py-2 text-sm font-bold hover:bg-teal-600 transition-colors disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
