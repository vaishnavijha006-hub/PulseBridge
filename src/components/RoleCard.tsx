import { cn } from '@/utils/cn';
import type { LucideIcon } from 'lucide-react';

interface RoleCardProps {
  icon: LucideIcon;
  title: string;
  hindiTitle: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
  className?: string;
}

export function RoleCard({ icon: Icon, title, hindiTitle, description, actionLabel, onClick, className }: RoleCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-start gap-4 rounded-2xl border border-navy-500/40 bg-navy-700/50 p-6 text-left transition-all duration-300',
        'hover:border-teal-400/60 hover:bg-navy-600/50 focus-visible:border-teal-400',
        'min-h-[220px] w-full glow-card',
        className,
      )}
    >
      <div className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 30px rgba(20, 184, 166, 0.15)' }}
      />
      <div className="relative flex w-14 h-14 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20 transition-colors group-hover:bg-teal-500/20 group-hover:border-teal-400/40">
        <Icon className="w-7 h-7 text-teal-400" />
      </div>
      <div className="relative flex flex-col gap-1">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <span className="font-devanagari text-lg text-teal-300">{hindiTitle}</span>
      </div>
      <p className="relative text-sm text-navy-200 leading-relaxed flex-1">{description}</p>
      <span className="relative inline-flex items-center gap-2 text-teal-400 font-semibold text-sm group-hover:text-teal-300 transition-colors">
        {actionLabel}
        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7-7 7M5 12h16" />
        </svg>
      </span>
    </button>
  );
}
