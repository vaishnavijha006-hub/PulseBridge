import { cn } from '@/utils/cn';

interface PulseBridgeLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export function PulseBridgeLogo({ variant = 'dark', size = 'md', showTagline = true, className }: PulseBridgeLogoProps) {
  const textColor = variant === 'dark' ? 'text-white' : 'text-navy-800';
  const taglineColor = variant === 'dark' ? 'text-teal-300' : 'text-teal-600';
  const dims = {
    sm: { svg: 36, text: 'text-lg', tag: 'text-[10px]' },
    md: { svg: 48, text: 'text-xl', tag: 'text-xs' },
    lg: { svg: 64, text: 'text-2xl', tag: 'text-sm' },
  }[size];

  return (
    <div className={cn('flex items-center gap-3 select-none', className)}>
      <PulseBridgeMark width={dims.svg} height={dims.svg} />
      <div className="flex flex-col">
        <span className={cn('font-bold tracking-tight', dims.text, textColor)}>
          PulseBridge <span className="text-teal-500">AI</span>
        </span>
        {showTagline && (
          <span className={cn('font-devanagari font-medium', dims.tag, taglineColor)}>
            घर तक इलाज का साथ
          </span>
        )}
      </div>
    </div>
  );
}

export function PulseBridgeMark({ width = 48, height = 48, animated = false }: { width?: number; height?: number; animated?: boolean }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PulseBridge AI heartbeat bridge logo"
    >
      <defs>
        <linearGradient id="pb-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <path
        d="M5 55 L25 55 L33 30 L42 75 L50 50 L58 20 L67 80 L75 55 L95 55"
        stroke="url(#pb-grad)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={animated ? 'heartline-draw' : ''}
      />
      <path
        d="M5 55 Q50 10 95 55"
        stroke="url(#pb-grad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.2"
      />
    </svg>
  );
}
