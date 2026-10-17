import { useEffect, useState, useRef, useCallback } from 'react';
import { CheckCircle2, Clock, FileText, Loader2, AlertTriangle, RotateCcw, ArrowRight } from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { PulseLoadingSpinner } from '@/components/PulseProgress';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import { dataService } from '@/services/dataService';
import type { PrescriptionDraft } from '@/types';

interface PrescriptionProcessingProps {
  onComplete: (draft?: PrescriptionDraft) => void;
  onBack: () => void;
  imageUrl?: string | null;
  file?: File | Blob | null;
  patientId?: string;
}

export function PrescriptionProcessing({
  onComplete,
  onBack,
  imageUrl,
  file,
  patientId = 'p1',
}: PrescriptionProcessingProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<'analyzing' | 'complete' | 'error'>('analyzing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [extractedDraft, setExtractedDraft] = useState<PrescriptionDraft | null>(null);

  const scanAttemptedRef = useRef(false);
  const isMountedRef = useRef(true);

  const steps = [
    { icon: FileText, label: t('processing_step1') },
    { icon: Clock, label: t('processing_step2') },
    { icon: CheckCircle2, label: t('processing_step3') },
  ];

  const executeScan = useCallback(async () => {
    setStatus('analyzing');
    setErrorMessage(null);
    setErrorCode(null);
    setStep(0);

    // If neither a file nor an image URL is present, complete gracefully
    if (!file && !imageUrl) {
      if (isMountedRef.current) {
        setStep(2);
        setStatus('complete');
      }
      setTimeout(() => {
        if (isMountedRef.current) onComplete();
      }, 1000);
      return;
    }

    try {
      // Step 0: Prescription photo received
      if (isMountedRef.current) setStep(0);

      // Resolve Blob to scan: either the provided File/Blob or fetch from image preview URL
      let targetBlob: Blob | null = file || null;
      if (!targetBlob && imageUrl) {
        try {
          const res = await fetch(imageUrl);
          targetBlob = await res.blob();
        } catch (fetchErr: any) {
          console.warn('[PrescriptionProcessing] Could not fetch blob from imageUrl:', fetchErr?.message);
        }
      }

      if (!targetBlob) {
        if (isMountedRef.current) {
          setStep(2);
          setStatus('complete');
        }
        setTimeout(() => {
          if (isMountedRef.current) onComplete();
        }, 1000);
        return;
      }

      // Step 1: Reading medicine details via server Gemini Vision endpoint
      if (isMountedRef.current) setStep(1);

      const targetPatientId = patientId.trim() || 'p1';
      const scanRes = await dataService.scanPrescription(targetPatientId, targetBlob, {
        imageUrl: imageUrl || (file instanceof File ? file.name : 'uploaded-prescription.jpg'),
      });

      if (!isMountedRef.current) return;

      if ('error' in scanRes) {
        setStatus('error');
        setErrorMessage(scanRes.error);
        setErrorCode(scanRes.code || 'SCAN_FAILED');
        return;
      }

      // Step 2: Extraction completed and validated — draft is safe & unconfirmed
      setStep(2);
      setStatus('complete');
      setExtractedDraft(scanRes.data);

      setTimeout(() => {
        if (isMountedRef.current) {
          onComplete(scanRes.data);
        }
      }, 1400);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setStatus('error');
      setErrorMessage(err?.message || 'An unexpected error occurred while analyzing the prescription.');
      setErrorCode('UNEXPECTED_ERROR');
    }
  }, [file, imageUrl, patientId, onComplete]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!scanAttemptedRef.current) {
      scanAttemptedRef.current = true;
      void executeScan();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [executeScan]);

  const handleRetry = () => {
    scanAttemptedRef.current = false;
    void executeScan();
  };

  const handleManualSkip = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen bg-surface-light flex flex-col">
      <header className="border-b border-surface-border bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <PulseBridgeLogo variant="light" size="sm" showTagline={false} />
          <LanguageToggle variant="light" />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md flex flex-col items-center gap-8 text-center">
          {/* Header icon / spinner based on status */}
          {status === 'analyzing' && (
            <PulseLoadingSpinner size={72} label={t('processing_wait')} />
          )}

          {status === 'complete' && (
            <div className="flex flex-col items-center gap-2 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-success-50 border border-success-200 flex items-center justify-center text-success-600 shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-navy-800">Prescription Extracted</h2>
              <p className="text-xs text-navy-500">
                Awaiting Doctor Review & Lock before activating medication schedule
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="w-16 h-16 rounded-full bg-danger-50 border border-danger-200 flex items-center justify-center text-danger-600 shadow-sm animate-scale-in">
              <AlertTriangle className="w-8 h-8" />
            </div>
          )}

          {/* Prescription Image Preview */}
          {imageUrl && (
            <div className="rounded-2xl border border-surface-border bg-white p-2 shadow-sm w-full">
              <img
                src={imageUrl}
                alt="Prescription"
                className="w-full max-h-48 object-contain rounded-xl bg-surface-muted"
              />
            </div>
          )}

          {/* Status Step Indicators */}
          <div className="w-full flex flex-col gap-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isDone = i < step || status === 'complete';
              const isCurrent = i === step && status === 'analyzing';
              const isFailed = status === 'error' && i === step;

              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-4 transition-all duration-500 text-left',
                    isDone
                      ? 'border-success-200 bg-success-50'
                      : isFailed
                      ? 'border-danger-200 bg-danger-50'
                      : isCurrent
                      ? 'border-teal-200 bg-teal-50'
                      : 'border-surface-border bg-white opacity-60',
                  )}
                >
                  <div
                    className={cn(
                      'flex w-10 h-10 items-center justify-center rounded-full flex-shrink-0',
                      isDone
                        ? 'bg-success-500'
                        : isFailed
                        ? 'bg-danger-500'
                        : isCurrent
                        ? 'bg-teal-500'
                        : 'bg-surface-muted',
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : isFailed ? (
                      <AlertTriangle className="w-5 h-5 text-white" />
                    ) : (
                      <Icon className="w-5 h-5 text-navy-400" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isDone
                          ? 'text-success-700'
                          : isFailed
                          ? 'text-danger-700 font-semibold'
                          : isCurrent
                          ? 'text-teal-700'
                          : 'text-navy-400',
                      )}
                    >
                      {s.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[11px] text-teal-600 animate-pulse">
                        Analyzing multimodal vision features...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error Notice & Deliberate Retry Options */}
          {status === 'error' && (
            <div className="w-full flex flex-col gap-4 animate-fade-in">
              <div className="rounded-2xl border border-danger-300 bg-danger-50 p-4 flex items-start gap-3 text-left">
                <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-danger-900">
                    AI Prescription Scanner Notice
                  </span>
                  <p className="text-xs text-danger-800 leading-relaxed">
                    {errorMessage || 'Unable to scan prescription at this time.'}
                  </p>
                  {errorCode && (
                    <span className="inline-block mt-1 font-mono text-[10px] bg-danger-100 text-danger-700 px-2 py-0.5 rounded w-fit">
                      Code: {errorCode}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm py-3 px-4 shadow-sm transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t('retry')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleManualSkip}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl border border-surface-border bg-white hover:bg-surface-muted text-navy-700 font-semibold text-sm py-3 px-4 transition-colors"
                >
                  <span>Continue to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Back button */}
          <button
            type="button"
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
