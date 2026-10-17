import { cn } from '@/utils/cn';
import { AlertTriangle, Clock, CheckCircle2, Activity, TrendingUp, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { PatientSummary, Priority } from '@/types';
import { useLanguage } from '@/i18n/LanguageContext';

interface PatientStatusCardProps {
  summary: PatientSummary;
  onClick: () => void;
}

export function PatientStatusCard({ summary, onClick }: PatientStatusCardProps) {
  const { t } = useLanguage();
  const {
    patient,
    dosesToday,
    adherence7Day,
    latestUpdate,
    openGaps,
    gapReasons,
    lastUpdateAt,
    priority,
    triageScore,
    criticalSafetyOverride,
    criticalAlertMessage,
    scoreFactors,
    pendingRxCount = 0,
  } = summary;

  const priorityConfig: Record<Priority, { status: 'on_track' | 'attention' | 'urgent'; label: string; icon: typeof CheckCircle2 }> = {
    on_track: { status: 'on_track', label: t('doctor_priority_ontime'), icon: CheckCircle2 },
    needs_attention: { status: 'attention', label: t('doctor_priority_attention'), icon: AlertTriangle },
    urgent: { status: 'urgent', label: t('doctor_priority_urgent'), icon: AlertTriangle },
  };

  const pc = priorityConfig[priority];
  const PriorityIcon = pc.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-4 rounded-2xl border bg-navy-700/50 p-5 text-left transition-all duration-300 glow-card w-full',
        'hover:border-teal-400/60 hover:bg-navy-600/50 focus-visible:border-teal-400',
        criticalSafetyOverride
          ? 'border-danger-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
          : priority === 'urgent'
          ? 'border-danger-500/40'
          : priority === 'needs_attention'
          ? 'border-amber-500/40'
          : 'border-navy-500/40',
      )}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 30px rgba(20, 184, 166, 0.12)' }}
      />

      {/* Critical Safety / Emergency Override Banner */}
      {criticalSafetyOverride && (
        <div className="relative rounded-xl bg-danger-500/20 border border-danger-500/50 p-2.5 flex items-start gap-2 text-danger-300">
          <AlertTriangle className="w-4 h-4 text-danger-400 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-danger-200 tracking-wide uppercase">
              🚨 Critical Safety Override (Emergency Pathway)
            </span>
            <span className="text-xs text-danger-300 leading-snug">
              {criticalAlertMessage || 'Possible emergency symptom reported. Urgent doctor evaluation required.'}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-white">{patient.name}</span>
          <span className="text-xs text-navy-300">
            {patient.age} yrs · {patient.gender} · ID: {patient.id.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {typeof triageScore === 'number' && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-extrabold border',
                triageScore >= 80
                  ? 'bg-danger-500/20 text-danger-300 border-danger-500/40'
                  : triageScore >= 50
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-teal-500/20 text-teal-300 border-teal-500/40',
              )}
            >
              Score: {triageScore}
            </span>
          )}
          <StatusBadge status={pc.status} label={pc.label} icon={<PriorityIcon className="w-3 h-3" />} size="md" />
        </div>
      </div>

      {/* Detailed Stats row: doses breakdown, adherence, gaps, pending Rx */}
      <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg p-2.5 flex flex-col gap-1 bg-navy-800/50 border border-navy-600/30">
          <div className="flex items-center gap-1 text-[10px] font-medium text-navy-300">
            <Clock className="w-3.5 h-3.5" />
            <span className="truncate">{t('doctor_doses_today')}</span>
          </div>
          <span className="text-base font-bold text-white">
            {dosesToday.taken}/{dosesToday.total}
          </span>
          <div className="flex items-center gap-1.5 text-[9px] text-navy-400">
            <span className="text-teal-400 font-semibold">{dosesToday.taken} ok</span>
            {dosesToday.missed > 0 && <span className="text-danger-400 font-semibold">{dosesToday.missed} miss</span>}
            {dosesToday.pending > 0 && <span className="text-amber-400">{dosesToday.pending} pend</span>}
          </div>
        </div>

        <Stat label={t('doctor_adherence')} value={`${adherence7Day}%`} icon={<TrendingUp className="w-3.5 h-3.5" />} />
        <Stat label={t('doctor_open_gaps')} value={String(openGaps)} icon={<AlertTriangle className="w-3.5 h-3.5" />} highlight={openGaps > 0} />
        <Stat label={t('doctor_pending_rx')} value={String(pendingRxCount)} icon={<Activity className="w-3.5 h-3.5" />} highlight={pendingRxCount > 0} />
      </div>

      {/* Latest update */}
      {latestUpdate && (
        <div className="relative rounded-lg bg-navy-800/50 p-3 border border-navy-600/30">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs font-semibold text-navy-200">{t('doctor_latest_update')}</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700 text-navy-300">
              {latestUpdate.source === 'doctor' ? t('doctor_doctor_confirmed') : t('doctor_patient_reported')}
            </span>
          </div>
          <p className="text-sm text-navy-100 leading-snug">"{latestUpdate.symptomDescription}"</p>
          <span className="text-xs text-navy-400 mt-1 block">{formatTimeAgo(lastUpdateAt)}</span>
        </div>
      )}

      {/* Score factors breakdown & reasons */}
      {scoreFactors && scoreFactors.length > 0 ? (
        <div className="relative flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-amber-400">Triage Priority Factors:</span>
          {scoreFactors.map((factor, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-navy-200">
              <span className="text-xs font-bold text-amber-400 px-1 py-0.2 rounded bg-amber-500/10 flex-shrink-0">
                +{factor.points}
              </span>
              <span className="leading-relaxed">
                {factor.reason}
                {factor.evidence && (
                  <span className="text-navy-400 italic block text-[11px] mt-0.5">
                    Evidence: {factor.evidence}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : gapReasons.length > 0 ? (
        <div className="relative flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-amber-400">{t('doctor_reasons')}:</span>
          {gapReasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-navy-200">
              <span className="text-amber-400 mt-0.5">•</span>
              <span className="leading-relaxed">{reason}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Transparent Queue-Sorting Disclaimer */}
      <div className="relative text-[10px] text-navy-400 leading-tight border-t border-navy-700 pt-2 italic">
        * Heuristic score is for doctor queue-sorting only; not a diagnostic or medical risk prediction. Low score does not guarantee medical safety.
      </div>

      {/* Action */}
      <div className="relative flex items-center justify-end gap-1 text-teal-400 font-semibold text-sm group-hover:text-teal-300 transition-colors pt-1">
        {t('doctor_review_patient')}
        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function Stat({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg p-2.5 flex flex-col gap-1',
      highlight ? 'bg-danger-500/10 border border-danger-500/20' : 'bg-navy-800/50 border border-navy-600/30',
    )}>
      <div className={cn('flex items-center gap-1 text-[10px] font-medium', highlight ? 'text-danger-400' : 'text-navy-300')}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <span className={cn('text-base font-bold', highlight ? 'text-danger-400' : 'text-white')}>{value}</span>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'Just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
