import type { MedicalReport, ReportSummary, MedicalReportFinding } from '@/types';

/**
 * PulseBridge AI — Safe Medical Report Summarizer (Rule-Based MVP)
 *
 * CLINICAL SAFETY CONSTRAINTS:
 * 1. Pure deterministic function: Zero mutations to input report, care plans, prescriptions, or triage scores.
 * 2. Grounded extraction: Every finding is strictly traced to supplied text or structured parameters.
 * 3. Never invent values, units, reference ranges, or medical diagnoses.
 * 4. Never recommend starting, stopping, or altering medications.
 * 5. Abnormal values are flagged ONLY when a usable reference range is supplied or explicitly labeled abnormal in source text.
 * 6. Missing reference ranges are explicitly declared as "Reference range not provided", NEVER assumed normal.
 * 7. Unreadable, empty, or incomplete text triggers prominent manual clinician review alerts.
 * 8. Untrusted input sanitization: Report text is treated as raw data and cannot alter summarizer heuristics.
 */

export const REPORT_SUMMARY_DISCLAIMER =
  'This automated report summary is a review aid and does NOT replace independent clinical judgment, official laboratory reports, or professional medical evaluation. Clinicians must directly inspect and verify original source documents.';

/**
 * Evaluates whether a numeric value falls within a given reference range string.
 * Returns 'normal', 'abnormal', or 'unspecified_range'.
 */
function evaluateValueAgainstRange(
  valStr: string,
  rangeStr?: string | null
): 'normal' | 'abnormal' | 'unspecified_range' {
  if (!rangeStr || rangeStr.trim() === '') return 'unspecified_range';
  const cleanRange = rangeStr.trim();
  if (/\b(not provided|none|n\/a|unknown|unspecified)\b/i.test(cleanRange)) {
    return 'unspecified_range';
  }

  const numVal = parseFloat(valStr.replace(/[^0-9.-]/g, ''));
  if (isNaN(numVal)) return 'unspecified_range';

  // Format: "< X" or "<= X"
  const lessThanMatch = cleanRange.match(/^<(=)?\s*([0-9.]+)/);
  if (lessThanMatch) {
    const limit = parseFloat(lessThanMatch[2]);
    if (!isNaN(limit)) {
      return numVal <= limit ? 'normal' : 'abnormal';
    }
  }

  // Format: "> X" or ">= X"
  const greaterThanMatch = cleanRange.match(/^>(=)?\s*([0-9.]+)/);
  if (greaterThanMatch) {
    const limit = parseFloat(greaterThanMatch[2]);
    if (!isNaN(limit)) {
      return numVal >= limit ? 'normal' : 'abnormal';
    }
  }

  // Format: "Min - Max" or "Min to Max"
  const rangeMatch = cleanRange.match(/^([0-9.]+)\s*(?:-|to)\s*([0-9.]+)/i);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!isNaN(min) && !isNaN(max)) {
      return numVal >= min && numVal <= max ? 'normal' : 'abnormal';
    }
  }

  return 'unspecified_range';
}

/**
 * Summarizes a medical diagnostic or lab report deterministically.
 */
export function summarizeMedicalReport(report: Readonly<MedicalReport>): ReportSummary {
  const generatedAt = new Date().toISOString();

  // Defensive handling of null, undefined, or malformed inputs
  if (!report || typeof report !== 'object') {
    return {
      reportId: 'unknown',
      patientId: 'unknown',
      reportOverview: {
        title: 'Unknown or Malformed Report',
        reportType: 'other',
        date: 'Date not recorded',
        sourceIntegrity: 'empty',
      },
      keyFindings: [],
      abnormalValues: [],
      missingOrUncertainInfo: [
        {
          item: 'Report Payload',
          reason: 'Report data is missing, null, or malformed. Clinical document requires manual intake.',
        },
      ],
      needsClinicianReview: [
        {
          questionOrFinding: 'Source Report Unavailable',
          context: 'Verify patient report availability with lab or hospital diagnostic department.',
        },
      ],
      disclaimer: REPORT_SUMMARY_DISCLAIMER,
      engineMode: 'rule_based_mvp',
      generatedAt,
    };
  }

  const rawTextTrimmed = (report.rawText || '').trim();

  // Normalize findings list: support both structuredFindings and findings aliases
  const rawFindingsList = (
    report.structuredFindings ||
    (report as any).findings ||
    []
  ) as any[];

  // 1. Detect Source Integrity
  let sourceIntegrity: 'complete' | 'incomplete' | 'unreadable' | 'empty' = 'complete';

  const hasEmptyText = rawTextTrimmed.length === 0;
  const hasStructured = rawFindingsList.length > 0;
  const containsUnreadableMarker =
    /\b(unreadable|illegible|smudged|smudge|blurred|damaged|missing section|truncated)\b/i.test(
      rawTextTrimmed
    ) ||
    rawFindingsList.some((f) => {
      const v = String(f?.value || '').toLowerCase();
      const flagStr = String(f?.flag || '').toLowerCase();
      return (
        v.includes('unreadable') ||
        v.includes('smudge') ||
        v.includes('illegible') ||
        flagStr.includes('unreadable')
      );
    });

  if (hasEmptyText && !hasStructured) {
    sourceIntegrity = 'empty';
  } else if (containsUnreadableMarker) {
    sourceIntegrity = 'unreadable';
  } else if (hasEmptyText && hasStructured) {
    sourceIntegrity = 'incomplete';
  }

  // 2. Extract and Validate Findings
  const keyFindings: ReportSummary['keyFindings'] = [];
  const abnormalValues: ReportSummary['abnormalValues'] = [];
  const missingOrUncertainInfo: ReportSummary['missingOrUncertainInfo'] = [];
  const needsClinicianReview: ReportSummary['needsClinicianReview'] = [];

  // Missing metadata checks
  if (!report.facilityOrLab && !(report as any).facility) {
    missingOrUncertainInfo.push({
      item: 'Diagnostic Facility / Laboratory',
      reason: 'Originating diagnostic laboratory or hospital facility is not specified on record.',
    });
  }
  if (!report.orderingDoctor) {
    missingOrUncertainInfo.push({
      item: 'Ordering Clinician',
      reason: 'No ordering physician name was provided in the report metadata.',
    });
  }
  if (!report.date) {
    missingOrUncertainInfo.push({
      item: 'Specimen Collection / Report Date',
      reason: 'Report date is missing. Temporal correlation with current care plan required.',
    });
  }

  // Handle empty report state
  if (sourceIntegrity === 'empty') {
    missingOrUncertainInfo.push({
      item: 'Report Document Body',
      reason: 'Report content is empty or contains no readable discrete test findings. Document requires manual intake.',
    });
    needsClinicianReview.push({
      questionOrFinding: 'Source Report Empty / Unavailable',
      context: 'Manual clinical verification required. Verify patient report with ordering facility.',
    });

    return {
      reportId: report.id || 'unknown',
      patientId: report.patientId || 'unknown',
      reportOverview: {
        title: report.title || 'Untitled Report',
        reportType: report.reportType || 'other',
        date: report.date || 'Date not recorded',
        facility: report.facilityOrLab || (report as any).facility,
        orderingDoctor: report.orderingDoctor,
        sourceIntegrity,
      },
      keyFindings,
      abnormalValues,
      missingOrUncertainInfo,
      needsClinicianReview,
      disclaimer: REPORT_SUMMARY_DISCLAIMER,
      engineMode: 'rule_based_mvp',
      generatedAt,
    };
  }

  for (const f of rawFindingsList) {
    const testName: string =
      f.testOrParameter || f.testName || f.parameter || 'Unknown Test';
    const valString: string = f.value !== undefined && f.value !== null ? String(f.value) : '';
    const unitString: string | null = f.unit ? String(f.unit) : null;
    const refRangeString: string | null = f.referenceRange ? String(f.referenceRange) : null;

    const isValueUnreadable =
      !valString ||
      valString.trim() === '' ||
      /\b(unreadable|illegible|smudge|blurred)\b/i.test(valString) ||
      f.flag === 'uncertain_unreadable';

    if (isValueUnreadable) {
      missingOrUncertainInfo.push({
        item: testName,
        reason: `Value is unreadable, missing, or smudged in source report ("${valString || 'BLANK'}").`,
      });
      needsClinicianReview.push({
        questionOrFinding: `Verify unreadable result for ${testName}`,
        context: 'Source document value could not be reliably parsed; re-test or inspect physical carbon copy.',
      });
      continue;
    }

    const hasRefRange = Boolean(
      refRangeString &&
        refRangeString.trim() !== '' &&
        !/\b(not provided|none|n\/a|unknown|unspecified)\b/i.test(refRangeString)
    );

    let flag: 'normal' | 'abnormal' | 'unspecified_range';

    // 1. Explicit boolean flag
    if (f.isAbnormal === true) {
      flag = 'abnormal';
    } else if (f.isAbnormal === false) {
      flag = 'normal';
    } else if (
      f.flag === 'abnormal' ||
      f.flag === 'high' ||
      f.flag === 'critical' ||
      f.flag === 'low'
    ) {
      flag = 'abnormal';
    } else if (f.flag === 'normal') {
      flag = 'normal';
    } else if (hasRefRange) {
      flag = evaluateValueAgainstRange(valString, refRangeString);
    } else {
      flag = 'unspecified_range';
    }

    // Key Finding record (preserving exact original strings)
    keyFindings.push({
      name: testName,
      value: valString,
      unit: unitString,
      referenceRange: hasRefRange ? refRangeString : 'Reference range not provided',
      flag,
      sourceEvidence:
        f.sourceEvidence || `${testName}: ${valString}${unitString ? ' ' + unitString : ''}`,
    });

    // Abnormal Values Section: Only included when reference range exists or explicitly labeled
    if (flag === 'abnormal') {
      const refText = hasRefRange ? (refRangeString as string) : 'Labeled abnormal in report text';
      abnormalValues.push({
        name: testName,
        value: valString,
        unit: unitString,
        referenceRange: refText,
        interpretation:
          f.clinicalNotes ||
          f.notes ||
          (f.flag === 'critical' ? 'Critical elevation outside normal bounds' : 'Result is outside provided reference standard'),
        sourceEvidence:
          f.sourceEvidence || `${testName}: ${valString} ${unitString || ''} (Ref: ${refText})`,
      });
      needsClinicianReview.push({
        questionOrFinding: `Evaluate elevated/abnormal ${testName}: ${valString} ${unitString || ''}`,
        context: `Reported value is outside reference range (${refText}). Assess clinical significance.`,
      });
    }

    // Missing Reference Range Flag
    if (!hasRefRange) {
      missingOrUncertainInfo.push({
        item: `${testName} Reference Range`,
        reason: 'Report does not supply an applicable reference range. Result cannot be classified as normal or abnormal without clinical reference standards.',
      });
      needsClinicianReview.push({
        questionOrFinding: `Verify reference range standard for ${testName} (${valString} ${unitString || ''}) against patient baseline`,
        context: 'Original report omitted reference interval. Must not be assumed normal.',
      });
    }
  }

  // Scan raw text for unreadable sections or warnings not captured in structured findings
  if (
    containsUnreadableMarker &&
    !missingOrUncertainInfo.some((m) => m.reason.includes('smudge') || m.reason.includes('unreadable'))
  ) {
    missingOrUncertainInfo.push({
      item: 'Source Document Legibility',
      reason: 'Certain text regions in the diagnostic report appear smudged, truncated, or unreadable.',
    });
    needsClinicianReview.push({
      questionOrFinding: 'Re-inspect original document for unreadable passages',
      context: 'Document integrity indicator flagged possible illegibility in source text.',
    });
  }

  // If report has text but zero structured findings were produced
  if (keyFindings.length === 0 && rawTextTrimmed.length > 0) {
    missingOrUncertainInfo.push({
      item: 'Report Parameters',
      reason: 'No structured clinical parameters were extracted from the supplied narrative text.',
    });
    needsClinicianReview.push({
      questionOrFinding: 'Directly inspect narrative report text',
      context: 'Report is provided as unstructured narrative and requires direct clinician review.',
    });
  }

  return {
    reportId: report.id || 'unknown',
    patientId: report.patientId || 'unknown',
    reportOverview: {
      title: report.title || 'Diagnostic Report',
      reportType: report.reportType || 'other',
      date: report.date || 'Date not recorded',
      facility: report.facilityOrLab || (report as any).facility,
      orderingDoctor: report.orderingDoctor,
      sourceIntegrity,
    },
    keyFindings,
    abnormalValues,
    missingOrUncertainInfo,
    needsClinicianReview,
    disclaimer: REPORT_SUMMARY_DISCLAIMER,
    engineMode: 'rule_based_mvp',
    generatedAt,
  };
}
