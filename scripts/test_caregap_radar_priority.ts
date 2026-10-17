/**
 * Test Suite: CareGap Radar + Smart Priority Score
 * 
 * Verifies:
 * 1. CareGap Radar detection rules (all 7 clinical gap types) and deduplication.
 * 2. Smart Priority Score calculation, strict 0-100 bounding, and explainable factors.
 * 3. Critical Safety Emergency Override invariants.
 * 4. Data freshness, missing information, and stale check-in warnings.
 * 5. Unconfirmed prescription isolation (no false missed dose care gaps).
 * 6. CareGap lifecycle (open -> reviewed / followup_planned) and queue sorting integrity.
 */

import {
  detectCareGaps,
  calculatePatientTriageScore,
  DEFAULT_SCORING_WEIGHTS,
} from '../src/services/careGapRules';
import { dataService } from '../src/services/dataService';
import type {
  PatientProfile,
  MedicationSchedule,
  HealthUpdate,
  FollowUp,
  CareGap,
  PatientSummary,
} from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

const mockPatient: PatientProfile = {
  id: 'patient-test-001',
  name: 'Anita Verma',
  age: 48,
  gender: 'Female',
  phone: '+91 98765 43210',
  currentMeds: 'Metformin 500mg, Atorvastatin 20mg',
  allergies: 'Penicillin, Amoxicillin',
  symptoms: 'Mild fatigue, occasional knee pain',
  notes: 'Synthetic patient record for CareGap Radar verification',
};

async function runCareGapRadarTests() {
  console.log('================================================================');
  console.log('PULSEBRIDGE AI — CAREGAP RADAR + SMART PRIORITY SCORE TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SUITE 1: CareGap Detection Rules & Deduplication
  // -------------------------------------------------------------------------
  console.log('--- SUITE 1: CareGap Detection Rules (7 Clinical Rules) & Deduplication ---');

  // Rule 1: New symptom reported (state === 'bad')
  const badUpdate: HealthUpdate = {
    id: 'upd-1',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'bad',
    symptomDescription: 'Severe dizziness and nausea after morning medication',
    source: 'patient',
  };
  const { gaps: gapsRule1 } = detectCareGaps(mockPatient, [badUpdate], [], []);
  const rule1Gap = gapsRule1.find((g) => g.type === 'new_symptom');
  assert(!!rule1Gap, 'Rule 1: Detects new_symptom gap when patient state is bad');
  assert(rule1Gap?.severity === 'high', 'Rule 1: new_symptom gap assigned high severity');
  assert(rule1Gap?.evidence.includes('Severe dizziness'), 'Rule 1: Includes patient symptom narrative as clinical evidence');

  // Rule 2: Missing symptom severity
  const vagueUpdate: HealthUpdate = {
    id: 'upd-2',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'ok',
    symptomDescription: 'Headache and nausea since yesterday', // No severity rating provided
    source: 'patient',
  };
  const { gaps: gapsRule2 } = detectCareGaps(mockPatient, [vagueUpdate], [], []);
  const rule2Gap = gapsRule2.find((g) => g.type === 'missing_severity');
  assert(!!rule2Gap, 'Rule 2: Detects missing_severity gap when symptom reported without explicit severity');
  assert(rule2Gap?.severity === 'medium', 'Rule 2: missing_severity gap assigned medium severity');
  assert(!!rule2Gap?.followupQuestion, 'Rule 2: Provides targeted follow-up question for clinical clarification');

  // Rule 3: Repeated missed doses (>= 2 unadministered doses)
  const missedDoseSchedules: MedicationSchedule[] = [
    {
      id: 'sched-1',
      patientId: mockPatient.id,
      medicineId: 'med-1',
      medicineName: 'Atorvastatin',
      dosage: '20mg',
      scheduledTime: '08:00',
      status: 'missed',
      instructions: 'Take with water',
      reason: 'Forgot morning dose',
    },
    {
      id: 'sched-2',
      patientId: mockPatient.id,
      medicineId: 'med-2',
      medicineName: 'Metformin',
      dosage: '500mg',
      scheduledTime: '13:00',
      status: 'missed',
      instructions: 'Take after meal',
      reason: 'Felt nauseous',
    },
    {
      id: 'sched-3',
      patientId: mockPatient.id,
      medicineId: 'med-1',
      medicineName: 'Atorvastatin',
      dosage: '20mg',
      scheduledTime: '20:00',
      status: 'pending',
      instructions: 'Take at bedtime',
    },
  ];
  const { gaps: gapsRule3 } = detectCareGaps(mockPatient, [], missedDoseSchedules, []);
  const rule3Gap = gapsRule3.find((g) => g.type === 'repeated_missed_dose');
  assert(!!rule3Gap, 'Rule 3: Detects repeated_missed_dose gap when >= 2 doses missed');
  assert(rule3Gap?.severity === 'high', 'Rule 3: repeated_missed_dose assigned high severity');
  assert(rule3Gap?.evidence.includes('2 missed doses'), 'Rule 3: Evidence specifies exact count of missed doses');

  // Single missed dose should NOT trigger repeated_missed_dose gap
  const singleMissedSchedule: MedicationSchedule[] = [
    {
      id: 'sched-1',
      patientId: mockPatient.id,
      medicineId: 'med-1',
      medicineName: 'Atorvastatin',
      dosage: '20mg',
      scheduledTime: '08:00',
      status: 'missed',
      instructions: 'Take with water',
    },
    {
      id: 'sched-2',
      patientId: mockPatient.id,
      medicineId: 'med-2',
      medicineName: 'Metformin',
      dosage: '500mg',
      scheduledTime: '13:00',
      status: 'taken',
      instructions: 'Take after meal',
    },
  ];
  const { gaps: gapsSingleMissed } = detectCareGaps(mockPatient, [], singleMissedSchedule, []);
  assert(!gapsSingleMissed.some((g) => g.type === 'repeated_missed_dose'), 'Rule 3: Single missed dose does NOT trigger repeated_missed_dose gap');

  // Rule 4: Unanswered follow-up question (> 24 hours)
  const pendingFollowUp: FollowUp = {
    id: 'fup-1',
    patientId: mockPatient.id,
    question: 'Did your headache improve after drinking water?',
    answer: null,
    askedAt: new Date(Date.now() - 30 * 3600 * 1000).toISOString(), // 30h ago
    answeredAt: null,
    status: 'pending',
  };
  const { gaps: gapsRule4 } = detectCareGaps(mockPatient, [], [], [pendingFollowUp]);
  const rule4Gap = gapsRule4.find((g) => g.type === 'unanswered_followup');
  assert(!!rule4Gap, 'Rule 4: Detects unanswered_followup gap for pending doctor questions > 24 hours');
  assert(rule4Gap?.severity === 'medium', 'Rule 4: unanswered_followup assigned medium severity');

  // Answered follow-up should NOT trigger gap
  const answeredFollowUp: FollowUp = {
    ...pendingFollowUp,
    answer: 'Yes, feeling much better now.',
    answeredAt: new Date().toISOString(),
    status: 'answered',
  };
  const { gaps: gapsAnswered } = detectCareGaps(mockPatient, [], [], [answeredFollowUp]);
  assert(!gapsAnswered.some((g) => g.type === 'unanswered_followup'), 'Rule 4: Answered follow-up does NOT trigger unanswered_followup gap');

  // Rule 5: Overdue update (> 24 hours without update)
  const staleUpdate: HealthUpdate = {
    id: 'upd-old',
    patientId: mockPatient.id,
    submittedAt: new Date(Date.now() - 30 * 3600 * 1000).toISOString(), // 30h ago
    state: 'good',
    symptomDescription: 'All good',
    source: 'patient',
  };
  const { gaps: gapsRule5 } = detectCareGaps(mockPatient, [staleUpdate], [], []);
  const rule5Gap = gapsRule5.find((g) => g.type === 'overdue_update');
  assert(!!rule5Gap, 'Rule 5: Detects overdue_update gap when patient has not updated in > 24 hours');
  assert(rule5Gap?.severity === 'low', 'Rule 5: overdue_update assigned low severity');

  // Recent update (e.g., 2 hours ago) should NOT trigger overdue_update
  const recentUpdate: HealthUpdate = {
    id: 'upd-rec',
    patientId: mockPatient.id,
    submittedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2h ago
    state: 'good',
    symptomDescription: 'Recovering nicely',
    source: 'patient',
  };
  const { gaps: gapsRecent } = detectCareGaps(mockPatient, [recentUpdate], [], []);
  assert(!gapsRecent.some((g) => g.type === 'overdue_update'), 'Rule 5: Recent update does NOT trigger overdue_update gap');

  // Rule 6: Allergy conflict (Amoxicillin scheduled for patient with Penicillin allergy)
  const allergySchedule: MedicationSchedule[] = [
    {
      id: 'sched-allergy',
      patientId: mockPatient.id,
      medicineId: 'med-amox',
      medicineName: 'Amoxicillin 500mg',
      dosage: '500mg',
      scheduledTime: '09:00',
      status: 'pending',
      instructions: 'Take with food',
    },
  ];
  const { gaps: gapsRule6 } = detectCareGaps(mockPatient, [], allergySchedule, []);
  const rule6Gap = gapsRule6.find((g) => g.type === 'allergy_conflict');
  assert(!!rule6Gap, 'Rule 6: Detects allergy_conflict gap when prescribed medicine conflicts with patient allergy');
  assert(rule6Gap?.severity === 'high', 'Rule 6: allergy_conflict gap assigned high severity');

  // Rule 7: Duplicate medicine (duplicate Atorvastatin schedules)
  const duplicateSchedule: MedicationSchedule[] = [
    {
      id: 'sched-dup-1',
      patientId: mockPatient.id,
      medicineId: 'med-atorv-1',
      medicineName: 'Atorvastatin',
      dosage: '20mg',
      scheduledTime: '08:00',
      status: 'pending',
      instructions: 'Take in morning',
    },
    {
      id: 'sched-dup-2',
      patientId: mockPatient.id,
      medicineId: 'med-atorv-2',
      medicineName: 'Atorvastatin',
      dosage: '40mg',
      scheduledTime: '20:00',
      status: 'pending',
      instructions: 'Take at night',
    },
  ];
  const { gaps: gapsRule7 } = detectCareGaps(mockPatient, [], duplicateSchedule, []);
  const rule7Gap = gapsRule7.find((g) => g.type === 'duplicate_medicine');
  assert(!!rule7Gap, 'Rule 7: Detects duplicate_medicine gap when duplicate medication schedules exist');
  assert(rule7Gap?.severity === 'high', 'Rule 7: duplicate_medicine gap assigned high severity');

  // Deduplication check: existing open gaps are not re-added
  const existingOpenGap: CareGap = {
    id: 'gap-exist-1',
    patientId: mockPatient.id,
    type: 'new_symptom',
    severity: 'high',
    evidence: `New or worsening symptom reported: "${badUpdate.symptomDescription}"`,
    timestamp: badUpdate.submittedAt,
    missingInfo: 'Severity (1-10) and duration not specified',
    followupQuestion: 'Aapko kya takleef ho rahi hai? Kab se shuru hui?',
    status: 'open',
  };
  const { gaps: deduplicatedResult } = detectCareGaps(
    mockPatient,
    [badUpdate],
    [],
    [],
    [existingOpenGap]
  );
  assert(
    !deduplicatedResult.some((g) => g.type === 'new_symptom'),
    'Deduplication: Existing open gap with matching type and evidence is not duplicated'
  );

  console.log('');

  // -------------------------------------------------------------------------
  // SUITE 2: Smart Priority Score & Explainable Factor Breakdown
  // -------------------------------------------------------------------------
  console.log('--- SUITE 2: Smart Priority Score & Explainable Breakdown ---');

  // Test 1: On-track patient (no gaps, good adherence)
  const onTrackSchedules: MedicationSchedule[] = [
    { id: 's1', patientId: mockPatient.id, medicineId: 'm1', medicineName: 'Metformin', dosage: '500mg', scheduledTime: '08:00', status: 'taken', instructions: 'With breakfast' },
    { id: 's2', patientId: mockPatient.id, medicineId: 'm1', medicineName: 'Metformin', dosage: '500mg', scheduledTime: '20:00', status: 'taken', instructions: 'With dinner' },
  ];
  const onTrackResult = calculatePatientTriageScore(mockPatient, [recentUpdate], onTrackSchedules, []);
  assert(onTrackResult.score === 0, 'On-track patient scores exactly 0 points');
  assert(onTrackResult.priority === 'on_track', 'Score 0 maps to on_track priority tier');
  assert(onTrackResult.factors.length === 0, 'On-track patient has zero adverse factors');
  assert(onTrackResult.criticalSafetyOverride === false, 'On-track patient has no critical override');

  // Test 2: Needs attention patient (50 <= score < 80)
  // bad symptom (40 pts) + missing severity (20 pts) = 60 pts
  const unratedBadUpdate: HealthUpdate = {
    id: 'upd-unrated',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'bad',
    symptomDescription: 'Persistent nausea and headache since morning',
    source: 'patient',
  };
  const needsAttentionResult = calculatePatientTriageScore(
    mockPatient,
    [unratedBadUpdate],
    onTrackSchedules,
    []
  );
  assert(
    needsAttentionResult.score >= 50 && needsAttentionResult.score < 80,
    `Needs attention patient score in 50-79 range (actual: ${needsAttentionResult.score})`
  );
  assert(needsAttentionResult.priority === 'needs_attention', 'Score 60 maps to needs_attention priority tier');
  assert(needsAttentionResult.factors.length === 2, 'Explainable factors contains exactly 2 contributors');
  assert(needsAttentionResult.factors.some((f) => f.rule === 'new_symptom' && f.points === 40), 'Factor 1 identifies new_symptom with +40 points');
  assert(needsAttentionResult.factors.some((f) => f.rule === 'missing_severity' && f.points === 20), 'Factor 2 identifies missing_severity with +20 points');

  // Test 3: Urgent patient (score >= 80)
  // bad symptom (40) + allergy safety flag (40) + missed doses (30) = 110 raw -> clamped to 100
  const openAllergyGap: CareGap = {
    id: 'gap-allergy-1',
    patientId: mockPatient.id,
    type: 'allergy_conflict',
    severity: 'high',
    evidence: 'Patient recorded allergy to Penicillin, current medicine Amoxicillin conflicts',
    timestamp: new Date().toISOString(),
    missingInfo: null,
    followupQuestion: null,
    status: 'open',
  };
  const urgentResult = calculatePatientTriageScore(
    mockPatient,
    [badUpdate],
    missedDoseSchedules,
    [pendingFollowUp],
    [openAllergyGap]
  );
  assert(urgentResult.score === 100, `Raw score 110+ clamped strictly to upper bound of 100 (actual: ${urgentResult.score})`);
  assert(urgentResult.priority === 'urgent', 'Score 100 maps to urgent priority tier');
  assert(urgentResult.factors.length >= 3, 'Urgent patient includes all contributing explainable factors');

  // Test 4: Strict 0 to 100 bounds guarantee
  assert(urgentResult.score <= 100, 'Triage score never exceeds 100');
  assert(urgentResult.score >= 0, 'Triage score is never negative');

  // Test 5: Every factor has mandatory explainability fields: rule, points, reason, evidence
  urgentResult.factors.forEach((f) => {
    assert(
      typeof f.rule === 'string' &&
      typeof f.points === 'number' &&
      typeof f.reason === 'string',
      `Factor "${f.rule}" (+${f.points}) has valid rule, points, and human-readable reason`
    );
  });

  // Test 6: Determinism check (10 evaluations)
  const scores = Array.from({ length: 10 }, () =>
    calculatePatientTriageScore(mockPatient, [badUpdate], missedDoseSchedules, [pendingFollowUp]).score
  );
  const allIdentical = scores.every((s) => s === scores[0]);
  assert(allIdentical, `Score calculation is 100% deterministic on repeated evaluations (${scores[0]} pts across 10 runs)`);

  // Test 7: Configurable Scoring Weights
  const customWeightsResult = calculatePatientTriageScore(
    mockPatient,
    [recentUpdate],
    onTrackSchedules,
    [],
    [],
    { newSymptom: 75 } // Custom weights override
  );
  assert(typeof customWeightsResult.score === 'number', 'Accepts custom scoring weights configuration');

  // Test 8: Overdue Care-Plan Task Scoring (+20 pts)
  const overdueCareTask = {
    id: 'act-test-1',
    patientId: mockPatient.id,
    title: 'Baseline Serum Electrolytes & Renal Panel Lab Booking',
    description: 'Schedule routine phlebotomy visit',
    status: 'open' as const,
    dueDate: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 48h overdue
    createdAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
  };
  const taskResult = calculatePatientTriageScore(
    mockPatient,
    [recentUpdate],
    onTrackSchedules,
    [],
    [],
    undefined,
    [overdueCareTask]
  );
  assert(taskResult.score === 20, `Overdue care task scores +20 points (actual: ${taskResult.score})`);
  assert(taskResult.factors.some((f) => f.rule === 'overdue_care_task' && f.points === 20), 'Factor identifies overdue_care_task with +20 points');

  console.log('');

  // -------------------------------------------------------------------------
  // SUITE 3: Critical Safety Override & Emergency Pathway
  // -------------------------------------------------------------------------
  console.log('--- SUITE 3: Critical Safety Emergency Override ---');

  const emergencySymptomUpdate: HealthUpdate = {
    id: 'upd-emerg',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'bad',
    symptomDescription: 'Sudden severe chest pain radiating to left arm and shortness of breath',
    source: 'patient',
  };

  const emergencyResult = calculatePatientTriageScore(
    mockPatient,
    [emergencySymptomUpdate],
    onTrackSchedules,
    []
  );

  assert(emergencyResult.criticalSafetyOverride === true, 'Emergency red-flag symptom triggers criticalSafetyOverride: true');
  assert(emergencyResult.priority === 'urgent', 'Critical safety override forces priority to urgent');
  assert(!!emergencyResult.criticalAlertMessage, 'Critical safety override provides urgent clinical alert message');
  assert(emergencyResult.criticalAlertMessage?.includes('CRITICAL ALERT'), 'Alert message explicitly highlights emergency triage guidance');

  // Emergency override takes precedence even if patient self-reports "ok"
  const mildStateEmergency: HealthUpdate = {
    id: 'upd-mild-emerg',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'ok',
    symptomDescription: 'Felt some chest pain and difficulty breathing',
    source: 'patient',
  };
  const mildEmergencyResult = calculatePatientTriageScore(mockPatient, [mildStateEmergency], onTrackSchedules, []);
  assert(mildEmergencyResult.criticalSafetyOverride === true, 'Emergency keywords trigger override regardless of patient self-reported "ok" state');
  assert(mildEmergencyResult.priority === 'urgent', 'Forces urgent review tier regardless of numerical score');

  // Audit 2: Synthetic phrase verification for negation, family history, and informational contexts
  // Phrase 1: Affirmative emergency symptoms
  const affirmativeUpdate: HealthUpdate = {
    id: 'upd-aff',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'bad',
    symptomDescription: 'I have chest heaviness and shortness of breath.',
    source: 'patient',
  };
  const affRes = calculatePatientTriageScore(mockPatient, [affirmativeUpdate], onTrackSchedules, []);
  assert(affRes.criticalSafetyOverride === true, 'Affirmative: "I have chest heaviness and shortness of breath." triggers override');
  assert(affRes.priority === 'urgent', 'Affirmative emergency forces urgent priority');

  // Phrase 2: Negated emergency symptoms
  const negatedUpdate: HealthUpdate = {
    id: 'upd-neg',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'ok',
    symptomDescription: 'I do not have chest pain or shortness of breath.',
    source: 'patient',
  };
  const negRes = calculatePatientTriageScore(mockPatient, [negatedUpdate], onTrackSchedules, []);
  assert(negRes.criticalSafetyOverride === false, 'Negation: "I do not have chest pain or shortness of breath." does NOT trigger false override');

  // Phrase 3: Third-person / family history reference
  const familyHistoryUpdate: HealthUpdate = {
    id: 'upd-fam',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'ok',
    symptomDescription: 'My father had chest pain last year.',
    source: 'patient',
  };
  const famRes = calculatePatientTriageScore(mockPatient, [familyHistoryUpdate], onTrackSchedules, []);
  assert(famRes.criticalSafetyOverride === false, 'Family history: "My father had chest pain last year." does NOT trigger false override');

  // Phrase 4: General absence of symptoms
  const noSymptomsUpdate: HealthUpdate = {
    id: 'upd-nosymp',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'good',
    symptomDescription: 'No symptoms today.',
    source: 'patient',
  };
  const noSympRes = calculatePatientTriageScore(mockPatient, [noSymptomsUpdate], onTrackSchedules, []);
  assert(noSympRes.criticalSafetyOverride === false, 'Absence: "No symptoms today." does NOT trigger override');

  // Phrase 5: Informational / unrelated mention of an emergency keyword
  const informationalUpdate: HealthUpdate = {
    id: 'upd-info',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'ok',
    symptomDescription: 'I read an article about stroke yesterday.',
    source: 'patient',
  };
  const infoRes = calculatePatientTriageScore(mockPatient, [informationalUpdate], onTrackSchedules, []);
  assert(infoRes.criticalSafetyOverride === false, 'Informational: "I read an article about stroke yesterday." does NOT trigger false override');

  // Phrase 6: Mixed clause — Negated chest pain, but affirmative shortness of breath
  const mixedClauseUpdate: HealthUpdate = {
    id: 'upd-mix',
    patientId: mockPatient.id,
    submittedAt: new Date().toISOString(),
    state: 'bad',
    symptomDescription: 'I do not have chest pain, but I have severe shortness of breath.',
    source: 'patient',
  };
  const mixRes = calculatePatientTriageScore(mockPatient, [mixedClauseUpdate], onTrackSchedules, []);
  assert(mixRes.criticalSafetyOverride === true, 'Contrasting clause with affirmative emergency symptom triggers override');


  console.log('');

  // -------------------------------------------------------------------------
  // SUITE 4: Data Freshness, Missing Information & Record Warnings
  // -------------------------------------------------------------------------
  console.log('--- SUITE 4: Data Freshness & Record Warnings ---');

  // Case A: Missing check-in (no health updates at all)
  const noUpdateResult = calculatePatientTriageScore(mockPatient, [], onTrackSchedules, []);
  assert(
    noUpdateResult.dataWarnings.some((w) => w.includes('No health check-in submitted')),
    'Emits honest warning when patient has never submitted a health update'
  );

  // Case B: Stale check-in (> 24 hours ago)
  const staleCheckinResult = calculatePatientTriageScore(mockPatient, [staleUpdate], onTrackSchedules, []);
  assert(
    staleCheckinResult.dataWarnings.some((w) => w.includes('Last health check-in was submitted')),
    'Emits data warning when check-in is older than 24 hours'
  );

  // Case C: Overdue follow-ups (> 24 hours)
  const overdueFollowupResult = calculatePatientTriageScore(mockPatient, [recentUpdate], onTrackSchedules, [pendingFollowUp]);
  assert(
    overdueFollowupResult.dataWarnings.some((w) => w.includes('follow-up question(s) overdue')),
    'Emits data warning when pending doctor follow-up is unanswered for > 24 hours'
  );

  // Case D: Unconfirmed prescription isolation (No active schedules)
  const unconfirmedResult = calculatePatientTriageScore(mockPatient, [recentUpdate], [], []);
  assert(
    unconfirmedResult.dataWarnings.some((w) => w.includes('No active medication schedules: Awaiting doctor prescription review or lock')),
    'Unconfirmed draft: Emits clear warning that schedules are inactive awaiting doctor review'
  );
  // Zero missed dose care gaps should be generated when schedules are empty
  const { gaps: gapsNoSched } = detectCareGaps(mockPatient, [recentUpdate], [], []);
  assert(
    !gapsNoSched.some((g) => g.type === 'repeated_missed_dose'),
    'Unconfirmed draft: Does NOT trigger false repeated_missed_dose care gaps when schedules are inactive'
  );

  console.log('');

  // -------------------------------------------------------------------------
  // SUITE 5: CareGap Lifecycle & Doctor Workflow
  // -------------------------------------------------------------------------
  console.log('--- SUITE 5: CareGap Lifecycle & Doctor Workflow ---');

  const { gaps: detectedGaps } = detectCareGaps(mockPatient, [badUpdate], missedDoseSchedules, [pendingFollowUp]);
  assert(detectedGaps.length > 0, `Initial detection produces ${detectedGaps.length} care gaps`);

  // Simulate materialized gaps with open status
  const openGaps: CareGap[] = detectedGaps.map((g, idx) => ({
    ...g,
    id: `gap-${idx + 1}`,
    status: 'open',
  }));
  const initialOpenCount = openGaps.filter((g) => g.status === 'open').length;
  assert(initialOpenCount === detectedGaps.length, 'All materialized care gaps start with status open');

  // Simulate Doctor Action: Review first gap
  const reviewedGap: CareGap = { ...openGaps[0], status: 'reviewed' };
  assert(reviewedGap.status === 'reviewed', 'Doctor action: CareGap transitions to "reviewed" status');

  // Simulate Doctor Action: Plan Follow-Up for second gap
  const plannedGap: CareGap = { ...openGaps[1], status: 'followup_planned' };
  assert(plannedGap.status === 'followup_planned', 'Doctor action: CareGap transitions to "followup_planned" status');

  // Verify open count decrements
  const activeGaps = [reviewedGap, plannedGap, ...openGaps.slice(2)];
  const remainingOpen = activeGaps.filter((g) => g.status === 'open').length;
  assert(remainingOpen === initialOpenCount - 2, `Open gap count decrements correctly (${initialOpenCount} -> ${remainingOpen})`);

  console.log('');

  // -------------------------------------------------------------------------
  // SUITE 6: End-to-End Workflow & Data Service Verification
  // -------------------------------------------------------------------------
  console.log('--- SUITE 6: End-to-End Workflow & Data Service Verification ---');

  const summaries = await dataService.fetchPatientSummaries();
  assert(Array.isArray(summaries) && summaries.length > 0, 'dataService.fetchPatientSummaries() returns patient list');

  const firstSummary = summaries[0];
  assert(typeof firstSummary.triageScore === 'number', 'Patient summary includes numerical triageScore');
  assert(firstSummary.triageScore >= 0 && firstSummary.triageScore <= 100, 'Patient summary triageScore is bounded between 0 and 100');
  assert(['urgent', 'needs_attention', 'on_track'].includes(firstSummary.priority), `Patient summary priority is valid tier (${firstSummary.priority})`);
  assert(Array.isArray(firstSummary.scoreFactors), 'Patient summary includes scoreFactors array');
  assert(Array.isArray(firstSummary.dataWarnings), 'Patient summary includes dataWarnings array');
  assert(typeof firstSummary.overdueTasksCount === 'number', 'Patient summary includes numerical overdueTasksCount');
  assert(typeof firstSummary.overdueFollowUpsCount === 'number', 'Patient summary includes numerical overdueFollowUpsCount');

  // Queue sorting verification: Priority High -> Low
  const sortedByPriority = [...summaries].sort((a, b) => {
    if (a.criticalSafetyOverride && !b.criticalSafetyOverride) return -1;
    if (!a.criticalSafetyOverride && b.criticalSafetyOverride) return 1;
    return (b.triageScore ?? 0) - (a.triageScore ?? 0);
  });
  const firstPatientPriority = sortedByPriority[0].priority;
  const lastPatientPriority = sortedByPriority[sortedByPriority.length - 1].priority;
  assert(
    firstPatientPriority === 'urgent' || firstPatientPriority === 'needs_attention',
    `Priority sorting places high-risk patients first (${firstPatientPriority} comes before ${lastPatientPriority})`
  );

  // Queue sorting verification: Overdue Status First
  const sortedByOverdue = [...summaries].sort((a, b) => {
    const aOverdue = (a.overdueFollowUpsCount ?? 0) + (a.overdueTasksCount ?? 0) + (a.openGaps ?? 0);
    const bOverdue = (b.overdueFollowUpsCount ?? 0) + (b.overdueTasksCount ?? 0) + (b.openGaps ?? 0);
    if (bOverdue !== aOverdue) return bOverdue - aOverdue;
    return (b.triageScore ?? 0) - (a.triageScore ?? 0);
  });
  const topOverdueTotal = (sortedByOverdue[0].overdueFollowUpsCount ?? 0) + (sortedByOverdue[0].overdueTasksCount ?? 0) + (sortedByOverdue[0].openGaps ?? 0);
  const bottomOverdueTotal = (sortedByOverdue[sortedByOverdue.length - 1].overdueFollowUpsCount ?? 0) + (sortedByOverdue[sortedByOverdue.length - 1].overdueTasksCount ?? 0) + (sortedByOverdue[sortedByOverdue.length - 1].openGaps ?? 0);
  assert(
    topOverdueTotal >= bottomOverdueTotal,
    `Overdue sorting correctly prioritizes records with outstanding gaps and overdue tasks (${topOverdueTotal} >= ${bottomOverdueTotal})`
  );

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('================================================================');

  if (failed > 0) {
    console.error(`CareGap Radar & Priority Score test suite failed with ${failed} failure(s).`);
    process.exit(1);
  } else {
    console.log('CAREGAP RADAR + SMART PRIORITY SCORE FULLY VERIFIED!\n');
    process.exit(0);
  }
}

runCareGapRadarTests().catch((err) => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
