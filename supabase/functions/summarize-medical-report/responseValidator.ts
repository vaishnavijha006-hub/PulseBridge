/**
 * PulseBridge AI — Untrusted AI Response Validator & Clinical Grounding Engine
 *
 * Enforces strict validation on AI model outputs before any data is sent to clinicians:
 * 1. Schema enforcement: Rejects missing fields, invalid types, and unexpected formats.
 * 2. Grounding verification: Every key finding and abnormal finding must trace to the source text or findings.
 * 3. Exact string preservation: Ensures numbers and units are not converted or rounded by the LLM.
 * 4. Missing reference range protection: If no reference range was supplied, flags must remain 'unspecified_range'.
 * 5. Disclaimer presence: Enforces standard clinical review aid disclaimer.
 */

import type { MedicalReport, ReportSummary, MedicalReportFinding, SummaryEngineMode } from '../../../src/types';

export const CLINICAL_DISCLAIMER_TEXT =
  'This automated report summary is a review aid and does NOT replace independent clinical judgment, official laboratory reports, or professional medical evaluation. Clinicians must directly inspect and verify original source documents.';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  summary?: ReportSummary;
}

/**
 * Validates untrusted AI model output against strict schema and clinical grounding rules.
 */
export function validateAIModelResponse(
  rawOutput: unknown,
  sourceReport: Readonly<MedicalReport>,
  modelName: string = 'qwen/qwen3.8-27b',
  latencyMs: number = 0,
  providerName: 'groq' | 'gemini' | 'anthropic' | 'openai' | 'mock_test_provider' | 'none' = 'groq'
): ValidationResult {
  const errors: string[] = [];

  if (!rawOutput || typeof rawOutput !== 'object') {
    return { valid: false, errors: ['Model output is null, undefined, or non-object.'] };
  }

  const output = rawOutput as Record<string, any>;

  // 1. Report Overview Validation
  if (!output.reportOverview || typeof output.reportOverview !== 'object') {
    errors.push('Missing or invalid "reportOverview" object.');
  }

  const rawOverview = output.reportOverview || {};
  const reportOverview: ReportSummary['reportOverview'] = {
    title: String(rawOverview.title || sourceReport.title || 'Diagnostic Report'),
    reportType: String(rawOverview.reportType || sourceReport.reportType || 'other'),
    date: String(rawOverview.date || sourceReport.date || 'Date not recorded'),
    facility: rawOverview.facility || sourceReport.facilityOrLab,
    orderingDoctor: rawOverview.orderingDoctor || sourceReport.orderingDoctor,
    sourceIntegrity: ['complete', 'incomplete', 'unreadable', 'empty'].includes(rawOverview.sourceIntegrity)
      ? rawOverview.sourceIntegrity
      : 'complete',
  };

  // Compile full source search corpus to verify grounded citations
  const sourceCorpus = [
    sourceReport.rawText || '',
    ...(sourceReport.structuredFindings || []).map(
      (f) => `${f.testOrParameter} ${f.value} ${f.unit || ''} ${f.referenceRange || ''} ${f.clinicalNotes || ''}`
    ),
  ]
    .join(' ')
    .toLowerCase();

  // 2. Key Findings Validation
  if (!Array.isArray(output.keyFindings)) {
    errors.push('"keyFindings" must be an array.');
  }

  const rawKeyFindings = Array.isArray(output.keyFindings) ? output.keyFindings : [];
  const validatedKeyFindings: ReportSummary['keyFindings'] = [];

/**
 * Verifies that a finding's extracted value and unit are strictly grounded in the source report.
 * Rejects altered values, sign changes, fabricated numbers, or substituted units.
 */
function verifyFindingValueAndUnitGrounding(
  name: string,
  value: string,
  unit: string | null,
  sourceReport: Readonly<MedicalReport>
): { grounded: boolean; reason?: string } {
  const normName = name.toLowerCase().trim();
  const normValue = value.toLowerCase().trim();
  const normUnit = (unit || '').toLowerCase().trim();

  // 1. Check matching structured findings
  const matchingStructured = (sourceReport.structuredFindings || []).find((sf) => {
    const sfName = sf.testOrParameter.toLowerCase().trim();
    return sfName === normName || sfName.includes(normName) || normName.includes(sfName);
  });

  if (matchingStructured) {
    const srcVal = matchingStructured.value.toLowerCase().trim();
    const srcUnit = (matchingStructured.unit || '').toLowerCase().trim();

    if (srcVal !== normValue) {
      return {
        grounded: false,
        reason: `Value mismatch for "${name}": extracted value "${value}" does not match source value "${matchingStructured.value}".`,
      };
    }

    if (normUnit && srcUnit && normUnit !== srcUnit) {
      return {
        grounded: false,
        reason: `Unit mismatch for "${name}": extracted unit "${unit}" does not match source unit "${matchingStructured.unit}".`,
      };
    }

    return { grounded: true };
  }

  // 2. If no matching structured finding, check rawText
  const rawText = (sourceReport.rawText || '').toLowerCase();

  if (!rawText.includes(normValue)) {
    return {
      grounded: false,
      reason: `Extracted value "${value}" for "${name}" is not found in source document text.`,
    };
  }

  if (normUnit && !rawText.includes(normUnit)) {
    return {
      grounded: false,
      reason: `Extracted unit "${unit}" for "${name}" is not found in source document text.`,
    };
  }

  return { grounded: true };
}

  for (let i = 0; i < rawKeyFindings.length; i++) {
    const kf = rawKeyFindings[i];
    if (!kf || typeof kf !== 'object') {
      errors.push(`keyFindings[${i}] is not a valid object.`);
      continue;
    }

    const name = String(kf.name || '').trim();
    const value = String(kf.value !== undefined && kf.value !== null ? kf.value : '').trim();

    if (!name) {
      errors.push(`keyFindings[${i}] has an empty name.`);
      continue;
    }
    if (!value) {
      errors.push(`keyFindings[${i}] (${name}) has an empty value.`);
      continue;
    }

    // Grounding check: verify that finding name exists in source text
    const normalizedName = name.toLowerCase();
    const nameFoundInSource =
      sourceCorpus.includes(normalizedName) ||
      (sourceReport.structuredFindings || []).some((sf) =>
        sf.testOrParameter.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(sf.testOrParameter.toLowerCase())
      );

    if (!nameFoundInSource) {
      errors.push(`Unverified / fabricated test name "${name}" in keyFindings[${i}] not found in source document.`);
      continue;
    }

    const unit = kf.unit ? String(kf.unit).trim() : null;

    // Strict Grounding check: verify value and unit match source document
    const valueCheck = verifyFindingValueAndUnitGrounding(name, value, unit, sourceReport);
    if (!valueCheck.grounded) {
      errors.push(`Ungrounded clinical detail in keyFindings[${i}]: ${valueCheck.reason}`);
      continue;
    }

    const refRange = kf.referenceRange ? String(kf.referenceRange).trim() : null;

    let flag: 'normal' | 'abnormal' | 'unspecified_range' = 'normal';
    if (['normal', 'abnormal', 'unspecified_range'].includes(kf.flag)) {
      flag = kf.flag;
    }

    // Safety rule: If no reference range exists in source or model, flag CANNOT be normal or abnormal
    if (!refRange || /\b(not provided|none|n\/a|unknown|unspecified)\b/i.test(refRange)) {
      flag = 'unspecified_range';
    }

    validatedKeyFindings.push({
      name,
      value,
      unit,
      referenceRange: refRange || 'Reference range not provided',
      flag,
      sourceEvidence: String(kf.sourceEvidence || `${name}: ${value} ${unit || ''}`).trim(),
    });
  }

  // 3. Abnormal Values Validation
  if (!Array.isArray(output.abnormalValues)) {
    errors.push('"abnormalValues" must be an array.');
  }

  const rawAbnormals = Array.isArray(output.abnormalValues) ? output.abnormalValues : [];
  const validatedAbnormals: ReportSummary['abnormalValues'] = [];

  for (let i = 0; i < rawAbnormals.length; i++) {
    const af = rawAbnormals[i];
    if (!af || typeof af !== 'object') {
      errors.push(`abnormalValues[${i}] is not a valid object.`);
      continue;
    }

    const name = String(af.name || '').trim();
    const value = String(af.value !== undefined && af.value !== null ? af.value : '').trim();

    if (!name || !value) {
      errors.push(`abnormalValues[${i}] missing name or value.`);
      continue;
    }

    // Grounding check: verify that abnormal finding name exists in source
    const normalizedName = name.toLowerCase();
    const nameFoundInSource =
      sourceCorpus.includes(normalizedName) ||
      (sourceReport.structuredFindings || []).some((sf) =>
        sf.testOrParameter.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(sf.testOrParameter.toLowerCase())
      );

    if (!nameFoundInSource) {
      errors.push(`Unverified / fabricated abnormal finding "${name}" in abnormalValues[${i}] not found in source document.`);
      continue;
    }

    const unit = af.unit ? String(af.unit).trim() : null;

    // Strict Grounding check: verify abnormal value and unit match source document
    const valueCheck = verifyFindingValueAndUnitGrounding(name, value, unit, sourceReport);
    if (!valueCheck.grounded) {
      errors.push(`Ungrounded clinical detail in abnormalValues[${i}]: ${valueCheck.reason}`);
      continue;
    }

    const refRange = String(af.referenceRange || 'Reference range not provided').trim();

    // Safety rule: Cannot flag as abnormal if reference range is completely missing and unstated
    if (refRange === 'Reference range not provided') {
      errors.push(`abnormalValues[${i}] (${name}) has no reference range. Unspecified ranges cannot be classified as abnormal.`);
      continue;
    }

    validatedAbnormals.push({
      name,
      value,
      unit,
      referenceRange: refRange,
      interpretation: String(af.interpretation || 'Outside clinical reference bounds').trim(),
      sourceEvidence: String(af.sourceEvidence || `${name}: ${value} (Ref: ${refRange})`).trim(),
    });
  }

  // 4. Missing or Uncertain Info
  const missingOrUncertainInfo: ReportSummary['missingOrUncertainInfo'] = [];
  if (Array.isArray(output.missingOrUncertainInfo)) {
    for (const item of output.missingOrUncertainInfo) {
      if (item && typeof item === 'object' && item.item && item.reason) {
        missingOrUncertainInfo.push({
          item: String(item.item).trim(),
          reason: String(item.reason).trim(),
        });
      }
    }
  }

  // Check if source text contains unreadable markers and ensure it is flagged
  const sourceHasUnreadable =
    /\b(unreadable|smudge|illegible|blurred)\b/i.test(sourceReport.rawText || '') ||
    (sourceReport.structuredFindings || []).some((f) =>
      /\b(unreadable|smudge|illegible|blurred)\b/i.test(f.value)
    );

  if (
    sourceHasUnreadable &&
    !missingOrUncertainInfo.some((m) => /unreadable|smudge|illegible/i.test(m.reason + m.item))
  ) {
    missingOrUncertainInfo.push({
      item: 'Source Document Legibility',
      reason: 'Physical print artifacts or illegible text regions detected in source document.',
    });
  }

  // 5. Needs Clinician Review
  const needsClinicianReview: ReportSummary['needsClinicianReview'] = [];
  if (Array.isArray(output.needsClinicianReview)) {
    for (const item of output.needsClinicianReview) {
      if (item && typeof item === 'object' && item.questionOrFinding) {
        needsClinicianReview.push({
          questionOrFinding: String(item.questionOrFinding).trim(),
          context: String(item.context || 'Requires clinical interpretation').trim(),
        });
      }
    }
  }

  // If there are abnormal values, ensure clinician review contains at least one prompt
  if (validatedAbnormals.length > 0 && needsClinicianReview.length === 0) {
    needsClinicianReview.push({
      questionOrFinding: `Evaluate ${validatedAbnormals.length} flagged abnormal result(s)`,
      context: 'Review clinical significance against patient history and current care plan.',
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const summary: ReportSummary = {
    reportId: sourceReport.id,
    patientId: sourceReport.patientId,
    reportOverview,
    keyFindings: validatedKeyFindings,
    abnormalValues: validatedAbnormals,
    missingOrUncertainInfo,
    needsClinicianReview,
    disclaimer: CLINICAL_DISCLAIMER_TEXT,
    engineMode: 'ai_assisted' as SummaryEngineMode,
    aiMetadata: {
      provider: providerName,
      modelName,
      verifiedGrounded: true,
      latencyMs,
    },
    generatedAt: new Date().toISOString(),
  };

  return { valid: true, errors: [], summary };
}
