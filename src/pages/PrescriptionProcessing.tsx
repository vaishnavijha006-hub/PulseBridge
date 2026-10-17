import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, FileText, Loader2 } from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { PulseLoadingSpinner } from '@/components/PulseProgress';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';

interface PrescriptionProcessingProps {
  onComplete: () => void;
  onBack: () => void;
  imageUrl?: string | null;
}

export function PrescriptionProcessing({ onComplete, onBack, imageUrl }: PrescriptionProcessingProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const steps = [
    { icon: FileText, label: t('processing_step1') },
    { icon: Clock, label: t('processing_step2') },
    { icon: CheckCircle2, label: t('processing_step3') },
  ];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStep(1), 1500));
    timers.push(setTimeout(() => setStep(2), 3500));
    timers.push(setTimeout(() => onComplete(), 6000));
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-surface-light flex flex-col">
      <header className="border-b border-surface-border bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <PulseBridgeLogo variant="light" size="sm" showTagline={false} />
          <LanguageToggle variant="light" />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          <PulseLoadingSpinner size={72} label={t('processing_wait')} />

          {imageUrl && (
            <div className="rounded-2xl border border-surface-border bg-white p-2 shadow-sm">
              <img src={imageUrl} alt="Prescription" className="w-full max-h-48 object-contain rounded-xl bg-surface-muted" />
            </div>
          )}

          <div className="w-full flex flex-col gap-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isDone = i < step;
              const isCurrent = i === step;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-4 transition-all duration-500',
                    isDone ? 'border-success-200 bg-success-50' : isCurrent ? 'border-teal-200 bg-teal-50' : 'border-surface-border bg-white opacity-60',
                  )}
                >
                  <div className={cn(
                    'flex w-10 h-10 items-center justify-center rounded-full flex-shrink-0',
                    isDone ? 'bg-success-500' : isCurrent ? 'bg-teal-500' : 'bg-surface-muted',
                  )}>
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Icon className="w-5 h-5 text-navy-400" />
                    )}
                  </div>
                  <span className={cn(
                    'text-sm font-medium',
                    isDone ? 'text-success-700' : isCurrent ? 'text-teal-700' : 'text-navy-400',
                  )}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={onBack}
            className="text-sm font-medium text-navy-400 hover:text-navy-600 transition-colors"
          >
            {t('back')}
          </button>
        </div>
      </main>
    </div>
  );
}
