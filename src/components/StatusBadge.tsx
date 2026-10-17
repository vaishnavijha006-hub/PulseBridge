import { cn } from '@/utils/cn';

interface StatusBadgeProps {
  status: 'confirmed' | 'uncertain' | 'missed' | 'pending' | 'taken' | 'snoozed' | 'urgent' | 'attention' | 'on_track' | 'open' | 'reviewed' | 'followup_planned';
  label: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

const statusStyles: Record<StatusBadgeProps['status'], string> = {
  confirmed: 'bg-success-100 text-success-700 border-success-200',
  uncertain: 'bg-amber-100 text-amber-700 border-amber-200',
  missed: 'bg-danger-100 text-danger-700 border-danger-200',
  pending: 'bg-surface-muted text-navy-500 border-surface-border',
  taken: 'bg-success-100 text-success-700 border-success-200',
  snoozed: 'bg-amber-100 text-amber-700 border-amber-200',
  urgent: 'bg-danger-100 text-danger-700 border-danger-200',
  attention: 'bg-amber-100 text-amber-700 border-amber-200',
  on_track: 'bg-success-100 text-success-700 border-success-200',
  open: 'bg-amber-100 text-amber-700 border-amber-200',
  reviewed: 'bg-success-100 text-success-700 border-success-200',
  followup_planned: 'bg-teal-100 text-teal-700 border-teal-200',
};

export function StatusBadge({ status, label, icon, size = 'sm', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3.5 py-1.5 text-sm',
        statusStyles[status],
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
}
