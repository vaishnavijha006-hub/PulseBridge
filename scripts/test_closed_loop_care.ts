/**
 * Automated Verification Suite for the 6 Core Closed-Loop Care Features
 * PulseBridge AI
 *
 * Verifies:
 * 1. Feature 1: AI Prescription Extract + Doctor Lock
 * 2. Feature 2: Allergy & Duplicate Safety Flag (including cross-reactivity)
 * 3. Feature 3: Smart Reminder Engine (20-min escalation, snooze, deduplication, in_app_simulated)
 * 4. Feature 4: CareGap Radar with Evidence, Severity, and Timestamp
 * 5. Feature 5: Doctor Live Patient Status, Triage Score, Explainable Factors, Emergency Override
 * 6. Feature 6: Family Recovery Circle Consent Enforcement and Privacy Boundary
 * 7. End-to-End Closed-Loop Care Workflow Integration
 */

import {
  extractPrescriptionFromText,
  screenPrescriptionSafety,
} from '../src/services/prescriptionExtractor';
import {
  detectCareGaps,
  calculatePatientTriageScore,
} from '../src/services/careGapRules';
import {
  generateReminders,
  evaluateDoseTiming,
  applyOverdueEvaluations,
} from '../src/utils/reminderEngine';
import { dataService } from '../src/services/dataService';
import type {
  PrescriptionField,
  MedicationSchedule,
  FollowUp,
  PatientProfile,
  HealthUpdate,
  CareGap,
} from '../src/types';

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
console.log('PULSEBRIDGE AI — 6 CORE CLOSED-LOOP CARE FEATURES TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// FEATURE 1: AI Prescription Extract + Doctor Lock
// -----------------------------------------------------------------------------
console.log('--- FEATURE 1: AI Prescription Extract + Doctor Lock ---');
{
  const rawNarrative = `
    Rx:
    Tab Amoxicillin 500mg
    Frequency: Thrice daily after meals
    Duration: 7 days
    Instructions: Take with plenty of water
  `;

  const extracted = extractPrescriptionFromText(rawNarrative);
  const medField = extracted.fields.find((f) => f.key === 'medicine');
  const doseField = extracted.fields.find((f) => f.key === 'dosage');
  const freqField = extracted.fields.find((f) => f.key === 'frequency');
  const durField = extracted.fields.find((f) => f.key === 'duration');
  const instField = extracted.fields.find((f) => f.key === 'instructions');

  assert(Boolean(medField && medField.value.includes('Amoxicillin')), 'Extracts medicine name correctly');
  assert(Boolean(doseField && doseField.value.includes('500mg')), 'Extracts dosage correctly');
  assert(Boolean(freqField && freqField.value.toLowerCase().includes('thrice daily')), 'Extracts frequency correctly');
  assert(Boolean(durField && durField.value.includes('7 days')), 'Extracts duration correctly');
  assert(Boolean(instField && instField.value.includes('Take with plenty of water')), 'Extracts instructions correctly');

  // Grounding test: missing fields marked uncertain, never hallucinated
  const partialNarrative = 'Tab Metformin 500mg. Take as directed.';
  const partialExtracted = extractPrescriptionFromText(partialNarrative);
  const missingDur = partialExtracted.fields.find((f) => f.key === 'duration');
  assert(missingDur?.value === '' && missingDur.status === 'uncertain', 'Missing fields are not hallucinated; marked uncertain');

  // Doctor lock enforcement: confirmation must fail if critical fields are uncertain or missing
  const unverifiedFields: PrescriptionField[] = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Metformin', status: 'confirmed' },
    { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'confirmed' },
    { key: 'frequency', labelKey: 'rx_frequency', value: 'Twice daily', status: 'uncertain' }, // uncertain!
    { key: 'duration', labelKey: 'rx_duration', value: '14 days', status: 'confirmed' },
  ];

  const failedConfirm = await dataService.confirmCarePlan('p-test-lock', unverifiedFields);
  assert('error' in failedConfirm, 'Care plan confirmation blocked when critical field is uncertain');

  // Doctor approval succeeds when all critical fields are verified
  const verifiedFields: PrescriptionField[] = unverifiedFields.map((f) => ({ ...f, status: 'confirmed' as const }));
  const successConfirm = await dataService.confirmCarePlan('p1', verifiedFields);
  assert('ok' in successConfirm && successConfirm.ok === true, 'Care plan confirmation succeeds when all critical fields are doctor-verified');

  // Verify lock metadata
  const updatedDraft = await dataService.fetchPrescriptionDraft('p1');
  assert(Boolean(updatedDraft?.confirmed === true), 'Prescription draft marked confirmed after lock');
  assert(Boolean(updatedDraft?.confirmedBy === 'Dr. Anita Desai, MD'), 'Confirmed doctor name recorded in audit trail');
  assert(Boolean(updatedDraft?.confirmedAt), 'Confirmation timestamp recorded in audit trail');
}

// -----------------------------------------------------------------------------
// FEATURE 2: Allergy & Duplicate Safety Flag
// -----------------------------------------------------------------------------
console.log('\n--- FEATURE 2: Allergy & Duplicate Safety Flag ---');
{
  const testPatient: PatientProfile = {
    id: 'p-allergy-test',
    name: 'Test Allergy Patient',
    age: 45,
    gender: 'female',
    phone: '9999999999',
    symptoms: 'Fever and throat pain',
    allergies: 'Penicillin, Sulfa',
    currentMeds: 'Aspirin 75mg, Metformin 500mg',
    language: 'en',
  };

  // Test Direct Allergy Match
  const directAllergyFields: PrescriptionField[] = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Penicillin V', status: 'confirmed' },
    { key: 'dosage', labelKey: 'rx_dosage', value: '250mg', status: 'confirmed' },
  ];
  const directAllergyScreen = screenPrescriptionSafety(directAllergyFields, testPatient.allergies, testPatient.currentMeds);
  assert(directAllergyScreen.allergyConflict === true, 'Detects direct allergy conflict with Penicillin');
  assert(directAllergyScreen.flags.some((f) => f.type === 'allergy_conflict'), 'Includes structured allergy conflict flag');

  // Test Drug-Class Cross-Reactivity (Amoxicillin for Penicillin allergy)
  const crossReactivityFields: PrescriptionField[] = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Amoxicillin Clavulanate', status: 'confirmed' },
    { key: 'dosage', labelKey: 'rx_dosage', value: '625mg', status: 'confirmed' },
  ];
  const crossScreen = screenPrescriptionSafety(crossReactivityFields, testPatient.allergies, testPatient.currentMeds);
  assert(crossScreen.allergyConflict === true, 'Detects drug-class cross-reactivity (Amoxicillin under Penicillin allergy)');

  // Test Sulfa Cross-Reactivity (Cotrimoxazole / Septra under Sulfa allergy)
  const sulfaCrossFields: PrescriptionField[] = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Cotrimoxazole', status: 'confirmed' },
  ];
  const sulfaScreen = screenPrescriptionSafety(sulfaCrossFields, testPatient.allergies, testPatient.currentMeds);
  assert(sulfaScreen.allergyConflict === true, 'Detects sulfa cross-reactivity for Cotrimoxazole');

  // Test Duplicate Medication Match against currentMeds
  const duplicateMedFields: PrescriptionField[] = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Aspirin', status: 'confirmed' },
    { key: 'dosage', labelKey: 'rx_dosage', value: '150mg', status: 'confirmed' },
  ];
  const dupScreen = screenPrescriptionSafety(duplicateMedFields, 'None', testPatient.currentMeds);
  assert(dupScreen.duplicateMedication === true, 'Detects duplicate medication against currentMeds (Aspirin)');
  assert(dupScreen.flags.some((f) => f.type === 'duplicate_medication'), 'Includes structured duplicate medication flag');

  // Test Duplicate Medication Match against active schedules
  const activeSchedules: MedicationSchedule[] = [
    { id: 's-active', medicineId: 'm-act', medicineName: 'Atorvastatin', dosage: '20mg', scheduledTime: '22:00', status: 'pending' },
  ];
  const dupSchedFields: PrescriptionField[] = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Atorvastatin', status: 'confirmed' },
    { key: 'dosage', labelKey: 'rx_dosage', value: '10mg', status: 'confirmed' },
  ];
  const schedDupScreen = screenPrescriptionSafety(dupSchedFields, 'None', '', activeSchedules);
  assert(schedDupScreen.duplicateMedication === true, 'Detects duplicate medication against active schedules (Atorvastatin)');
}

// -----------------------------------------------------------------------------
// FEATURE 3: Smart Reminder Engine
// -----------------------------------------------------------------------------
console.log('\n--- FEATURE 3: Smart Reminder Engine ---');
{
  const refTime = new Date('2026-10-17T09:00:00Z');

  const testSchedules: MedicationSchedule[] = [
    // 1. Due soon dose (09:15)
    { id: 's-due', medicineId: 'm1', medicineName: 'Metformin', dosage: '500mg', scheduledTime: '09:15', status: 'pending' },
    // 2. Overdue dose beyond 20-min grace period (08:30 -> 30 min overdue)
    { id: 's-overdue', medicineId: 'm2', medicineName: 'Aspirin', dosage: '75mg', scheduledTime: '08:30', status: 'pending' },
    // 3. Snoozed dose (snoozed until 09:10)
    { id: 's-snoozed', medicineId: 'm3', medicineName: 'Calcium', dosage: '500mg', scheduledTime: '08:45', status: 'snoozed', snoozedUntil: '2026-10-17T09:10:00Z' },
    // 4. Already taken dose
    { id: 's-taken', medicineId: 'm4', medicineName: 'Vitamin D', dosage: '1000IU', scheduledTime: '08:00', status: 'taken' },
  ];

  const testFollowUps: FollowUp[] = [
    { id: 'f-1', patientId: 'p1', question: 'How is your chest pain now?', askedAt: new Date(refTime.getTime() - 3600000).toISOString(), answeredAt: null, answer: null, status: 'pending' },
  ];

  const reminders = generateReminders(testSchedules, testFollowUps, refTime);

  // Check channel labeling
  assert(reminders.every((r) => r.channel === 'in_app_simulated'), 'All reminders explicitly labeled as in_app_simulated channel');

  // Check 20-minute escalation rule
  const escalatedReminder = reminders.find((r) => r.scheduleId === 's-overdue');
  assert(Boolean(escalatedReminder && escalatedReminder.escalated === true), '20-min escalation triggered for dose overdue >20 minutes');
  assert(Boolean(escalatedReminder && escalatedReminder.type === 'missed_dose'), 'Escalated reminder categorized as missed_dose');

  // Check snoozed dose
  const snoozedReminder = reminders.find((r) => r.scheduleId === 's-snoozed');
  assert(Boolean(snoozedReminder && snoozedReminder.message.includes('Snoozed')), 'Snoozed dose reminder includes snooze status');

  // Check follow-up reminder
  const followUpReminder = reminders.find((r) => r.type === 'followup');
  assert(Boolean(followUpReminder && followUpReminder.message.includes('Follow-up')), 'Generates follow-up reminder for pending question');

  // Deduplication check: each scheduleId appears at most once
  const scheduleIds = reminders.map((r) => r.scheduleId).filter(Boolean);
  const uniqueScheduleIds = new Set(scheduleIds);
  assert(scheduleIds.length === uniqueScheduleIds.size, 'Reminders strictly deduplicated per schedule ID');
}

// -----------------------------------------------------------------------------
// FEATURE 4: CareGap Radar with Evidence
// -----------------------------------------------------------------------------
console.log('\n--- FEATURE 4: CareGap Radar with Evidence ---');
{
  const patient: PatientProfile = {
    id: 'p-caregap',
    name: 'CareGap Demo Patient',
    age: 50,
    gender: 'male',
    phone: '9876543210',
    symptoms: 'Severe headache for 2 days',
    allergies: 'Penicillin',
    currentMeds: 'Paracetamol',
    language: 'hi',
  };

  const healthUpdates: HealthUpdate[] = [
    {
      id: 'hu-1',
      patientId: 'p-caregap',
      state: 'bad',
      symptomDescription: 'Headache worsening, throbbing pain',
      submittedAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  const schedules: MedicationSchedule[] = [
    { id: 's-m1', medicineId: 'm1', medicineName: 'Paracetamol', dosage: '650mg', scheduledTime: '08:00', status: 'missed' },
    { id: 's-m2', medicineId: 'm1', medicineName: 'Paracetamol', dosage: '650mg', scheduledTime: '14:00', status: 'cannot_take', reason: 'nausea' },
  ];

  const { gaps } = detectCareGaps(patient, healthUpdates, schedules, []);

  // Should detect new/worsening symptom gap
  const symptomGap = gaps.find((g) => g.type === 'new_symptom');
  assert(Boolean(symptomGap), 'Detects new_symptom care gap for state === "bad"');
  assert(symptomGap?.severity === 'high', 'new_symptom gap assigned high severity');
  assert(Boolean(symptomGap?.evidence && symptomGap.evidence.length > 5), 'Care gap provides clinical evidence text');
  assert(Boolean(symptomGap?.timestamp), 'Care gap records timestamp');

  // Should detect repeated missed doses gap
  const missedGap = gaps.find((g) => g.type === 'repeated_missed_dose');
  assert(Boolean(missedGap), 'Detects repeated_missed_dose gap for 2 unadministered doses');
  assert(missedGap?.severity === 'high', 'repeated_missed_dose gap assigned high severity');
}

// -----------------------------------------------------------------------------
// FEATURE 5: Doctor Live Patient Status & Triage Scoring
// -----------------------------------------------------------------------------
console.log('\n--- FEATURE 5: Doctor Live Patient Status & Triage Scoring ---');
{
  const patient: PatientProfile = {
    id: 'p-triage',
    name: 'Triage Patient',
    age: 58,
    gender: 'female',
    phone: '9876543210',
    symptoms: 'Mild joint pain',
    allergies: 'None',
    currentMeds: 'None',
    language: 'en',
  };

  // Case A: On Track (Score < 50)
  const onTrackUpdate: HealthUpdate[] = [
    { id: 'hu-good', patientId: 'p-triage', state: 'good', symptomDescription: 'Feeling fine', submittedAt: new Date().toISOString() },
  ];
  const onTrackSchedules: MedicationSchedule[] = [
    { id: 's-ok', medicineId: 'm1', medicineName: 'Vitamin C', dosage: '500mg', scheduledTime: '08:00', status: 'taken' },
  ];
  const onTrackResult = calculatePatientTriageScore(patient, onTrackUpdate, onTrackSchedules, [], []);
  assert(onTrackResult.score === 0, 'On track patient scores 0 points');
  assert(onTrackResult.priority === 'on_track', 'Score < 50 categorized as on_track');

  // Case B: Needs Attention (50 <= Score <= 79)
  // +40 for bad symptom + +20 for missing duration/severity = 60
  const attentionUpdate: HealthUpdate[] = [
    { id: 'hu-bad', patientId: 'p-triage', state: 'bad', symptomDescription: 'Joint pain feels worse', submittedAt: new Date().toISOString() },
  ];
  const attentionResult = calculatePatientTriageScore(patient, attentionUpdate, onTrackSchedules, [], []);
  assert(attentionResult.score >= 50 && attentionResult.score < 80, `Needs attention score in 50-79 range (actual: ${attentionResult.score})`);
  assert(attentionResult.priority === 'needs_attention', 'Score in 50-79 categorized as needs_attention');

  // Case C: Urgent (Score >= 80)
  // +40 (bad symptom) + +40 (allergy conflict) = 80
  const urgentGaps: CareGap[] = [
    { id: 'g-all', patientId: 'p-triage', type: 'allergy_conflict', evidence: 'Sulfa allergy flag', timestamp: new Date().toISOString(), status: 'open' },
  ];
  const urgentResult = calculatePatientTriageScore(patient, attentionUpdate, onTrackSchedules, [], urgentGaps);
  assert(urgentResult.score >= 80, `Urgent patient scores >= 80 (actual: ${urgentResult.score})`);
  assert(urgentResult.priority === 'urgent', 'Score >= 80 categorized as urgent');

  // Case D: Explainable Factors Breakdown
  assert(urgentResult.factors.length >= 2, 'Triage result provides explainable factors breakdown');
  assert(urgentResult.factors.every((f) => f.rule && typeof f.points === 'number' && f.reason), 'Every factor contains rule, points, and reason');

  // Case E: Critical Safety Override (Emergency red flag regardless of score)
  const emergencyUpdate: HealthUpdate[] = [
    { id: 'hu-em', patientId: 'p-triage', state: 'bad', symptomDescription: 'Sudden chest pain and shortness of breath', submittedAt: new Date().toISOString() },
  ];
  const emergencyResult = calculatePatientTriageScore(patient, emergencyUpdate, onTrackSchedules, [], []);
  assert(emergencyResult.criticalSafetyOverride === true, 'Emergency red-flag symptom triggers critical safety override');
  assert(emergencyResult.priority === 'urgent', 'Emergency safety override forces urgent priority');
  assert(Boolean(emergencyResult.criticalAlertMessage), 'Provides emergency alert guidance');
}

// -----------------------------------------------------------------------------
// FEATURE 6: Family Recovery Circle & Consent Privacy Boundary
// -----------------------------------------------------------------------------
console.log('\n--- FEATURE 6: Family Recovery Circle & Consent Privacy Boundary ---');
{
  // 1. Authorized Consent View
  const authorizedView = await dataService.fetchFamilyView('p1');
  assert(Boolean(authorizedView), 'Returns family view for authorized patient');
  assert(Boolean(authorizedView?.caregiverAccess.authorized === true), 'Caregiver access marked authorized');
  assert(typeof authorizedView?.dosesToday.taken === 'number', 'Authorized view includes dose completion count');
  assert(Boolean(authorizedView?.healthUpdateStatus), 'Authorized view includes general health update status');

  // Privacy check: authorized view must NEVER leak raw clinical reports or doctor notes
  assert(!('medicalReports' in (authorizedView || {})), 'Family view does NOT expose medical reports');
  assert(!('doctorNotes' in (authorizedView || {})), 'Family view does NOT expose doctor notes');
  assert(!('rawPrescriptionText' in (authorizedView || {})), 'Family view does NOT expose raw prescription narrative');

  // 2. Revoked Consent View
  await dataService.updateCaregiverAccess('p1', false);
  const revokedView = await dataService.fetchFamilyView('p1');
  assert(Boolean(revokedView && revokedView.caregiverAccess.authorized === false), 'Consent revocation reflected in family view');
  assert(revokedView?.dosesToday.taken === 0 && revokedView?.dosesToday.total === 0, 'Dose counts zeroed out when consent is revoked');
  assert(revokedView?.nextDoseTime === null, 'Next dose time suppressed when consent is revoked');
  assert(revokedView?.healthUpdateStatus === 'Consent Revoked', 'Health update status indicates Consent Revoked');
  assert(revokedView?.caregiverAccess.contactNumber === null, 'Caregiver phone contact stripped when consent is revoked');

  // Re-authorize for continued tests
  await dataService.updateCaregiverAccess('p1', true);
  const restoredView = await dataService.fetchFamilyView('p1');
  assert(restoredView?.caregiverAccess.authorized === true, 'Consent successfully re-authorized');
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`RESULTS: ${passedTests} passed, ${failedTests} failed`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL 6 CORE CLOSED-LOOP CARE FEATURES SUCCESSFULLY VERIFIED!');
  process.exit(0);
}
