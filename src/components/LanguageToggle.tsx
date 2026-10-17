import { Globe } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';

interface LanguageToggleProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export function LanguageToggle({ variant = 'light', className }: LanguageToggleProps) {
  const { lang, toggle } = useLanguage();

  const baseStyles =
    variant === 'dark'
      ? 'bg-navy-700 text-white border-navy-500 hover:bg-navy-600'
      : 'bg-white text-navy-700 border-surface-border hover:bg-surface-muted';

  return (
    <button
      onClick={toggle}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] min-w-[88px] justify-center',
        baseStyles,
        className,
      )}
      aria-label="Toggle language"
    >
      <Globe className="w-4 h-4 text-teal-500" />
      <span>{lang === 'hi' ? 'English' : 'हिंदी'}</span>
    </button>
  );
}
