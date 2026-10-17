import { Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { isDemoMode } from '@/lib/supabase';

interface DemoBannerProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export function DemoBanner({ variant = 'light', className }: DemoBannerProps) {
  if (isDemoMode) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium',
          variant === 'dark'
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
            : 'bg-amber-50 border border-amber-200 text-amber-700',
          className,
        )}
        role="status"
        aria-label="Demo mode notice"
      >
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          <strong>Demo Mode:</strong> Using fictional data. No data is saved to a database.
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium',
        variant === 'dark'
          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
          : 'bg-emerald-50 border border-emerald-200 text-emerald-700',
        className,
      )}
      role="status"
      aria-label="Supabase live mode notice"
    >
      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
      <span>
        <strong>Supabase Connected:</strong> Live database active.
      </span>
    </div>
  );
}

export function DemoBadge({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  if (isDemoMode) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
          variant === 'dark'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-amber-50 border-amber-200 text-amber-600',
        )}
        title="Running in Demo Mode"
      >
        <Database className="w-3 h-3" />
        Demo
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        variant === 'dark'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-emerald-50 border-emerald-200 text-emerald-600',
      )}
      title="Supabase Connected"
    >
      <Database className="w-3 h-3" />
      Supabase Live
    </span>
  );
}

