/**
 * Automated Verification Suite for PulseBridge AI Medical Report Summarization MVP
 * 
 * Verifies:
 * 1. Ordinary findings explicitly present in the report.
 * 2. Value outside reference range correctly flagged or labeled.
 * 3. Value with no reference range provided — flagged for manual review / unspecified reference range, not assumed normal/abnormal.
 * 4. Completely empty report handling without throwing.
 * 5. Incomplete, unreadable, or ambiguous content ("[unreadable smudge]", "[missing baseline]").
 * 6. Exact value and unit preservation ("48 ng/L", "8.4 %" — no numeric corruption or conversion).
 * 7. No fabricated findings: every finding traces directly to input source findings.
 * 8. Resilience / fallback on null, undefined, or malformed inputs.
 * 9. Immutability: input report is unmutated; care plans, prescriptions, and triage scores are unchanged.
 */

import { summarizeMedicalReport, REPORT_SUMMARY_DISCLAIMER } from '../src/services/reportSummarizer';
import { demoMedicalReports, demoCareGaps, demoPrescriptionDrafts, demoPatients, demoHealthUpdates, demoSchedules, demoFollowUps } from '../src/data/demoData';
import { calculatePatientTriageScore } from '../src/services/careGapRules';
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
console.log('PULSEBRIDGE AI — MEDICAL REPORT SUMMARIZATION MVP TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Ordinary findings explicitly present in the report
// -----------------------------------------------------------------------------
console.log('TEST 1: Ordinary findings explicitly present in the report');
{
  const normalReport: MedicalReport = {
    id: 'rep-normal-1',
    patientId: 'p1',
    reportType: 'lab',
    title: 'Electrolyte Panel',
    date: '2026-10-15',
    orderingDoctor: 'Dr. Anita Desai',
    facilityOrLab: 'Apex Diagnostics',
    rawText: 'Serum Sodium: 138 mmol/L\nSerum Potassium: 4.2 mmol/L',
    structuredFindings: [
      {
        testOrParameter: 'Serum Sodium',
        value: '138',
        unit: 'mmol/L',
        referenceRange: '135 - 145',
        isAbnormal: false,
      },
      {
        testOrParameter: 'Serum Potassium',
        value: '4.2',
        unit: 'mmol/L',
        referenceRange: '3.5 - 5.0',
        isAbnormal: false,
      },
    ],
  };

  const summary = summarizeMedicalReport(normalReport);
  assert(summary !== null, 'Summary is successfully generated');
  assert(summary.engineMode === 'rule_based_mvp', 'Engine mode is explicitly rule_based_mvp');
  assert(summary.keyFindings.length === 2, 'Key findings include all 2 normal findings');
  assert(summary.abnormalValues.length === 0, 'No abnormal findings reported for normal panel');
  assert(summary.disclaimer.toLowerCase().includes('clinical judgment'), 'Clinical safety disclaimer is present');
}

// -----------------------------------------------------------------------------
// Test 2: Value outside reference range correctly flagged or labeled
// -----------------------------------------------------------------------------
console.log('\nTEST 2: Value outside reference range correctly flagged or labeled');
{
  const p1Reports = demoMedicalReports['p1'];
  assert(Array.isArray(p1Reports) && p1Reports.length > 0, 'Demo report for p1 exists');

  if (p1Reports && p1Reports[0]) {
    const summary = summarizeMedicalReport(p1Reports[0]);
    const troponinAbnormal = summary.abnormalValues.find((f) => f.name.toLowerCase().includes('troponin'));
    assert(troponinAbnormal !== undefined, 'High sensitivity Troponin I flagged as abnormal');
    assert(troponinAbnormal?.value === '48', 'Troponin value exact match ("48")');
    assert(troponinAbnormal?.unit === 'ng/L', 'Troponin unit exact match ("ng/L")');
    assert(troponinAbnormal?.referenceRange.includes('< 14'), 'Troponin reference range includes "< 14"');
    
    // Check that needsClinicianReview captures abnormal values
    const troponinReview = summary.needsClinicianReview.some((r) =>
      r.questionOrFinding.toLowerCase().includes('troponin') || r.context.toLowerCase().includes('troponin')
    );
    assert(troponinReview, 'Troponin elevation flagged for clinician review');
  }
}

// -----------------------------------------------------------------------------
// Test 3: Value with no reference range provided
// -----------------------------------------------------------------------------
console.log('\nTEST 3: Value with no reference range provided (must NOT assume normal/abnormal)');
{
  const reportWithMissingRange: MedicalReport = {
    id: 'rep-missing-range',
    patientId: 'p1',
    reportType: 'lab',
    title: 'Metabolic Screen',
    date: '2026-10-15',
    orderingDoctor: 'Dr. Anita Desai',
    facilityOrLab: 'Apex Diagnostics',
    rawText: 'Random Blood Glucose: 186 mg/dL',
    structuredFindings: [
      {
        testOrParameter: 'Random Blood Glucose',
        value: '186',
        unit: 'mg/dL',
        // referenceRange omitted / undefined
      },
    ],
  };

  const summary = summarizeMedicalReport(reportWithMissingRange);
  assert(summary.abnormalValues.length === 0, 'Value with missing range is NOT marked abnormal');
  
  const unspecifiedKeyFinding = summary.keyFindings.find((kf) => kf.name === 'Random Blood Glucose');
  assert(unspecifiedKeyFinding?.flag === 'unspecified_range', 'Key finding flag is unspecified_range');

  const unspecifiedItem = summary.missingOrUncertainInfo.find((item) =>
    item.item.toLowerCase().includes('random blood glucose') && item.reason.toLowerCase().includes('reference range')
  );
  assert(unspecifiedItem !== undefined, 'Missing reference range reported in missingOrUncertainInfo');

  const clinicianReviewItem = summary.needsClinicianReview.find((item) =>
    item.questionOrFinding.toLowerCase().includes('random blood glucose')
  );
  assert(clinicianReviewItem !== undefined, 'Missing range prompts clinician review for interpretation');
}

// -----------------------------------------------------------------------------
// Test 4: Completely empty report
// -----------------------------------------------------------------------------
console.log('\nTEST 4: Completely empty report handling');
{
  const emptyReport: MedicalReport = {
    id: 'rep-empty',
    patientId: 'p-empty',
    reportType: 'other',
    title: 'Empty Specimen Report',
    date: '2026-10-15',
    rawText: '',
    structuredFindings: [],
  };

  const summary = summarizeMedicalReport(emptyReport);
  assert(summary !== null, 'Empty report does not throw error');
  assert(summary.keyFindings.length === 0, 'Empty report has 0 key findings');
  assert(summary.abnormalValues.length === 0, 'Empty report has 0 abnormal values');
  assert(summary.missingOrUncertainInfo.some((m) => m.reason.toLowerCase().includes('empty')), 'Missing info notes empty content');
  assert(summary.needsClinicianReview.some((n) => n.context.toLowerCase().includes('manual clinical verification')), 'Clinician review notes manual review required');
  assert(summary.disclaimer.length > 0, 'Disclaimer retained even on empty report');
}

// -----------------------------------------------------------------------------
// Test 5: Incomplete, unreadable, or ambiguous content
// -----------------------------------------------------------------------------
console.log('\nTEST 5: Incomplete, unreadable, or ambiguous content');
{
  const ambiguousReport: MedicalReport = {
    id: 'rep-smudge',
    patientId: 'p1',
    reportType: 'lab',
    title: 'Renal Function Test',
    date: '2026-10-15',
    orderingDoctor: 'Dr. Anita Desai',
    facilityOrLab: 'Apex Diagnostics',
    rawText: 'Serum Creatinine: [unreadable smudge] mg/dL',
    structuredFindings: [
      {
        testOrParameter: 'Serum Creatinine',
        value: '[unreadable smudge]',
        unit: 'mg/dL',
        referenceRange: '0.7 - 1.2',
        clinicalNotes: 'Print illegible on carbon copy',
      },
    ],
  };

  const summary = summarizeMedicalReport(ambiguousReport);
  assert(summary.reportOverview.sourceIntegrity === 'unreadable', 'Source integrity detected as unreadable');

  const unreadableMissing = summary.missingOrUncertainInfo.find((m) =>
    m.item.toLowerCase().includes('serum creatinine') && m.reason.toLowerCase().includes('unreadable')
  );
  assert(unreadableMissing !== undefined, 'Unreadable value captured in missingOrUncertainInfo');

  const unreadableReview = summary.needsClinicianReview.find((r) =>
    r.questionOrFinding.toLowerCase().includes('serum creatinine')
  );
  assert(unreadableReview !== undefined, 'Clinician review requests re-test or source document verification');
}

// -----------------------------------------------------------------------------
// Test 6: Exact value and unit preservation
// -----------------------------------------------------------------------------
console.log('\nTEST 6: Exact value and unit preservation (no float rounding or conversion)');
{
  const preciseFindings: MedicalReportFinding[] = [
    { testOrParameter: 'HbA1c', value: '8.4', unit: '%', referenceRange: '4.0 - 5.6', isAbnormal: true },
    { testOrParameter: 'Troponin I', value: '48', unit: 'ng/L', referenceRange: '< 14', isAbnormal: true },
    { testOrParameter: 'Serum Creatinine', value: '1.1', unit: 'mg/dL', referenceRange: '0.7 - 1.3', isAbnormal: false },
    { testOrParameter: 'Urine Microalbumin', value: '< 30', unit: 'mg/g', referenceRange: '< 30', isAbnormal: false },
  ];

  const report: MedicalReport = {
    id: 'rep-precise',
    patientId: 'p4',
    reportType: 'lab',
    title: 'Precise Panel',
    date: '2026-10-15',
    rawText: 'Precise Diagnostic Panel',
    structuredFindings: preciseFindings,
  };

  const summary = summarizeMedicalReport(report);
  for (const pf of preciseFindings) {
    const matched = summary.keyFindings.find((kf) => kf.name === pf.testOrParameter);
    assert(matched?.value === pf.value, `Exact value preserved for ${pf.testOrParameter}: expected "${pf.value}", got "${matched?.value}"`);
    assert(matched?.unit === pf.unit, `Exact unit preserved for ${pf.testOrParameter}: expected "${pf.unit}", got "${matched?.unit}"`);
  }
}

// -----------------------------------------------------------------------------
// Test 7: No fabricated findings
// -----------------------------------------------------------------------------
console.log('\nTEST 7: No fabricated findings');
{
  const p4Reports = demoMedicalReports['p4'];
  assert(Array.isArray(p4Reports) && p4Reports.length > 0, 'Demo report for p4 exists');

  if (p4Reports && p4Reports[0]) {
    const p4Report = p4Reports[0];
    const summary = summarizeMedicalReport(p4Report);
    const validTestNames = new Set((p4Report.structuredFindings || []).map((f) => f.testOrParameter.toLowerCase()));

    const allKeyFindingsValid = summary.keyFindings.every((kf) => validTestNames.has(kf.name.toLowerCase()));
    assert(allKeyFindingsValid, 'Every key finding strictly maps to an input finding');

    const allAbnormalValid = summary.abnormalValues.every((af) => validTestNames.has(af.name.toLowerCase()));
    assert(allAbnormalValid, 'Every abnormal finding strictly maps to an input finding');
  }
}

// -----------------------------------------------------------------------------
// Test 8: Resilience / fallback on null, undefined, or malformed inputs
// -----------------------------------------------------------------------------
console.log('\nTEST 8: Resilience / fallback on null, undefined, or malformed inputs');
{
  // Test null
  let nullSummary: any = null;
  try {
    nullSummary = summarizeMedicalReport(null as any);
  } catch (err) {
    nullSummary = err;
  }
  assert(nullSummary !== null && !(nullSummary instanceof Error), 'Null input handled safely without throwing');
  assert(nullSummary?.patientId === 'unknown', 'Null input returns safe fallback patientId');

  // Test undefined
  let undefinedSummary: any = null;
  try {
    undefinedSummary = summarizeMedicalReport(undefined as any);
  } catch (err) {
    undefinedSummary = err;
  }
  assert(undefinedSummary !== null && !(undefinedSummary instanceof Error), 'Undefined input handled safely without throwing');

  // Test malformed object
  let malformedSummary: any = null;
  try {
    malformedSummary = summarizeMedicalReport({ invalidField: 123 } as any);
  } catch (err) {
    malformedSummary = err;
  }
  assert(malformedSummary !== null && !(malformedSummary instanceof Error), 'Malformed input handled safely without throwing');
}

// -----------------------------------------------------------------------------
// Test 9: Immutability (no mutation of report, care plan, prescription, or triage score)
// -----------------------------------------------------------------------------
console.log('\nTEST 9: Immutability and isolation from care plans, prescriptions, and triage');
{
  const p1 = demoPatients[0];
  const p1Updates = demoHealthUpdates['p1'] ?? [];
  const p1Schedules = demoSchedules['p1'] ?? [];
  const p1FollowUps = demoFollowUps['p1'] ?? [];
  const p1GapsBefore = JSON.stringify(demoCareGaps['p1']);
  const p1DraftBefore = JSON.stringify(demoPrescriptionDrafts['p1']);

  // Calculate triage score before
  const triageBefore = calculatePatientTriageScore(p1, p1Updates, p1Schedules, p1FollowUps);

  // Deep-freeze copy of medical report
  const testReport: MedicalReport = JSON.parse(JSON.stringify(demoMedicalReports['p1'][0]));
  const reportBeforeString = JSON.stringify(testReport);

  // Execute summarizer
  const summary = summarizeMedicalReport(testReport);
  assert(summary !== null, 'Summary executed');

  // Verify report was not mutated
  const reportAfterString = JSON.stringify(testReport);
  assert(reportBeforeString === reportAfterString, 'Input MedicalReport is deeply immutable and unmutated');

  // Verify triage score after is identical
  const triageAfter = calculatePatientTriageScore(p1, p1Updates, p1Schedules, p1FollowUps);
  assert(triageBefore.score === triageAfter.score, 'Patient triage score is completely unaffected');
  assert(triageBefore.priority === triageAfter.priority, 'Patient priority tier is completely unaffected');

  // Verify demoCareGaps and demoPrescriptionDrafts unmutated
  assert(JSON.stringify(demoCareGaps['p1']) === p1GapsBefore, 'Care gaps state is untouched');
  assert(JSON.stringify(demoPrescriptionDrafts['p1']) === p1DraftBefore, 'Prescription draft state is untouched');
}

console.log('\n----------------------------------------------------------------');
console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed.`);
console.log('----------------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
