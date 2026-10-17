import { useState, useMemo } from 'react';
import {
  Check,
  AlertTriangle,
  Edit3,
  Save,
  Lock,
  ShieldAlert,
  FileText,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  Clock,
  ShieldCheck,
  History,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import { extractPrescriptionFromText } from '@/services/prescriptionExtractor';
import { evaluatePrescriptionSafety } from '@/services/prescriptionSafetyWorkflow';
import type {
  PrescriptionDraft,
  PrescriptionField,
  MedicationSchedule,
  PatientProfile,
  PrescriptionWorkflowState,
} from '@/types';

interface PrescriptionReviewProps {
  draft: PrescriptionDraft;
  patientAllergies?: string;
  patientCurrentMeds?: string;
  doctorName?: string;
  activeSchedules?: MedicationSchedule[];
  previousPrescriptions?: PrescriptionDraft[];
  onConfirm: (updatedFields: PrescriptionField[]) => Promise<any> | void;
}

export function PrescriptionReview({
  draft,
  patientAllergies,
  patientCurrentMeds,
  doctorName = 'Dr. Anita Desai, MD',
  activeSchedules = [],
  previousPrescriptions = [],
  onConfirm,
}: PrescriptionReviewProps) {
  const { t } = useLanguage();
  const [fields, setFields] = useState<PrescriptionField[]>(draft.fields.map((f) => ({ ...f })));
  const [confirmed, setConfirmed] = useState(draft.confirmed);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMediaTab, setActiveMediaTab] = useState<'image' | 'text'>('image');
  const [acknowledgedAllergy, setAcknowledgedAllergy] = useState(false);
  const [acknowledgedConflict, setAcknowledgedConflict] = useState(false);
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

  // Patient profile representation for safety evaluation
  const patientProfile: PatientProfile = useMemo(
    () => ({
      id: draft.patientId,
      name: 'Patient',
      age: 50,
      gender: 'other',
      phone: '',
      symptoms: '',
      allergies: patientAllergies ?? 'None',
      currentMeds: patientCurrentMeds ?? 'None',
      language: 'en',
    }),
    [draft.patientId, patientAllergies, patientCurrentMeds]
  );

  // Evaluate safety & auto-readiness workflow state
  const currentDraftForEval: PrescriptionDraft = useMemo(
    () => ({
      ...draft,
      fields,
      confirmed,
    }),
    [draft, fields, confirmed]
  );

  const safetyAssessment = useMemo(() => {
    return evaluatePrescriptionSafety(
      currentDraftForEval,
      patientProfile,
      activeSchedules,
      previousPrescriptions,
      { acknowledgedAllergy, acknowledgedConflict }
    );
  }, [
    currentDraftForEval,
    patientProfile,
    activeSchedules,
    previousPrescriptions,
    acknowledgedAllergy,
    acknowledgedConflict,
  ]);

  const workflowState: PrescriptionWorkflowState = safetyAssessment.workflowState;

  const handleEdit = (key: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
  };

  const handleMarkResolved = (key: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'confirmed' } : f)));
    setEditingKey(null);
  };

  const handleConfirm = async () => {
    if (hasUnresolved) {
      setError('Critical fields (medicine, dosage, frequency, duration) must be verified and non-empty.');
      setTimeout(() => setError(null), 4000);
      return;
    }

    if (!safetyAssessment.canDoctorApprove) {
      setError(
        safetyAssessment.blockingReasons[0] ||
          'Allergy conflicts or prescription conflicts must be explicitly resolved before confirmation.'
      );
      setTimeout(() => setError(null), 5000);
      return;
    }

    const updated = fields.map((f) => ({ ...f, status: 'confirmed' as const }));
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await onConfirm(updated);
      if (res && typeof res === 'object' && 'error' in res && res.error) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }
      if (res === false) {
        setError('Confirmation failed. Please try again.');
        setIsSubmitting(false);
        return;
      }
      setFields(updated);
      setConfirmed(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm prescription. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Run AI / Grounded Prescription Extraction from text
  const handleExtractFromText = () => {
    if (!rawText.trim()) return;
    const extracted = extractPrescriptionFromText(rawText);
    setFields(extracted.fields);
  };

  return (
    <div className="rounded-2xl border border-navy-600 bg-navy-700/50 overflow-hidden flex flex-col">
      {/* Top Header Bar */}
      <div className="px-5 py-4 border-b border-navy-600 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            {t('doctor_rx_verify')}
          </h3>
          {/* Workflow State Badge */}
          {workflowState === 'doctor_approved' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-success-500/20 text-success-300 border border-success-500/40 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Doctor Approved & Locked
            </span>
          )}
          {workflowState === 'ready_for_doctor_review' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Ready for Doctor Review
            </span>
          )}
          {workflowState === 'uncertain_fields' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Uncertain Fields ({uncertainFields.length})
            </span>
          )}
          {workflowState === 'allergy_alert' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-danger-500/20 text-danger-300 border border-danger-500/40 flex items-center gap-1.5 animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" />
              Allergy Conflict Alert
            </span>
          )}
          {workflowState === 'prescription_conflict' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-600/20 text-amber-300 border border-amber-600/40 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Prescription Conflict Alert
            </span>
          )}
          {workflowState === 'rejected_or_superseded' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Superseded / Inactive
            </span>
          )}
          {workflowState === 'needs_review' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Needs Clinical Review
            </span>
          )}
        </div>

        {confirmed ? (
          <StatusBadge status="confirmed" label={t('rx_doctor_confirmed')} icon={<Check className="w-3 h-3" />} size="md" />
        ) : (
          <StatusBadge status="open" label={`${uncertainFields.length} ${t('rx_check')}`} icon={<AlertTriangle className="w-3 h-3" />} size="md" />
        )}
      </div>

      {/* Safety & Auto-Readiness Summary Strip */}
      <div className="bg-navy-800/80 border-b border-navy-600 px-5 py-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Parameters:</span>
          {safetyAssessment.checks.criticalFields.status === 'passed' ? (
            <span className="text-success-400 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" /> Grounded & Verified
            </span>
          ) : (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Unclear / Missing
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Allergy Screen:</span>
          {safetyAssessment.checks.allergies.status === 'passed' ? (
            <span className="text-success-400 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" /> No Conflict
            </span>
          ) : safetyAssessment.checks.allergies.status === 'alert' ? (
            <span className="text-danger-400 font-semibold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Allergy Conflict
            </span>
          ) : (
            <span className="text-blue-300 font-semibold">Unknown (No Data)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Duplicate Meds:</span>
          {safetyAssessment.checks.duplicateMeds.status === 'passed' ? (
            <span className="text-success-400 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" /> No Duplicate
            </span>
          ) : safetyAssessment.checks.duplicateMeds.status === 'alert' ? (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Duplicate Detected
            </span>
          ) : (
            <span className="text-blue-300 font-semibold">Unknown (No Data)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Prior Prescriptions:</span>
          {safetyAssessment.checks.conflictingPrescriptions.status === 'alert' ? (
            <span className="text-danger-400 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Conflicting Rx
            </span>
          ) : (
            <span className="text-success-400 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" /> Reconciled
            </span>
          )}
        </div>
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

          {draft.route && (
            <div className="text-xs text-slate-300 bg-navy-800/40 p-2.5 rounded-lg border border-navy-600 flex items-center justify-between">
              <span className="text-slate-400">Route of Administration:</span>
              <span className="font-semibold text-white">{draft.route}</span>
            </div>
          )}
          {draft.prescriber && (
            <div className="text-xs text-slate-300 bg-navy-800/40 p-2.5 rounded-lg border border-navy-600 flex items-center justify-between">
              <span className="text-slate-400">Prescribing Physician:</span>
              <span className="font-semibold text-white">{draft.prescriber}</span>
            </div>
          )}
          {draft.prescriptionDate && (
            <div className="text-xs text-slate-300 bg-navy-800/40 p-2.5 rounded-lg border border-navy-600 flex items-center justify-between">
              <span className="text-slate-400">Prescription Date:</span>
              <span className="font-semibold text-white">{draft.prescriptionDate}</span>
            </div>
          )}
        </div>

        {/* Right: Fields & Safety Alerts */}
        <div className="p-5 flex flex-col gap-3">
          <span className="text-sm font-semibold text-navy-200">{t('doctor_rx_fields')}</span>

          {/* Allergy Conflict Banner & Resolution Action */}
          {safetyAssessment.checks.allergies.status === 'alert' && (
            <div className="rounded-xl border border-danger-500/50 bg-danger-500/15 p-3.5 flex flex-col gap-2.5 text-danger-300">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-danger-400 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col text-xs">
                  <span className="font-bold text-danger-200 uppercase tracking-wide">
                    ⚠️ Critical Allergy Conflict Detected
                  </span>
                  <span className="text-danger-300 mt-1 leading-relaxed">
                    {safetyAssessment.checks.allergies.evidence}
                  </span>
                </div>
              </div>
              {!confirmed && (
                <label className="flex items-center gap-2 pt-2 border-t border-danger-500/30 text-xs text-danger-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledgedAllergy}
                    onChange={(e) => setAcknowledgedAllergy(e.target.checked)}
                    className="rounded border-danger-400 text-danger-600 focus:ring-danger-500"
                  />
                  <span>
                    <strong>Clinical Override</strong>: I have reviewed this allergy and verified it is clinically safe to proceed.
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Duplicate Medication Banner & Resolution Action */}
          {safetyAssessment.checks.duplicateMeds.status === 'alert' && (
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/15 p-3.5 flex flex-col gap-2.5 text-amber-300">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col text-xs">
                  <span className="font-bold text-amber-200 uppercase tracking-wide">
                    ⚠️ Duplicate Therapy Detected
                  </span>
                  <span className="text-amber-300 mt-1 leading-relaxed">
                    {safetyAssessment.checks.duplicateMeds.evidence}
                  </span>
                </div>
              </div>
              {!confirmed && (
                <label className="flex items-center gap-2 pt-2 border-t border-amber-500/30 text-xs text-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledgedConflict}
                    onChange={(e) => setAcknowledgedConflict(e.target.checked)}
                    className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    <strong>Reconciliation Override</strong>: I have reconciled existing active medications with this new prescription.
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Conflicting Prescription Banner */}
          {safetyAssessment.checks.conflictingPrescriptions.status === 'alert' && (
            <div className="rounded-xl border border-danger-500/50 bg-danger-500/15 p-3.5 flex flex-col gap-2.5 text-danger-300">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-danger-400 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col text-xs">
                  <span className="font-bold text-danger-200 uppercase tracking-wide">
                    ⚠️ Conflicting Prior Prescription
                  </span>
                  <span className="text-danger-300 mt-1 leading-relaxed">
                    {safetyAssessment.checks.conflictingPrescriptions.evidence}
                  </span>
                </div>
              </div>
              {!confirmed && (
                <label className="flex items-center gap-2 pt-2 border-t border-danger-500/30 text-xs text-danger-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledgedConflict}
                    onChange={(e) => setAcknowledgedConflict(e.target.checked)}
                    className="rounded border-danger-400 text-danger-600 focus:ring-danger-500"
                  />
                  <span>
                    <strong>Supersede Prior Rx</strong>: I confirm this new order supersedes the previous conflicting prescription.
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Field rows */}
          {sortedFields.map((field) => {
            const isUncertain = field.status === 'uncertain';
            const isEditing = editingKey === field.key;
            const label = t(field.labelKey as any) || field.key;

            return (
              <div
                key={field.key}
                className={cn(
                  'rounded-xl border p-3 flex flex-col gap-2 transition-all',
                  confirmed
                    ? 'border-success-500/30 bg-success-500/5'
                    : isUncertain
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-navy-600 bg-navy-800/30'
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
                      className="flex-1 rounded-lg bg-navy-900 border border-teal-500/50 px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      onClick={() => handleMarkResolved(field.key)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-500 text-navy-900 text-xs font-bold hover:bg-teal-400"
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-white font-medium break-all">
                      {field.value || <span className="text-slate-400 italic">Unspecified</span>}
                    </span>
                    {!confirmed && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingKey(field.key)}
                          className="p-1 rounded text-navy-400 hover:text-white hover:bg-navy-700"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {isUncertain && field.value && (
                          <button
                            onClick={() => handleMarkResolved(field.key)}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-500/20 text-teal-300 hover:bg-teal-500/30"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Confirm Button & Doctor Lock Controls */}
          {!confirmed && (
            <div className="mt-2 flex flex-col gap-2">
              {error && (
                <div className="flex items-center gap-2 text-sm text-danger-400 bg-danger-500/10 p-3 rounded-xl border border-danger-500/30">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <button
                onClick={handleConfirm}
                disabled={hasUnresolved || !safetyAssessment.canDoctorApprove || isSubmitting}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold transition-all min-h-[48px]',
                  hasUnresolved || !safetyAssessment.canDoctorApprove || isSubmitting
                    ? 'bg-navy-600 text-navy-400 cursor-not-allowed'
                    : 'bg-teal-500 text-navy-900 hover:bg-teal-400 shadow-lg shadow-teal-500/20'
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-teal-300" />
                    <span>Confirming care plan...</span>
                  </>
                ) : hasUnresolved ? (
                  <>
                    <Lock className="w-4 h-4" />
                    Resolve uncertain fields first
                  </>
                ) : !safetyAssessment.canDoctorApprove ? (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    Acknowledge clinical alerts first
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {t('rx_confirm_plan')}
                  </>
                )}
              </button>
              {(hasUnresolved || !safetyAssessment.canDoctorApprove) && (
                <p className="text-xs text-amber-400/80 text-center">
                  {hasUnresolved
                    ? emptyCriticalFields.length > 0
                      ? `${emptyCriticalFields.length} critical field(s) missing: ${emptyCriticalFields.map((f) => f.key).join(', ')}`
                      : `${uncertainCriticalFields.length} critical field(s) must be verified before confirmation.`
                    : safetyAssessment.blockingReasons[0]}
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
                <span className="text-navy-300">
                  {draft.confirmedAt ? new Date(draft.confirmedAt).toLocaleString() : 'Just now'}
                </span>.
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
