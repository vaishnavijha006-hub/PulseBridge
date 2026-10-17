/**
 * PulseBridge AI — Medical Report Comparison & Lab Trend Engine
 * 
 * Safety & Clinical Grounding Rules:
 * 1. Strict Patient Isolation: Compares only reports belonging to the exact same authorized patient.
 * 2. Strict Unit Comparability: Only computes mathematical differences when units match identically.
 *    Does NOT perform silent unit conversions.
 * 3. Exact Value Preservation: Preserves literal values from source documents. Non-numeric or missing
 *    values are marked "unavailable" without imputation or fabrication.
 * 4. Descriptive Only: Numeric differences are strictly descriptive and do NOT infer diagnoses,
 *    treatment plans, or clinical recommendations.
 * 5. Minimum 3 Points for Trends: Trend analysis requires at least 3 dated observations; does NOT interpolate.
 */

import type {
  MedicalReport,
  MedicalReportFinding,
  ReportComparisonResult,
  ComparedFinding,
  LabTrendSeries,
  LabTrendDataPoint,
} from '@/types';

/**
 * Standard clinical safety disclaimer attached to all comparison and trend outputs.
 */
export const COMPARISON_SAFETY_DISCLAIMER =
  'This automated comparison and trend analysis is a clinical review aid displaying mathematical deltas between laboratory source documents. It does NOT evaluate clinical response, establish diagnoses, or substitute for professional medical judgment. Clinicians must independently evaluate original diagnostic reports.';

/**
 * Normalizes test parameter names for reliable matching while keeping distinct analytes strictly separated.
 */
export function normalizeTestName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Attempts to parse a clean numeric scalar from a finding value string.
 * Returns null if the value is unreadable, qualitative, or prefixed with comparison operators.
 */
export function parseNumericValue(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Reject unreadable smudge or qualitative notes
  if (trimmed.startsWith('[') || trimmed.includes('smudge') || trimmed.includes('damaged')) {
    return null;
  }
  // If value contains inequality operators (e.g. "< 14" or "> 60"), it is not a direct scalar
  if (/^[<>]=?/.test(trimmed)) {
    return null;
  }
  // Try clean numeric parse
  const cleanStr = trimmed.replace(/,/g, '');
  const num = Number(cleanStr);
  return Number.isFinite(num) ? num : null;
}

/**
 * Compares two findings from two different dated reports.
 */
export function compareSingleFinding(
  testName: string,
  baselineFinding: MedicalReportFinding | null,
  baselineReportId: string,
  baselineDate: string,
  currentFinding: MedicalReportFinding | null,
  currentReportId: string,
  currentDate: string
): ComparedFinding {
  const baseVal = baselineFinding?.value ?? 'Unavailable';
  const currVal = currentFinding?.value ?? 'Unavailable';
  const baseNum = baselineFinding ? parseNumericValue(baselineFinding.value) : null;
  const currNum = currentFinding ? parseNumericValue(currentFinding.value) : null;
  const baseUnit = baselineFinding?.unit?.trim() ?? null;
  const currUnit = currentFinding?.unit?.trim() ?? null;

  const baselineState = {
    reportId: baselineReportId,
    reportDate: baselineDate,
    value: baseVal,
    numericValue: baseNum,
    unit: baseUnit,
    referenceRange: baselineFinding?.referenceRange ?? null,
    isAbnormal: baselineFinding?.isAbnormal ?? null,
    status: (baselineFinding ? 'present' : 'unavailable') as 'present' | 'unavailable',
  };

  const currentState = {
    reportId: currentReportId,
    reportDate: currentDate,
    value: currVal,
    numericValue: currNum,
    unit: currUnit,
    referenceRange: currentFinding?.referenceRange ?? null,
    isAbnormal: currentFinding?.isAbnormal ?? null,
    status: (currentFinding ? 'present' : 'unavailable') as 'present' | 'unavailable',
  };

  // Case 1: Test missing in one of the reports
  if (!baselineFinding) {
    return {
      testName,
      baseline: baselineState,
      current: currentState,
      comparable: false,
      delta: null,
      percentChange: null,
      direction: 'incomparable',
      incomparabilityReason: 'Test not present in baseline report.',
    };
  }

  if (!currentFinding) {
    return {
      testName,
      baseline: baselineState,
      current: currentState,
      comparable: false,
      delta: null,
      percentChange: null,
      direction: 'incomparable',
      incomparabilityReason: 'Test not present in comparison report.',
    };
  }

  // Case 2: Unit mismatch
  const normBaseUnit = baseUnit?.toLowerCase() ?? '';
  const normCurrUnit = currUnit?.toLowerCase() ?? '';
  if (normBaseUnit !== normCurrUnit) {
    return {
      testName,
      baseline: baselineState,
      current: currentState,
      comparable: false,
      delta: null,
      percentChange: null,
      direction: 'incomparable',
      incomparabilityReason: `Incomparable units (${baseUnit || 'None'} vs ${currUnit || 'None'}); silent unit conversion is disabled.`,
    };
  }

  // Case 3: Non-numeric value in either report
  if (baseNum === null || currNum === null) {
    return {
      testName,
      baseline: baselineState,
      current: currentState,
      comparable: false,
      delta: null,
      percentChange: null,
      direction: 'incomparable',
      incomparabilityReason: 'Non-numeric or unreadable observation value in source report.',
    };
  }

  // Case 4: Fully comparable numeric results with identical units
  const delta = Number((currNum - baseNum).toFixed(3));
  const percentChange = baseNum !== 0 ? Number((((currNum - baseNum) / Math.abs(baseNum)) * 100).toFixed(1)) : null;
  const direction = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'unchanged';

  return {
    testName,
    baseline: baselineState,
    current: currentState,
    comparable: true,
    delta,
    percentChange,
    direction,
  };
}

export interface CompareReportsOptions {
  chronological?: boolean;
}

/**
 * Compares two medical reports belonging to the same authorized patient.
 * By default, automatically sorts reports chronologically so baseline is the earlier report.
 * Pass options.chronological = false to preserve caller-specified [baseline, comparison] order.
 */
export function compareReports(
  reportA: MedicalReport,
  reportB: MedicalReport,
  options?: CompareReportsOptions
): ReportComparisonResult {
  if (!reportA || !reportB) {
    throw new Error('Two valid medical reports are required for comparison.');
  }

  // Patient isolation guard
  if (reportA.patientId !== reportB.patientId) {
    throw new Error(
      `Cross-patient comparison rejected: Report ${reportA.id} (Patient: ${reportA.patientId}) cannot be compared with Report ${reportB.id} (Patient: ${reportB.patientId}).`
    );
  }

  // Order chronologically if enabled (default: true)
  const isChronological = options?.chronological !== false;
  let baseline = reportA;
  let comparison = reportB;

  if (isChronological) {
    const timeA = new Date(reportA.date).getTime();
    const timeB = new Date(reportB.date).getTime();
    const isAEarlier = !Number.isNaN(timeA) && !Number.isNaN(timeB) ? timeA <= timeB : true;
    baseline = isAEarlier ? reportA : reportB;
    comparison = isAEarlier ? reportB : reportA;
  }

  // Map findings by normalized test name
  const baseMap = new Map<string, MedicalReportFinding>();
  for (const f of baseline.structuredFindings || []) {
    baseMap.set(normalizeTestName(f.testOrParameter), f);
  }

  const compMap = new Map<string, MedicalReportFinding>();
  for (const f of comparison.structuredFindings || []) {
    compMap.set(normalizeTestName(f.testOrParameter), f);
  }

  // Union of all unique test names, preserving human display names
  const allTestsMap = new Map<string, string>();
  for (const f of baseline.structuredFindings || []) {
    allTestsMap.set(normalizeTestName(f.testOrParameter), f.testOrParameter);
  }
  for (const f of comparison.structuredFindings || []) {
    allTestsMap.set(normalizeTestName(f.testOrParameter), f.testOrParameter);
  }

  const comparedFindings: ComparedFinding[] = [];
  for (const [normKey, displayName] of allTestsMap.entries()) {
    const baseFinding = baseMap.get(normKey) ?? null;
    const compFinding = compMap.get(normKey) ?? null;

    comparedFindings.push(
      compareSingleFinding(
        displayName,
        baseFinding,
        baseline.id,
        baseline.date,
        compFinding,
        comparison.id,
        comparison.date
      )
    );
  }

  return {
    patientId: baseline.patientId,
    baselineReport: {
      id: baseline.id,
      title: baseline.title,
      date: baseline.date,
      reportType: baseline.reportType,
    },
    comparisonReport: {
      id: comparison.id,
      title: comparison.title,
      date: comparison.date,
      reportType: comparison.reportType,
    },
    findings: comparedFindings,
    disclaimer: COMPARISON_SAFETY_DISCLAIMER,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Extracts chronological lab trends across all reports for an authorized patient.
 * Groups observations by test name and unit.
 */
export function extractLabTrends(reports: MedicalReport[], patientId?: string): LabTrendSeries[] {
  if (!reports || reports.length === 0) return [];

  // Filter by patientId if specified
  const patientReports = patientId ? reports.filter((r) => r.patientId === patientId) : reports;

  // Filter out reports with missing or unparseable dates to guarantee stable chronological ordering
  const validDatedReports = patientReports.filter(
    (r) => r.date && !Number.isNaN(new Date(r.date).getTime())
  );

  // Sort reports chronologically (oldest to newest)
  const sortedReports = [...validDatedReports].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Group by "testName__unit"
  const seriesMap = new Map<string, { testName: string; unit: string; points: LabTrendDataPoint[] }>();

  for (const report of sortedReports) {
    for (const finding of report.structuredFindings || []) {
      const normName = normalizeTestName(finding.testOrParameter);
      const unit = finding.unit?.trim() || 'No Unit';
      const key = `${normName}__${unit.toLowerCase()}`;

      if (!seriesMap.has(key)) {
        seriesMap.set(key, {
          testName: finding.testOrParameter,
          unit,
          points: [],
        });
      }

      const numVal = parseNumericValue(finding.value);
      seriesMap.get(key)!.points.push({
        reportId: report.id,
        date: report.date,
        value: finding.value,
        numericValue: numVal,
        unit: finding.unit ?? null,
        referenceRange: finding.referenceRange ?? null,
        isAbnormal: finding.isAbnormal ?? null,
      });
    }
  }

  const result: LabTrendSeries[] = [];

  for (const { testName, unit, points } of seriesMap.values()) {
    // Collect valid numeric points
    const validNumericPoints = points.filter((p) => p.numericValue !== null);
    const hasSufficientData = validNumericPoints.length >= 3;

    if (!hasSufficientData) {
      result.push({
        testName,
        unit,
        dataPoints: points,
        hasSufficientData: false,
        insufficientDataReason: `Insufficient historical data: Found ${validNumericPoints.length} valid numeric observation(s). At least 3 dated reports with identical units are required for clinical trend visualization.`,
      });
      continue;
    }

    // Calculate trend summary
    const values = validNumericPoints.map((p) => p.numericValue!);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const earliest = values[0];
    const latest = values[values.length - 1];
    const delta = Number((latest - earliest).toFixed(3));
    const direction = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'unchanged';

    result.push({
      testName,
      unit,
      dataPoints: points,
      hasSufficientData: true,
      summary: {
        min,
        max,
        earliest,
        latest,
        delta,
        direction,
      },
    });
  }

  return result;
}
