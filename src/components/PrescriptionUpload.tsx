import { useRef, useState } from 'react';
import { Camera, Upload, Image as ImageIcon, AlertCircle, X } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';

interface PrescriptionUploadProps {
  onUpload: (file: File | null, previewUrl: string | null) => void;
  className?: string;
}

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export function PrescriptionUpload({ onUpload, className }: PrescriptionUploadProps) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError(t('upload_invalid_type'));
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(t('upload_too_large'));
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    setFileName(file.name);
    onUpload(file, url);
  };

  const handleRetry = () => {
    setPreview(null);
    setFileName(null);
    setError(t('upload_retry_blur'));
    onUpload(null, null);
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {!preview ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-surface-border bg-white px-6 py-8 transition-colors hover:border-teal-400 hover:bg-teal-50/50 min-h-[140px] justify-center"
            >
              <div className="flex w-12 h-12 items-center justify-center rounded-xl bg-teal-50 border border-teal-100">
                <Upload className="w-6 h-6 text-teal-600" />
              </div>
              <span className="text-base font-semibold text-navy-700">{t('upload_select')}</span>
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-surface-border bg-white px-6 py-8 transition-colors hover:border-teal-400 hover:bg-teal-50/50 min-h-[140px] justify-center"
            >
              <div className="flex w-12 h-12 items-center justify-center rounded-xl bg-teal-50 border border-teal-100">
                <Camera className="w-6 h-6 text-teal-600" />
              </div>
              <span className="text-base font-semibold text-navy-700">{t('upload_capture')}</span>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </>
      ) : (
        <div className="rounded-2xl border border-surface-border bg-white p-4 flex flex-col gap-3">
          <div className="relative">
            <img src={preview} alt={t('upload_preview')} className="w-full max-h-64 object-contain rounded-xl bg-surface-muted" />
            <button
              onClick={handleRetry}
              className="absolute top-2 right-2 flex w-8 h-8 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-white transition-colors"
              aria-label="Remove photo"
            >
              <X className="w-4 h-4 text-navy-600" />
            </button>
          </div>
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-navy-500">
              <ImageIcon className="w-4 h-4 text-teal-500" />
              <span className="truncate">{fileName}</span>
            </div>
          )}
          <button
            onClick={handleRetry}
            className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors text-left"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}
    </div>
  );
}
