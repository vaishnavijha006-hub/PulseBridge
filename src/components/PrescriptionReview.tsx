import { useState } from 'react';
import { Check, AlertTriangle, Edit3, Save, Lock, ShieldAlert, FileText, Sparkles, Image as ImageIcon } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import { extractPrescriptionFromText } from '@/services/prescriptionExtractor';
import type { PrescriptionDraft, PrescriptionField } from '@/types';

interface PrescriptionReviewProps {
  draft: PrescriptionDraft;
  patientAllergies?: string;
  patientCurrentMeds?: string;
  doctorName?: string;
  onConfirm: (updatedFields: PrescriptionField[]) => void;
}

export function PrescriptionReview({
  draft,
  patientAllergies,
  patientCurrentMeds,
  doctorName = 'Dr. Anita Desai, MD',
  onConfirm,
}: PrescriptionReviewProps) {
  const { t } = useLanguage();
  const [fields, setFields] = useState<PrescriptionField[]>(draft.fields.map((f) => ({ ...f })));
  const [confirmed, setConfirmed] = useState(draft.confirmed);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMediaTab, setActiveMediaTab] = useState<'image' | 'text'>('image');
  const [rawText, setRawText] = useState<string>(
    draft.rawText ||
      'Rx:\nTab Aspirin 75mg once daily after breakfast for 14 days\nTake with water'
  );

  const CRITICAL_KEYS = ['medicine', 'dosage', 'frequency', 'duration'];

  const uncertainFields = fields.filter((f) => f.status === 'uncertain');
  const confirmedFields = fields.filter((f) => f.status !== 'uncertain');
  const sortedFields = [...uncertainFields, ...confirmedFields];

  // Critical prescription fields must be non-empty AND doctor-confirmed
  const emptyCriticalFields = fields.filter(
    (f) => CRITICAL_KEYS.includes(f.key) && (!f.value || !f.value.trim())
  );
  const uncertainCriticalFields = fields.filter(
    (f) => CRITICAL_KEYS.includes(f.key) && f.status === 'uncertain'
  );
  const hasUnresolved = emptyCriticalFields.length > 0 || uncertainCriticalFields.length > 0;

  // Active allergy conflict check
  const prescribedMedName = fields.find((f) => f.key === 'medicine')?.value?.toLowerCase() ?? '';
  const allergyConflict = Boolean(
    patientAllergies &&
      patientAllergies.toLowerCase() !== 'none' &&
      prescribedMedName &&
      (patientAllergies.toLowerCase().includes(prescribedMedName) ||
        prescribedMedName.includes(patientAllergies.toLowerCase().split(',')[0].trim()))
  );

  // Duplicate medication check against patient.currentMeds
  const duplicateMedication = Boolean(
    patientCurrentMeds &&
      patientCurrentMeds.toLowerCase() !== 'none' &&
      prescribedMedName &&
      (patientCurrentMeds.toLowerCase().includes(prescribedMedName) ||
        prescribedMedName.includes(patientCurrentMeds.toLowerCase().split(',')[0].trim()))
  );

  const handleEdit = (key: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
  };

  const handleMarkResolved = (key: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'confirmed' } : f)));
    setEditingKey(null);
  };

  const handleConfirm = () => {
    if (hasUnresolved) {
      setError('Critical fields (medicine, dosage, frequency, duration) must be verified and non-empty.');
      setTimeout(() => setError(null), 4000);
      return;
    }
    const updated = fields.map((f) => ({ ...f, status: 'confirmed' as const }));
    setFields(updated);
    setConfirmed(true);
    onConfirm(updated);
  };

  // Run AI / Grounded Prescription Extraction from text
  const handleExtractFromText = () => {
    if (!rawText.trim()) return;
    const extracted = extractPrescriptionFromText(rawText);
    setFields(extracted.fields);
  };


  return (
    <div className="rounded-2xl border border-navy-600 bg-navy-700/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-navy-600 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          {t('doctor_rx_verify')}
        </h3>
        {confirmed ? (
          <StatusBadge status="confirmed" label={t('rx_doctor_confirmed')} icon={<Check className="w-3 h-3" />} size="md" />
        ) : (
          <StatusBadge status="open" label={`${uncertainFields.length} ${t('rx_check')}`} icon={<AlertTriangle className="w-3 h-3" />} size="md" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-navy-600">
        {/* Left: Image or Raw Text with Extraction */}
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-navy-600/70 pb-2.5">
            <span className="text-xs font-bold text-navy-200 uppercase tracking-wider">Source Document</span>
            <div className="flex items-center gap-1 bg-navy-800 p-0.5 rounded-lg border border-navy-600">
              <button
                onClick={() => setActiveMediaTab('image')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                  activeMediaTab === 'image'
                    ? 'bg-teal-500/20 text-teal-300 font-bold'
                    : 'text-navy-400 hover:text-white'
                )}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Image</span>
              </button>
              <button
                onClick={() => setActiveMediaTab('text')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                  activeMediaTab === 'text'
                    ? 'bg-teal-500/20 text-teal-300 font-bold'
                    : 'text-navy-400 hover:text-white'
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Raw Text</span>
              </button>
            </div>
          </div>

          {activeMediaTab === 'image' ? (
            <div className="rounded-xl border border-navy-600 bg-navy-800/50 overflow-hidden">
              <img src={draft.imageUrl} alt="Prescription" className="w-full max-h-72 object-contain bg-navy-900" />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={5}
                className="w-full rounded-xl bg-navy-900 border border-navy-600 p-3 text-xs text-white font-mono leading-relaxed focus:border-teal-400 focus:outline-none"
                placeholder="Paste or type prescription narrative text here..."
              />
              <button
                onClick={handleExtractFromText}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-bold hover:bg-purple-600/50 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>Extract Structured Parameters</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Fields & Safety Alerts */}
        <div className="p-5 flex flex-col gap-3">
          <span className="text-sm font-semibold text-navy-200">{t('doctor_rx_fields')}</span>

          {/* Allergy Conflict Banner */}
          {allergyConflict && (
            <div className="rounded-xl border border-danger-500/50 bg-danger-500/15 p-3 flex items-start gap-2.5 text-danger-300">
              <ShieldAlert className="w-4 h-4 text-danger-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col text-xs">
                <span className="font-bold text-danger-200 uppercase tracking-wide">
                  ⚠️ Allergy Alert: Patient Sensitive to "{patientAllergies}"
                </span>
                <span className="text-danger-300 mt-0.5">
                  Verify medication compatibility before approving this care plan.
                </span>
              </div>
            </div>
          )}

          {/* Duplicate Medication Warning Banner */}
          {duplicateMedication && (
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/15 p-3 flex items-start gap-2.5 text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col text-xs">
                <span className="font-bold text-amber-200 uppercase tracking-wide">
                  ⚠️ Duplicate Medication Flag: Patient Currently Taking "{patientCurrentMeds}"
                </span>
                <span className="text-amber-300 mt-0.5">
                  Review for drug duplication or dose modification before activating new schedule.
                </span>
              </div>
            </div>
          )}

          {sortedFields.map((field) => {
            const isUncertain = field.status === 'uncertain';
            const isEditing = editingKey === field.key;
            const label = t(field.labelKey as any);

            return (
              <div
                key={field.key}
                className={cn(
                  'rounded-xl border p-3 flex flex-col gap-2 transition-all',
                  confirmed
                    ? 'border-success-500/30 bg-success-500/5'
                    : isUncertain
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-navy-600 bg-navy-800/30',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-navy-100">{label}</span>
                  {confirmed ? (
                    <StatusBadge status="confirmed" label={t('rx_confirmed')} icon={<Check className="w-3 h-3" />} />
                  ) : isUncertain ? (
                    <StatusBadge status="uncertain" label={t('rx_uncertain')} icon={<AlertTriangle className="w-3 h-3" />} />
                  ) : (
                    <StatusBadge status="confirmed" label="OK" icon={<Check className="w-3 h-3" />} />
                  )}
                </div>

                {isEditing && !confirmed ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => handleEdit(field.key, e.target.value)}
                      className="flex-1 rounded-lg border border-navy-500 bg-navy-800 px-3 py-2 text-sm text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
                      placeholder={`Enter ${label.toLowerCase()}`}
                    />
                    <button
                      onClick={() => handleMarkResolved(field.key)}
                      disabled={!field.value.trim()}
                      className="flex w-9 h-9 items-center justify-center rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors disabled:opacity-40"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      'text-sm',
                      field.value ? 'text-white' : 'text-danger-400 italic',
                    )}>
                      {field.value || '(missing — needs review)'}
                    </span>
                    {!confirmed && (
                      <div className="flex items-center gap-1">
                        {isUncertain && field.value.trim() && (
                          <button
                            onClick={() => handleMarkResolved(field.key)}
                            title="Verify and confirm field"
                            className="flex w-7 h-7 items-center justify-center rounded text-teal-400 hover:text-white hover:bg-teal-500/20 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingKey(field.key)}
                          title="Edit field"
                          className="flex w-7 h-7 items-center justify-center rounded text-navy-300 hover:text-teal-400 hover:bg-navy-600 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Confirm button */}
          {!confirmed && (
            <div className="mt-2 flex flex-col gap-2">
              {error && (
                <div className="flex items-center gap-2 text-sm text-danger-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
              <button
                onClick={handleConfirm}
                disabled={hasUnresolved}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold transition-all min-h-[48px]',
                  hasUnresolved
                    ? 'bg-navy-600 text-navy-400 cursor-not-allowed'
                    : 'bg-teal-500 text-navy-900 hover:bg-teal-400 shadow-lg shadow-teal-500/20',
                )}
              >
                {hasUnresolved ? (
                  <>
                    <Lock className="w-4 h-4" />
                    Resolve uncertain fields first
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {t('rx_confirm_plan')}
                  </>
                )}
              </button>
              {hasUnresolved && (
                <p className="text-xs text-amber-400/80 text-center">
                  {emptyCriticalFields.length > 0
                    ? `${emptyCriticalFields.length} critical field(s) missing: ${emptyCriticalFields.map((f) => f.key).join(', ')}`
                    : `${uncertainCriticalFields.length} critical field(s) must be verified before confirmation.`}
                </p>
              )}
            </div>
          )}


          {confirmed && (
            <div className="mt-2 flex flex-col gap-1.5 rounded-xl bg-success-500/10 border border-success-500/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-success-400" />
                <span className="text-xs font-bold text-success-300 uppercase tracking-wider">
                  Doctor Lock Enforced
                </span>
              </div>
              <span className="text-xs text-navy-200">
                Approved & locked by <strong className="text-white">{draft.confirmedBy || doctorName}</strong> on{' '}
                <span className="text-navy-300">{draft.confirmedAt ? new Date(draft.confirmedAt).toLocaleString() : 'Just now'}</span>.
              </span>
              <span className="text-xs text-success-400">
                Care plan activated. Patient reminders and dosing schedule are now live.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
