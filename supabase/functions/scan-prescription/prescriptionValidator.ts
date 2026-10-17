/**
 * PulseBridge AI — Prescription Extraction Validator & Grounding Guard
 * File: supabase/functions/scan-prescription/prescriptionValidator.ts
 *
 * Requirements:
 * 1. Validate every returned field against the existing application model (PrescriptionField, PrescriptionDraft).
 * 2. Reject malformed JSON, unexpected types, or unsupported statuses.
 * 3. Treat model output as untrusted input.
 * 4. Ensure missing or illegible critical fields strictly remain uncertain (never hallucinate details).
 * 5. Return an unconfirmed draft (confirmed: false) compatible with frontend types.
 * 6. Never claim medical verification.
 */

import type { PrescriptionField, PrescriptionDraft, PrescriptionFieldStatus } from '../../../src/types';

export class PrescriptionValidationError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'PrescriptionValidationError';
    this.code = code;
  }
}

export interface ValidatedPrescriptionResult {
  draft: PrescriptionDraft;
  missingCriticalFields: string[];
  confidence: 'high' | 'medium' | 'low';
  disclaimer: string;
}

const CRITICAL_KEYS = ['medicine', 'dosage', 'frequency', 'duration'] as const;
const VALID_STATUSES: PrescriptionFieldStatus[] = ['uncertain', 'confirmed', 'editable'];

const DEFAULT_LABEL_KEYS: Record<string, string> = {
  medicine: 'rx_field_medicine',
  dosage: 'rx_field_dosage',
  frequency: 'rx_field_frequency',
  duration: 'rx_field_duration',
  instructions: 'rx_field_instructions',
  route: 'rx_field_route',
  prescription_date: 'rx_field_date',
  prescriber: 'rx_field_prescriber',
};

/**
 * Validates untrusted AI model output, sanitizes fields, enforces uncertainty,
 * and packages a safe, unconfirmed PrescriptionDraft.
 */
export function validatePrescriptionScanOutput(
  rawModelOutput: unknown,
  patientId: string,
  imageUrl: string
): ValidatedPrescriptionResult {
  if (!rawModelOutput || typeof rawModelOutput !== 'object') {
    throw new PrescriptionValidationError(
      'Model response is not a valid JSON object.',
      'INVALID_MODEL_OUTPUT'
    );
  }

  const rawObj = rawModelOutput as Record<string, unknown>;

  // Fields must be an array if provided
  let candidateFields: unknown[] = [];
  if (Array.isArray(rawObj.fields)) {
    candidateFields = rawObj.fields;
  } else if (rawObj.extractedFields && Array.isArray(rawObj.extractedFields)) {
    candidateFields = rawObj.extractedFields;
  } else {
    throw new PrescriptionValidationError(
      'Model response missing "fields" array.',
      'MISSING_FIELDS_ARRAY'
    );
  }

  const validatedFields: PrescriptionField[] = [];
  const seenKeys = new Set<string>();

  for (const item of candidateFields) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;

    const key = typeof f.key === 'string' ? f.key.trim().toLowerCase() : '';
    if (!key) continue;

    // Prevent duplicate keys
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const value = typeof f.value === 'string' ? f.value.trim() : '';
    let status: PrescriptionFieldStatus = 'uncertain';

    if (typeof f.status === 'string' && VALID_STATUSES.includes(f.status as PrescriptionFieldStatus)) {
      status = f.status as PrescriptionFieldStatus;
    }

    // Safety rule: Any empty value or missing detail MUST be uncertain
    if (!value) {
      status = 'uncertain';
    }

    const labelKey = typeof f.labelKey === 'string' && f.labelKey.trim()
      ? f.labelKey.trim()
      : (DEFAULT_LABEL_KEYS[key] || `rx_field_${key}`);

    validatedFields.push({
      key,
      labelKey,
      value,
      status,
    });
  }

  // Ensure all 4 critical keys are present in the fields array
  for (const critKey of CRITICAL_KEYS) {
    if (!seenKeys.has(critKey)) {
      validatedFields.push({
        key: critKey,
        labelKey: DEFAULT_LABEL_KEYS[critKey],
        value: '',
        status: 'uncertain',
      });
      seenKeys.add(critKey);
    }
  }

  // Ensure 'instructions' exists for completeness
  if (!seenKeys.has('instructions')) {
    validatedFields.push({
      key: 'instructions',
      labelKey: DEFAULT_LABEL_KEYS.instructions,
      value: '',
      status: 'uncertain',
    });
  }

  // Identify missing critical fields (empty or uncertain)
  const missingCriticalFields = validatedFields
    .filter((f) => (CRITICAL_KEYS as readonly string[]).includes(f.key) && (!f.value || f.status === 'uncertain'))
    .map((f) => f.key);

  const confidence: 'high' | 'medium' | 'low' =
    missingCriticalFields.length === 0 ? 'high' : missingCriticalFields.length <= 2 ? 'medium' : 'low';

  const rawText =
    typeof rawObj.rawTranscription === 'string'
      ? rawObj.rawTranscription.trim()
      : typeof rawObj.rawText === 'string'
      ? rawObj.rawText.trim()
      : null;

  const routeVal = validatedFields.find((f) => f.key === 'route')?.value || undefined;
  const rxDateVal = validatedFields.find((f) => f.key === 'prescription_date')?.value || undefined;
  const prescriberVal = validatedFields.find((f) => f.key === 'prescriber')?.value || undefined;

  // Assemble safe unconfirmed draft
  const draft: PrescriptionDraft = {
    id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    patientId,
    imageUrl: imageUrl || '',
    uploadedAt: new Date().toISOString(),
    fields: validatedFields,
    confirmed: false,
    confirmedAt: null,
    confirmedBy: null,
    rawText,
    route: routeVal,
    prescriptionDate: rxDateVal,
    prescriber: prescriberVal,
    status: missingCriticalFields.length > 0 ? 'uncertain_fields' : 'ready_for_doctor_review',
  };

  return {
    draft,
    missingCriticalFields,
    confidence,
    disclaimer:
      'AI-extracted draft for clinical review only. Non-diagnostic. Must be verified and locked by an authorized physician before medication plan activation.',
  };
}
