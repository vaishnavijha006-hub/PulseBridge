import { useState } from 'react';
import { Check, AlertTriangle, Edit3, Save, Lock, ShieldAlert } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import type { PrescriptionDraft, PrescriptionField } from '@/types';

interface PrescriptionReviewProps {
  draft: PrescriptionDraft;
  patientAllergies?: string;
  onConfirm: (updatedFields: PrescriptionField[]) => void;
}

export function PrescriptionReview({ draft, patientAllergies, onConfirm }: PrescriptionReviewProps) {
  const { t } = useLanguage();
  const [fields, setFields] = useState<PrescriptionField[]>(draft.fields.map(f => ({ ...f })));
  const [confirmed, setConfirmed] = useState(draft.confirmed);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const CRITICAL_KEYS = ['medicine', 'dosage', 'frequency', 'duration'];

  const uncertainFields = fields.filter(f => f.status === 'uncertain');
  const confirmedFields = fields.filter(f => f.status !== 'uncertain');
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
  const allergyConflict = Boolean(
    patientAllergies &&
    patientAllergies.toLowerCase() !== 'none' &&
    fields.some(
      (f) =>
        f.key === 'medicine' &&
        f.value &&
        (patientAllergies.toLowerCase().includes(f.value.toLowerCase()) ||
          f.value.toLowerCase().includes(patientAllergies.toLowerCase().split(',')[0].trim()))
    )
  );

  const handleEdit = (key: string, value: string) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, value } : f));
  };

  const handleMarkResolved = (key: string) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, status: 'confirmed' } : f));
    setEditingKey(null);
  };

  const handleConfirm = () => {
    if (hasUnresolved) {
      setError('Critical fields (medicine, dosage, frequency, duration) must be verified and non-empty.');
      setTimeout(() => setError(null), 4000);
      return;
    }
    const updated = fields.map(f => ({ ...f, status: 'confirmed' as const }));
    setFields(updated);
    setConfirmed(true);
    onConfirm(updated);
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
        {/* Image side */}
        <div className="p-5">
          <span className="text-sm font-semibold text-navy-200 mb-3 block">{t('doctor_rx_image')}</span>
          <div className="rounded-xl border border-navy-600 bg-navy-800/50 overflow-hidden">
            <img src={draft.imageUrl} alt="Prescription" className="w-full max-h-72 object-contain bg-navy-900" />
          </div>
        </div>

        {/* Fields side */}
        <div className="p-5 flex flex-col gap-3">
          <span className="text-sm font-semibold text-navy-200">{t('doctor_rx_fields')}</span>

          {allergyConflict && (
            <div className="rounded-xl border border-danger-500/50 bg-danger-500/15 p-3 flex items-start gap-2.5 text-danger-300">
              <ShieldAlert className="w-4 h-4 text-danger-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col text-xs">
                <span className="font-bold text-danger-200 uppercase tracking-wide">
                  ⚠️ Allergy Alert: Patient Sensitive to "{patientAllergies}"
                </span>
                <span className="text-danger-300 mt-0.5">
                  Verify medication and drug class compatibility before confirming this care plan.
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
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-success-500/10 border border-success-500/30 px-4 py-3">
              <Check className="w-5 h-5 text-success-400" />
              <span className="text-sm font-medium text-success-300">
                Care plan activated. Schedules are now live for the patient.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
