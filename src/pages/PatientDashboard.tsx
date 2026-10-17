import { useState, useCallback } from 'react';
import { Check, Clock, X, Bell, Pill, ChevronDown, ChevronUp, AlertTriangle, HelpCircle } from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { StatusBadge } from '@/components/StatusBadge';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import type { MedicationSchedule, DoseStatus, HealthState, FollowUp } from '@/types';

interface PatientDashboardProps {
  schedules: MedicationSchedule[];
  followUps: FollowUp[];
  onDoseAction: (scheduleId: string, action: DoseStatus) => void;
  onHealthUpdate: (state: HealthState, description: string) => void;
  onFollowUpAnswer: (followUpId: string, answer: string) => void;
  onBack: () => void;
}

export function PatientDashboard({
  schedules,
  followUps,
  onDoseAction,
  onHealthUpdate,
  onFollowUpAnswer,
  onBack,
}: PatientDashboardProps) {
  const { t } = useLanguage();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDoseAction = useCallback((scheduleId: string, action: DoseStatus, medName: string) => {
    try {
      onDoseAction(scheduleId, action);
      if (action === 'taken') {
        setConfirmation(medName);
        setTimeout(() => setConfirmation(null), 3000);
      }
      setExpandedId(null);
    } catch {
      setError(t('error_retry'));
      setTimeout(() => setError(null), 3000);
    }
  }, [onDoseAction, t]);

  const pendingFollowUps = followUps.filter((f) => f.status === 'pending');

  return (
    <div className="min-h-screen bg-surface-light flex flex-col">
      {/* Header */}
      <header className="border-b border-surface-border bg-white sticky top-0 z-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-navy-500 hover:text-navy-700 transition-colors">
            <ChevronUp className="w-4 h-4 rotate-90" />
          </button>
          <PulseBridgeLogo variant="light" size="sm" showTagline={false} />
          <LanguageToggle variant="light" />
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-2xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Greeting */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-navy-800">
            {t('dash_namaste')} <span className="text-teal-500">{t('dash_today_recovery')}</span>
          </h1>
        </div>

        {/* Confirmation toast */}
        {confirmation && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-scale-in">
            <div className="flex items-center gap-3 rounded-2xl bg-success-500 text-white px-6 py-4 shadow-lg shadow-success-500/30">
              <Check className="w-6 h-6" />
              <span className="font-semibold text-base">{t('dose_taken_confirm')}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-scale-in">
            <div className="flex items-center gap-3 rounded-2xl bg-danger-500 text-white px-6 py-4 shadow-lg">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Section 1: Today's Medicines */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-navy-700 flex items-center gap-2">
            <Pill className="w-5 h-5 text-teal-500" />
            {t('dash_today_meds')}
          </h2>
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
                  onAction={(action) => handleDoseAction(schedule.id, action, schedule.medicineName)}
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
  onAction: (action: DoseStatus) => void;
}) {
  const { t } = useLanguage();

  const statusBadge = (() => {
    switch (schedule.status) {
      case 'taken':
        return <StatusBadge status="taken" label={t('dose_taken')} icon={<Check className="w-3 h-3" />} />;
      case 'missed':
        return <StatusBadge status="missed" label={t('dose_missed')} icon={<X className="w-3 h-3" />} />;
      case 'snoozed':
        return <StatusBadge status="snoozed" label={t('dose_snoozed')} icon={<Clock className="w-3 h-3" />} />;
      default:
        return <StatusBadge status="pending" label={t('dose_pending')} icon={<Clock className="w-3 h-3" />} />;
    }
  })();

  return (
    <div className={cn(
      'rounded-2xl border bg-white transition-all duration-200',
      schedule.status === 'taken' ? 'border-success-200 bg-success-50/30' : schedule.status === 'missed' ? 'border-danger-200 bg-danger-50/30' : 'border-surface-border',
    )}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn(
            'flex w-12 h-12 items-center justify-center rounded-xl flex-shrink-0',
            schedule.status === 'taken' ? 'bg-success-100' : schedule.status === 'missed' ? 'bg-danger-100' : 'bg-teal-50',
          )}>
            <Pill className={cn(
              'w-6 h-6',
              schedule.status === 'taken' ? 'text-success-600' : schedule.status === 'missed' ? 'text-danger-500' : 'text-teal-500',
            )} />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <span className="text-base font-bold text-navy-800 truncate">{schedule.medicineName}</span>
            <span className="text-sm text-navy-500">{schedule.dosage} · {schedule.instructions}</span>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-3.5 h-3.5 text-navy-400" />
              <span className="text-xs font-medium text-navy-500">{t('dose_scheduled')}: {schedule.scheduledTime}</span>
            </div>
            {statusBadge}
          </div>
        </div>
        {schedule.status === 'pending' && (
          <button
            onClick={onToggle}
            className="flex w-8 h-8 items-center justify-center rounded-lg text-navy-400 hover:bg-surface-muted transition-colors flex-shrink-0"
            aria-label="Toggle actions"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Primary action: Take dose */}
      {schedule.status === 'pending' && !expanded && (
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

      {/* Expanded secondary actions */}
      {schedule.status === 'pending' && expanded && (
        <div className="px-4 pb-4 flex flex-col gap-2 animate-scale-in">
          <button
            onClick={() => onAction('taken')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 text-white py-3.5 text-base font-bold hover:bg-teal-600 transition-colors min-h-[48px]"
          >
            <Check className="w-5 h-5" />
            {t('dose_take_action')}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onAction('missed')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-danger-200 bg-white text-danger-600 py-2.5 text-sm font-medium hover:bg-danger-50 transition-colors min-h-[44px]"
            >
              <X className="w-4 h-4" />
              {t('dose_missed_action')}
            </button>
            <button
              onClick={() => onAction('snoozed')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-white text-amber-600 py-2.5 text-sm font-medium hover:bg-amber-50 transition-colors min-h-[44px]"
            >
              <Clock className="w-4 h-4" />
              {t('dose_snooze_action')}
            </button>
            <button
              onClick={() => onAction('missed')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-white text-navy-500 py-2.5 text-sm font-medium hover:bg-surface-muted transition-colors min-h-[44px]"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">{t('dose_cannot')}</span>
            </button>
          </div>
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
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-navy-700">{t('dash_how_feel')}</h2>
      {submitted ? (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-5 flex items-center gap-3 animate-scale-in">
          <Check className="w-6 h-6 text-success-500" />
          <span className="font-semibold text-success-700">{t('success_saved')}</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-surface-border bg-white p-5 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {choices.map((c) => (
              <button
                key={c.state}
                onClick={() => setSelected(c.state)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all min-h-[96px] justify-center',
                  selected === c.state
                    ? c.color + ' scale-105 shadow-sm'
                    : 'border-surface-border bg-white hover:bg-surface-muted',
                )}
              >
                <span className="text-3xl">{c.emoji}</span>
                <span className={cn('text-sm font-semibold', selected === c.state ? 'text-navy-800' : 'text-navy-500')}>{c.label}</span>
              </button>
            ))}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('dash_symptom_placeholder')}
            rows={2}
            className="w-full rounded-xl border border-surface-border bg-white px-4 py-3 text-sm text-navy-800 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none transition-colors resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!selected}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold transition-all min-h-[48px]',
              selected ? 'bg-teal-500 text-white hover:bg-teal-600 shadow-sm' : 'bg-surface-muted text-navy-300 cursor-not-allowed',
            )}
          >
            {t('dash_submit_update')}
          </button>
        </div>
      )}
    </section>
  );
}

function FollowUpCard({ followUp, onAnswer }: { followUp: FollowUp; onAnswer: (answer: string) => void }) {
  const { t } = useLanguage();
  const [answer, setAnswer] = useState('');

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex w-10 h-10 items-center justify-center rounded-full bg-teal-100 flex-shrink-0">
          <Bell className="w-5 h-5 text-teal-600" />
        </div>
        <p className="text-sm font-medium text-navy-700 leading-relaxed pt-1">{followUp.question}</p>
      </div>
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer..."
          className="w-full rounded-xl border border-surface-border bg-white px-4 py-3 text-sm text-navy-800 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none transition-colors"
        />
        <button
          onClick={() => answer && onAnswer(answer)}
          disabled={!answer}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all min-h-[44px]',
            answer ? 'bg-teal-500 text-white hover:bg-teal-600' : 'bg-surface-muted text-navy-300 cursor-not-allowed',
          )}
        >
          {t('submit')}
        </button>
      </div>
    </div>
  );
}
