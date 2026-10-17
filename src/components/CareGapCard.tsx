import { AlertTriangle, Clock, FileQuestion, Check, Calendar, Pill } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import type { CareGap, CareGapType } from '@/types';

interface CareGapCardProps {
  gap: CareGap;
  onReview: (id: string) => void;
  onPlanFollowUp: (id: string) => void;
  onMarkReviewed: (id: string) => void;
}

const gapTypeConfig: Record<CareGapType, { icon: typeof AlertTriangle; color: string }> = {
  new_symptom: { icon: AlertTriangle, color: 'text-danger-400' },
  missing_severity: { icon: FileQuestion, color: 'text-amber-400' },
  repeated_missed_dose: { icon: Pill, color: 'text-danger-400' },
  unanswered_followup: { icon: FileQuestion, color: 'text-amber-400' },
  overdue_update: { icon: Clock, color: 'text-amber-400' },
  allergy_conflict: { icon: AlertTriangle, color: 'text-danger-400' },
  duplicate_medicine: { icon: AlertTriangle, color: 'text-danger-400' },
};

export function CareGapCard({ gap, onReview, onPlanFollowUp, onMarkReviewed }: CareGapCardProps) {
  const { t } = useLanguage();
  const config = gapTypeConfig[gap.type];
  const Icon = config.icon;

  const statusBadge = (() => {
    switch (gap.status) {
      case 'open': return <StatusBadge status="open" label="Open" icon={<AlertTriangle className="w-3 h-3" />} />;
      case 'reviewed': return <StatusBadge status="reviewed" label="Reviewed" icon={<Check className="w-3 h-3" />} />;
      case 'followup_planned': return <StatusBadge status="followup_planned" label="Follow-up Planned" icon={<Calendar className="w-3 h-3" />} />;
    }
  })();

  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-3 transition-all',
      gap.status === 'open' ? 'border-amber-500/30 bg-amber-500/5' : 'border-navy-600 bg-navy-700/30',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className={cn('flex w-9 h-9 items-center justify-center rounded-lg bg-navy-800 flex-shrink-0', config.color)}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-white">{formatGapType(gap.type)}</span>
            <span className="text-xs text-navy-400">{formatTimestamp(gap.timestamp)}</span>
          </div>
        </div>
        {statusBadge}
      </div>

      {/* Evidence */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold text-navy-300 uppercase tracking-wide">{t('doctor_evidence')}</span>
        <p className="text-sm text-navy-100 leading-relaxed">{gap.evidence}</p>
      </div>

      {/* Missing info */}
      {gap.missingInfo && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">{t('doctor_missing')}</span>
          <p className="text-sm text-amber-300/90">{gap.missingInfo}</p>
        </div>
      )}

      {/* Follow-up question */}
      {gap.followupQuestion && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wide">{t('doctor_followup_q')}</span>
          <p className="text-sm text-teal-300 leading-relaxed italic">"{gap.followupQuestion}"</p>
        </div>
      )}

      {/* Actions */}
      {gap.status === 'open' && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onReview(gap.id)}
            className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-teal-500/10"
          >
            {t('doctor_review_patient')}
          </button>
          <button
            onClick={() => onPlanFollowUp(gap.id)}
            className="text-xs font-semibold text-navy-200 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-navy-600"
          >
            {t('doctor_plan_followup')}
          </button>
          <button
            onClick={() => onMarkReviewed(gap.id)}
            className="ml-auto text-xs font-semibold text-success-400 hover:text-success-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-success-500/10"
          >
            {t('doctor_mark_reviewed')}
          </button>
        </div>
      )}
    </div>
  );
}

function formatGapType(type: CareGapType): string {
  const labels: Record<CareGapType, string> = {
    new_symptom: 'New Symptom Reported',
    missing_severity: 'Missing Severity',
    repeated_missed_dose: 'Repeated Missed Dose',
    unanswered_followup: 'Unanswered Follow-up',
    overdue_update: 'Overdue Health Update',
    allergy_conflict: 'Allergy Conflict',
    duplicate_medicine: 'Duplicate Medicine',
  };
  return labels[type] ?? type;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
