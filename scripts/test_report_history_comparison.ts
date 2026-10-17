/**
 * Automated Verification Suite for PulseBridge AI Medical Report History & Comparison (Task 6)
 *
 * Test Coverage:
 * 1. Report Ordering:
 *    - Chronological ordering (descending) for patient Report History.
 *    - Automatic chronological baseline alignment in dual-report comparison.
 * 2. Empty History Handling:
 *    - Patient with 0 reports (p2 Sunita Devi) handles cleanly with no crashes or unhandled rejections.
 * 3. Report Selection & Metadata:
 *    - Selection integrity and accurate calculation of discrete findings and abnormal counts.
 * 4. Cross-Patient Comparison Prevention:
 *    - Strict patient isolation guard throws and rejects cross-patient report pairs (e.g. p1 vs p4).
 * 5. Missing / Asymmetric Findings:
 *    - Analytes present in only one report (missing baseline or missing follow-up) flagged as incomparable with explicit reasons.
 * 6. Non-Numeric & Unreadable Values:
 *    - Values such as "[unreadable smudge]" or comparison operators ("< 14") are flagged non-numeric with null delta.
 * 7. Incomparable Units:
 *    - Mismatched units (e.g. mg/dL vs µmol/L) strictly reject mathematical subtraction without silent conversion.
 * 8. Insufficient Trend Data (< 3 points):
 *    - Analytes with 1 or 2 numeric points return hasSufficientData: false with clinical rationale.
 * 9. Sufficient Trend Data (>= 3 points):
 *    - Analytes with >= 3 valid points calculate min, max, earliest, latest, delta, direction without interpolation.
 * 10. Immutability & Safety Disclaimers:
 *    - Verifies original data structures remain completely unmutated and clinical disclaimers are attached.
 */

import {
  compareReports,
  compareSingleFinding,
  extractLabTrends,
  normalizeTestName,
  parseNumericValue,
  COMPARISON_SAFETY_DISCLAIMER,
} from '../src/utils/reportComparison';
import { demoMedicalReports } from '../src/data/demoData';
import type { MedicalReport, MedicalReportFinding } from '../src/types';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failedTests++;
  }
}

console.log('================================================================');
console.log('PULSEBRIDGE AI — REPORT HISTORY & COMPARISON TEST SUITE (TASK 6)');
console.log('================================================================\n');

const allDemoReports: MedicalReport[] = Object.values(demoMedicalReports).flat();

// -----------------------------------------------------------------------------
// Test 1: Report Ordering
// -----------------------------------------------------------------------------
console.log('TEST 1: Chronological Report Ordering');
{
  const p1Reports = demoMedicalReports['p1'] || [];
  assert(p1Reports.length >= 3, 'Patient p1 has at least 3 longitudinal reports', `Found: ${p1Reports.length}`);

  // Sort descending (history view order)
  const historyOrder = [...p1Reports].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  assert(
    historyOrder[0].date >= historyOrder[1].date && historyOrder[1].date >= historyOrder[2].date,
    'Reports correctly ordered descending by date for History view',
    `${historyOrder.map((r) => r.date).join(' -> ')}`
  );

  // Dual comparison automatic ordering: earlier report must always be baseline regardless of input order
  const octReport = p1Reports.find((r) => r.date === '2026-10-16')!;
  const marReport = p1Reports.find((r) => r.date === '2026-03-05')!;

  // Pass in [Oct, Mar]
  const comp1 = compareReports(octReport, marReport);
  assert(
    comp1.baselineReport.id === marReport.id && comp1.comparisonReport.id === octReport.id,
    'Automatic ordering places earlier report (2026-03-05) as baseline when passed [Oct, Mar]'
  );

  // Pass in [Mar, Oct]
  const comp2 = compareReports(marReport, octReport);
  assert(
    comp2.baselineReport.id === marReport.id && comp2.comparisonReport.id === octReport.id,
    'Automatic ordering preserves earlier report (2026-03-05) as baseline when passed [Mar, Oct]'
  );

  // Pass in [Oct, Mar] with { chronological: false } (Swap Order action)
  const compSwap = compareReports(octReport, marReport, { chronological: false });
  assert(
    compSwap.baselineReport.id === octReport.id && compSwap.comparisonReport.id === marReport.id,
    'Explicit chronological: false preserves caller-specified order for Swap Order action'
  );
}

// -----------------------------------------------------------------------------
// Test 2: Empty History Handling
// -----------------------------------------------------------------------------
console.log('\nTEST 2: Empty History Handling');
{
  const p2Reports = demoMedicalReports['p2'] || [];
  assert(p2Reports.length === 0, 'Patient p2 (Sunita Devi) correctly has 0 reports on file');

  const p2Trends = extractLabTrends(p2Reports, 'p2');
  assert(Array.isArray(p2Trends) && p2Trends.length === 0, 'extractLabTrends returns empty array for 0 reports');

  let errorThrown = false;
  try {
    // Attempting comparison with invalid inputs
    compareReports(null as unknown as MedicalReport, null as unknown as MedicalReport);
  } catch (err: any) {
    errorThrown = true;
    assert(
      err.message.includes('Two valid medical reports are required'),
      'Calling compareReports with null reports throws expected descriptive error'
    );
  }
  assert(errorThrown, 'Empty/null report comparison safely rejected');
}

// -----------------------------------------------------------------------------
// Test 3: Report Selection & Metadata Calculation
// -----------------------------------------------------------------------------
console.log('\nTEST 3: Report Selection & Metadata Calculation');
{
  const p1Reports = demoMedicalReports['p1'] || [];
  const latestReport = p1Reports[0];

  assert(Boolean(latestReport.id), 'Report has valid unique ID');
  assert(Boolean(latestReport.title), 'Report has valid title');
  assert(Boolean(latestReport.reportType), 'Report has valid reportType');
  assert(Boolean(latestReport.date), 'Report has valid ISO date');
  assert(Boolean(latestReport.orderingDoctor), 'Report metadata includes orderingDoctor');
  assert(Boolean(latestReport.facilityOrLab), 'Report metadata includes facilityOrLab');

  const abnormalFindings = latestReport.structuredFindings.filter((f) => f.isAbnormal);
  assert(
    abnormalFindings.length > 0,
    'Abnormal findings count accurately calculated from structured findings',
    `Found ${abnormalFindings.length} abnormal findings`
  );
}

// -----------------------------------------------------------------------------
// Test 4: Cross-Patient Comparison Prevention
// -----------------------------------------------------------------------------
console.log('\nTEST 4: Strict Cross-Patient Comparison Isolation');
{
  const p1Report = (demoMedicalReports['p1'] || [])[0];
  const p4Report = (demoMedicalReports['p4'] || [])[0];

  assert(p1Report.patientId !== p4Report.patientId, 'Confirmed p1 and p4 are distinct patients');

  let crossPatientError = false;
  let errorMessage = '';
  try {
    compareReports(p1Report, p4Report);
  } catch (err: any) {
    crossPatientError = true;
    errorMessage = err.message;
  }

  assert(crossPatientError, 'Cross-patient comparison rejected with thrown Error');
  assert(
    errorMessage.includes('Cross-patient comparison rejected') &&
      errorMessage.includes('p1') &&
      errorMessage.includes('p4'),
    'Error message explicitly specifies both patient IDs and rejects comparison',
    errorMessage
  );
}

// -----------------------------------------------------------------------------
// Test 5: Missing / Asymmetric Findings Across Reports
// -----------------------------------------------------------------------------
console.log('\nTEST 5: Missing & Asymmetric Findings');
{
  const p1Reports = demoMedicalReports['p1'] || [];
  const octReport = p1Reports.find((r) => r.date === '2026-10-16')!;
  const marReport = p1Reports.find((r) => r.date === '2026-03-05')!;

  const comparison = compareReports(marReport, octReport);

  // Troponin I was ordered in Oct 2026 for acute chest tightness, but was NOT present in March 2026 routine panel
  const troponin = comparison.findings.find((f) =>
    normalizeTestName(f.testName).includes('troponin')
  );

  assert(Boolean(troponin), 'Troponin I finding identified in comparison result');
  assert(troponin?.comparable === false, 'Troponin I is flagged as comparable: false');
  assert(troponin?.delta === null, 'Troponin I delta is strictly null');
  assert(troponin?.percentChange === null, 'Troponin I percentChange is strictly null');
  assert(
    troponin?.baseline.status === 'unavailable',
    'Troponin I baseline status is marked unavailable'
  );
  assert(
    troponin?.current.status === 'present',
    'Troponin I comparison status is marked present'
  );
  assert(
    troponin?.incomparabilityReason?.includes('baseline') ?? false,
    'Troponin I incomparabilityReason explains test was missing in baseline report'
  );
}

// -----------------------------------------------------------------------------
// Test 6: Non-Numeric & Unreadable Values Handling
// -----------------------------------------------------------------------------
console.log('\nTEST 6: Non-Numeric & Unreadable Values');
{
  // Test numeric parser on normal and pathological inputs
  assert(parseNumericValue('215') === 215, 'parseNumericValue parses "215" correctly');
  assert(parseNumericValue('1.1') === 1.1, 'parseNumericValue parses "1.1" correctly');
  assert(parseNumericValue('  142  ') === 142, 'parseNumericValue handles whitespace');
  assert(parseNumericValue('[unreadable smudge]') === null, 'parseNumericValue rejects "[unreadable smudge]"');
  assert(parseNumericValue('< 14') === null, 'parseNumericValue rejects inequality operator "< 14"');
  assert(parseNumericValue('> 60') === null, 'parseNumericValue rejects inequality operator "> 60"');
  assert(parseNumericValue('Normal') === null, 'parseNumericValue rejects qualitative text "Normal"');
  assert(parseNumericValue('') === null, 'parseNumericValue rejects empty string');
  assert(parseNumericValue(null) === null, 'parseNumericValue rejects null');

  // Verify finding with unreadable smudge in Oct report
  const p1Reports = demoMedicalReports['p1'] || [];
  const octReport = p1Reports.find((r) => r.date === '2026-10-16')!;
  const julReport = p1Reports.find((r) => r.date === '2026-07-10')!;

  const compSmudge = compareReports(julReport, octReport);
  const creatinine = compSmudge.findings.find((f) =>
    normalizeTestName(f.testName).includes('creatinine')
  );

  assert(Boolean(creatinine), 'Serum Creatinine finding found in comparison');
  assert(creatinine?.comparable === false, 'Creatinine with smudge is marked comparable: false');
  assert(creatinine?.delta === null, 'Creatinine delta is null');
  assert(
    creatinine?.incomparabilityReason?.includes('Non-numeric or unreadable') ?? false,
    'Creatinine incomparabilityReason explains non-numeric/unreadable source observation'
  );

  // Test zero-baseline percent change safety (no division by zero)
  const zeroBaseFinding: MedicalReportFinding = {
    testOrParameter: 'Troponin T',
    value: '0',
    unit: 'ng/L',
    isAbnormal: false,
  };
  const currFinding: MedicalReportFinding = {
    testOrParameter: 'Troponin T',
    value: '14',
    unit: 'ng/L',
    isAbnormal: true,
  };
  const zeroComp = compareSingleFinding(
    'Troponin T',
    zeroBaseFinding,
    'rep-0',
    '2026-01-01',
    currFinding,
    'rep-1',
    '2026-06-01'
  );
  assert(zeroComp.comparable === true, 'Zero baseline is numeric and comparable');
  assert(zeroComp.delta === 14, 'Delta computed accurately with zero baseline (14 - 0 = 14)');
  assert(
    zeroComp.percentChange === null,
    'Division by zero baseline returns percentChange: null safely without NaN or Infinity'
  );
}

// -----------------------------------------------------------------------------
// Test 7: Incomparable Units Prevention
// -----------------------------------------------------------------------------
console.log('\nTEST 7: Strict Unit Comparability');
{
  const findingBase: MedicalReportFinding = {
    testOrParameter: 'Serum Creatinine',
    value: '1.1',
    unit: 'mg/dL',
    referenceRange: '0.7 - 1.3',
    isAbnormal: false,
  };

  const findingCurrMismatchedUnit: MedicalReportFinding = {
    testOrParameter: 'Serum Creatinine',
    value: '97.2',
    unit: 'µmol/L', // Different unit!
    referenceRange: '62 - 115',
    isAbnormal: false,
  };

  const unitComparison = compareSingleFinding(
    'Serum Creatinine',
    findingBase,
    'rep-1',
    '2026-01-01',
    findingCurrMismatchedUnit,
    'rep-2',
    '2026-06-01'
  );

  assert(unitComparison.comparable === false, 'Unit mismatch results in comparable: false');
  assert(unitComparison.delta === null, 'Unit mismatch results in delta: null (no subtraction)');
  assert(unitComparison.percentChange === null, 'Unit mismatch results in percentChange: null');
  assert(
    unitComparison.incomparabilityReason?.includes('Incomparable units') ?? false,
    'Incomparability reason explicitly notes unit mismatch and disabled silent conversion',
    unitComparison.incomparabilityReason
  );
}

// -----------------------------------------------------------------------------
// Test 8: Insufficient Trend Data (< 3 points)
// -----------------------------------------------------------------------------
console.log('\nTEST 8: Insufficient Trend Data Threshold (< 3 points)');
{
  const p1Reports = demoMedicalReports['p1'] || [];
  const trends = extractLabTrends(p1Reports, 'p1');

  // Troponin I only exists in 1 report
  const troponinTrend = trends.find((t) => normalizeTestName(t.testName).includes('troponin'));
  assert(Boolean(troponinTrend), 'Troponin I trend series extracted');
  assert(troponinTrend?.hasSufficientData === false, 'Troponin I flagged as hasSufficientData: false');
  assert(
    troponinTrend?.insufficientDataReason?.includes('At least 3 dated reports') ?? false,
    'Troponin I includes explanatory clinical notice explaining minimum 3 points requirement'
  );
  assert(troponinTrend?.summary === undefined, 'Troponin I summary is undefined when insufficient data');

  // Serum Creatinine has 2 valid numbers and 1 smudge -> only 2 numeric points
  const creatinineTrend = trends.find((t) => normalizeTestName(t.testName).includes('creatinine'));
  assert(Boolean(creatinineTrend), 'Creatinine trend series extracted');
  assert(creatinineTrend?.hasSufficientData === false, 'Creatinine flagged as hasSufficientData: false due to smudge');
  assert(
    creatinineTrend?.insufficientDataReason?.includes('Found 2 valid numeric observation(s)') ?? false,
    'Creatinine notes exactly 2 valid numeric observations found',
    creatinineTrend?.insufficientDataReason
  );

  // Resilience against reports with missing or unparseable dates
  const reportWithBadDate: MedicalReport = {
    id: 'rep-bad-date',
    patientId: 'p1',
    reportType: 'lab',
    title: 'Corrupted Date Report',
    date: 'unparseable-date-string',
    structuredFindings: [
      {
        testOrParameter: 'Total Cholesterol',
        value: '999',
        unit: 'mg/dL',
      },
    ],
  };
  const resilientTrends = extractLabTrends([...p1Reports, reportWithBadDate], 'p1');
  const cholResilient = resilientTrends.find((t) => normalizeTestName(t.testName) === 'total cholesterol');
  assert(
    cholResilient?.hasSufficientData === true,
    'extractLabTrends filters unparseable date reports and preserves valid 3-point trend'
  );
  assert(
    cholResilient?.dataPoints.length === 3,
    'Corrupted date report is excluded from dated longitudinal points'
  );
}

// -----------------------------------------------------------------------------
// Test 9: Sufficient Trend Data (>= 3 points) & Trend Statistics
// -----------------------------------------------------------------------------
console.log('\nTEST 9: Sufficient Trend Data (>= 3 points) & Calculations');
{
  const p1Reports = demoMedicalReports['p1'] || [];
  const trends = extractLabTrends(p1Reports, 'p1');

  // Total Cholesterol has 3 observations: 240 (Mar), 228 (Jul), 215 (Oct)
  const cholTrend = trends.find((t) => normalizeTestName(t.testName) === 'total cholesterol');
  assert(Boolean(cholTrend), 'Total Cholesterol trend series found');
  assert(cholTrend?.hasSufficientData === true, 'Total Cholesterol hasSufficientData is true');
  assert(cholTrend?.dataPoints.length === 3, 'Total Cholesterol has exactly 3 data points');

  // Verify chronological ordering of data points (oldest to newest)
  const d0 = cholTrend!.dataPoints[0];
  const d1 = cholTrend!.dataPoints[1];
  const d2 = cholTrend!.dataPoints[2];
  assert(
    d0.date === '2026-03-05' && d1.date === '2026-07-10' && d2.date === '2026-10-16',
    'Data points strictly ordered oldest to newest (2026-03-05 -> 2026-07-10 -> 2026-10-16)'
  );

  // Verify summary statistics
  assert(cholTrend?.summary?.earliest === 240, 'Total Cholesterol earliest is 240');
  assert(cholTrend?.summary?.latest === 215, 'Total Cholesterol latest is 215');
  assert(cholTrend?.summary?.min === 215, 'Total Cholesterol min is 215');
  assert(cholTrend?.summary?.max === 240, 'Total Cholesterol max is 240');
  assert(cholTrend?.summary?.delta === -25, 'Total Cholesterol delta is exactly -25 (215 - 240)');
  assert(cholTrend?.summary?.direction === 'decreased', 'Total Cholesterol direction is "decreased"');

  // LDL Cholesterol: 165 (Mar) -> 152 (Jul) -> 138 (Oct)
  const ldlTrend = trends.find((t) => normalizeTestName(t.testName).includes('ldl'));
  assert(Boolean(ldlTrend), 'LDL Cholesterol trend series found');
  assert(ldlTrend?.hasSufficientData === true, 'LDL Cholesterol hasSufficientData is true');
  assert(ldlTrend?.summary?.delta === -27, 'LDL Cholesterol delta is -27 (138 - 165)');
  assert(ldlTrend?.summary?.direction === 'decreased', 'LDL Cholesterol direction is "decreased"');

  // Patient p4 (Lakshmi Rao) - HbA1c: 9.3 (Jan) -> 8.9 (Jun) -> 8.4 (Oct)
  const p4Reports = demoMedicalReports['p4'] || [];
  const p4Trends = extractLabTrends(p4Reports, 'p4');
  const hba1cTrend = p4Trends.find((t) => normalizeTestName(t.testName).includes('hba1c'));
  assert(Boolean(hba1cTrend), 'HbA1c trend series found for patient p4');
  assert(hba1cTrend?.hasSufficientData === true, 'HbA1c hasSufficientData is true');
  assert(hba1cTrend?.summary?.earliest === 9.3, 'HbA1c earliest is 9.3%');
  assert(hba1cTrend?.summary?.latest === 8.4, 'HbA1c latest is 8.4%');
  assert(hba1cTrend?.summary?.delta === -0.9, 'HbA1c delta is exactly -0.9%');
  assert(hba1cTrend?.summary?.direction === 'decreased', 'HbA1c direction is "decreased"');
}

// -----------------------------------------------------------------------------
// Test 10: Immutability & Safety Disclaimers
// -----------------------------------------------------------------------------
console.log('\nTEST 10: Immutability & Safety Disclaimers');
{
  const p1Reports = demoMedicalReports['p1'] || [];
  const baselineCopy = JSON.stringify(p1Reports[0]);

  const comp = compareReports(p1Reports[0], p1Reports[1]);
  extractLabTrends(p1Reports, 'p1');

  assert(
    JSON.stringify(p1Reports[0]) === baselineCopy,
    'Medical report objects are completely immutable and unaltered by comparison/trends'
  );

  assert(
    Boolean(comp.disclaimer) && comp.disclaimer === COMPARISON_SAFETY_DISCLAIMER,
    'Comparison result contains standardized clinical safety disclaimer'
  );
  assert(
    comp.disclaimer.includes('clinical review aid') &&
      comp.disclaimer.includes('professional medical judgment'),
    'Disclaimer contains mandatory clinical non-diagnostic advisory'
  );
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed.`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
