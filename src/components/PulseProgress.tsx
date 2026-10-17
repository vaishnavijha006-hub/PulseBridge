import { cn } from '@/utils/cn';
import { PulseBridgeMark } from './PulseBridgeLogo';

interface PulseProgressProps {
  current: number;
  total: number;
  className?: string;
  variant?: 'light' | 'dark';
}

export function PulseProgress({ current, total, className, variant = 'light' }: PulseProgressProps) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const bgColor = variant === 'dark' ? 'bg-navy-600' : 'bg-surface-muted';

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('relative h-2 rounded-full overflow-hidden', bgColor)}>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-all duration-300',
              i < current ? 'bg-teal-500 scale-110' : i === current ? 'bg-teal-300 ring-2 ring-teal-200' : variant === 'dark' ? 'bg-navy-400' : 'bg-surface-border',
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function PulseLoadingSpinner({ size = 48, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <PulseBridgeMark width={size} height={size} animated />
      </div>
      {label && <p className="text-sm text-teal-600 font-medium animate-pulse">{label}</p>}
    </div>
  );
}
