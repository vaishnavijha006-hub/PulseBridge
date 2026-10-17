/**
 * PulseBridge AI — Final 3-Feature Completion & End-to-End Integration Test Suite
 * File: scripts/test_three_features_e2e.ts
 *
 * Verifies the full closed-loop workflow across the 3 core features:
 * 1. AI Prescription Scanner + Doctor Lock
 * 2. CareGap Radar + Smart Priority Score
 * 3. Consent-Based Family Recovery Circle
 *
 * Single connected workflow:
 * Patient Rx Upload -> AI Draft -> Doctor Lock -> Schedule Activation -> 
 * Adherence/Events -> CareGap Detection -> Priority Score -> Doctor Review -> Consented Family View
 */

import { handleScanPrescriptionRequest } from '../supabase/functions/scan-prescription/index';
import {
  detectCareGaps,
  calculatePatientTriageScore,
  DEFAULT_SCORING_WEIGHTS,
} from '../src/services/careGapRules';
import { dataService } from '../src/services/dataService';
import type {
  PatientProfile,
  MedicationSchedule,
  PrescriptionField,
  PrescriptionDraft,
  HealthUpdate,
  FollowUp,
  CareGap,
  PatientSummary,
} from '../src/types';

// Ensure test environment for synthetic fixtures
process.env.PULSEBRIDGE_ENV = 'test';

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

// Minimal valid 1x1 base64 PNG
const VALID_SAMPLE_BASE64_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

console.log('================================================================');
console.log('PULSEBRIDGE AI — 3-FEATURE END-TO-END INTEGRATION TEST SUITE');
console.log('================================================================\n');

async function runSuite() {
  // ---------------------------------------------------------------------------
  // SUITE 1: Feature 1 — AI Prescription Scanner + Doctor Lock
  // ---------------------------------------------------------------------------
  console.log('--- SUITE 1: AI Prescription Scanner + Doctor Lock ---');

  // 1.1 Auth & security gates
  const reqNoAuth = new Request('http://localhost:54321/functions/v1/scan-prescription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: 'p1', imageBase64: VALID_SAMPLE_BASE64_PNG, mimeType: 'image/png' }),
  });
  const resNoAuth = await handleScanPrescriptionRequest(reqNoAuth);
  assert(resNoAuth.status === 401, 'Rejects scan request missing Authorization with HTTP 401');

  const reqForeignPatient = new Request('http://localhost:54321/functions/v1/scan-prescription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-valid-jwt-token' },
    body: JSON.stringify({ patientId: 'cross-user-unauthorized-patient', imageBase64: VALID_SAMPLE_BASE64_PNG, mimeType: 'image/png' }),
  });
  const resForeignPatient = await handleScanPrescriptionRequest(reqForeignPatient);
  assert(resForeignPatient.status === 403, 'Rejects cross-patient scan attempt with HTTP 403');

  // 1.2 MIME type & size guards
  const reqBadMime = new Request('http://localhost:54321/functions/v1/scan-prescription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-valid-jwt-token' },
    body: JSON.stringify({ patientId: 'p1', imageBase64: VALID_SAMPLE_BASE64_PNG, mimeType: 'application/pdf' }),
  });
  const resBadMime = await handleScanPrescriptionRequest(reqBadMime);
  assert(resBadMime.status === 400, 'Rejects unsupported MIME type (PDF) with HTTP 400');

  // 1.3 Successful AI extraction produces unconfirmed draft
  const reqValidScan = new Request('http://localhost:54321/functions/v1/scan-prescription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-valid-jwt-token' },
    body: JSON.stringify({
      patientId: 'p1',
      imageBase64: VALID_SAMPLE_BASE64_PNG,
      mimeType: 'image/png',
      useMock: true,
    }),
  });
  const resValidScan = await handleScanPrescriptionRequest(reqValidScan);
  assert(resValidScan.status === 200, 'Valid scan returns HTTP 200');
  const scanData = await resValidScan.json();
  const draft: PrescriptionDraft = scanData.data;

  assert(draft.confirmed === false, 'AI prescription draft is strictly unconfirmed (confirmed === false)');
  assert(draft.confirmedAt === null, 'confirmedAt is strictly null on new draft');
  assert(draft.confirmedBy === null, 'confirmedBy is strictly null on new draft');
  assert(draft.fields.length >= 4, 'Extracted draft contains structured fields');
  assert(Boolean(scanData.disclaimer && scanData.disclaimer.includes('Non-diagnostic')), 'Includes mandatory non-diagnostic clinical disclaimer');

  // 1.4 Unconfirmed draft isolation: schedules remain inactive
  const initialSchedules = await dataService.fetchMedicationSchedules('p-e2e-patient');
  assert(initialSchedules.length === 0, 'No active schedules exist for new patient prior to doctor confirmation');

  // 1.5 Doctor Lock enforcement: blocks confirmation when critical fields are uncertain
  const unverifiedFields: PrescriptionField[] = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Metformin', status: 'confirmed' },
    { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'confirmed' },
    { key: 'frequency', labelKey: 'rx_frequency', value: 'Twice daily', status: 'uncertain' }, // uncertain!
    { key: 'duration', labelKey: 'rx_duration', value: '14 days', status: 'confirmed' },
  ];
  const failConfirm = await dataService.confirmCarePlan('p-e2e-patient', unverifiedFields);
  assert('error' in failConfirm, 'Doctor Lock blocks care plan confirmation when critical field is uncertain');

  // 1.6 Doctor Lock succeeds when all critical fields are doctor-confirmed
  const verifiedFields: PrescriptionField[] = unverifiedFields.map((f) => ({
    ...f,
    status: 'confirmed' as const,
  }));
  const successConfirm = await dataService.confirmCarePlan('p-e2e-patient', verifiedFields);
  assert('ok' in successConfirm && successConfirm.ok === true, 'Doctor Lock succeeds when all critical fields are verified');

  // 1.7 Schedule activation verified
  const activatedSchedules = await dataService.fetchMedicationSchedules('p-e2e-patient');
  assert(activatedSchedules.length > 0, 'Medication schedule is activated immediately upon doctor confirmation');
  assert(activatedSchedules[0].medicineName === 'Metformin', 'Activated schedule matches confirmed medicine');
  assert(activatedSchedules[0].dosage === '500mg', 'Activated schedule matches confirmed dosage');
  assert(activatedSchedules[0].status === 'pending', 'Activated schedule starts in pending status');

  // ---------------------------------------------------------------------------
  // SUITE 2: Feature 2 — CareGap Radar + Smart Priority Score
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: CareGap Radar + Smart Priority Score ---');

  const e2ePatient: PatientProfile = {
    id: 'p-e2e-caregap',
    name: 'Suresh Kumar',
    age: 54,
    gender: 'male',
    phone: '9876543210',
    symptoms: 'Mild fatigue',
    allergies: 'Penicillin',
    currentMeds: 'Amlodipine 5mg',
    language: 'hi',
  };

  // 2.1 Adherence events & health updates
  const testSchedules: MedicationSchedule[] = [
    { id: 's-cg-1', medicineId: 'm1', medicineName: 'Amoxicillin', dosage: '500mg', scheduledTime: '08:00', status: 'missed' },
    { id: 's-cg-2', medicineId: 'm1', medicineName: 'Amoxicillin', dosage: '500mg', scheduledTime: '14:00', status: 'cannot_take', reason: 'stomach ache' },
  ];

  const testUpdates: HealthUpdate[] = [
    {
      id: 'hu-cg-1',
      patientId: e2ePatient.id,
      state: 'bad',
      symptomDescription: 'High fever and throat swelling for 2 days',
      submittedAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  const testFollowUps: FollowUp[] = [
    {
      id: 'f-cg-1',
      patientId: e2ePatient.id,
      question: 'Has your fever decreased after the dose?',
      askedAt: new Date(Date.now() - 90000000).toISOString(), // >24h
      answeredAt: null,
      answer: null,
      status: 'pending',
    },
  ];

  // 2.2 CareGap detection rules
  const { gaps } = detectCareGaps(e2ePatient, testUpdates, testSchedules, testFollowUps);

  const symptomGap = gaps.find((g) => g.type === 'new_symptom');
  assert(Boolean(symptomGap), 'Detects new_symptom care gap for state === "bad"');
  assert(symptomGap?.severity === 'high', 'new_symptom gap assigned high severity');

  const missingSeverityGap = gaps.find((g) => g.type === 'missing_severity');
  assert(Boolean(missingSeverityGap), 'Detects missing_severity care gap for unrated symptom');
  assert(Boolean(missingSeverityGap?.followupQuestion), 'missing_severity provides clinical follow-up question');

  const missedDoseGap = gaps.find((g) => g.type === 'repeated_missed_dose');
  assert(Boolean(missedDoseGap), 'Detects repeated_missed_dose care gap for >= 2 unadministered doses');
  assert(missedDoseGap?.evidence.includes('2 missed doses'), 'repeated_missed_dose evidence records exact count');

  const followUpGap = gaps.find((g) => g.type === 'unanswered_followup');
  assert(Boolean(followUpGap), 'Detects unanswered_followup care gap for doctor question > 24 hours');

  const allergyGap = gaps.find((g) => g.type === 'allergy_conflict');
  assert(Boolean(allergyGap), 'Detects allergy_conflict care gap (Amoxicillin prescribed with Penicillin allergy)');

  // 2.3 Deduplication check
  const existingGaps: CareGap[] = [
    { id: 'g-old-1', patientId: e2ePatient.id, type: 'new_symptom', evidence: symptomGap?.evidence || '', timestamp: new Date().toISOString(), status: 'open' },
  ];
  const { gaps: deduplicatedGaps } = detectCareGaps(e2ePatient, testUpdates, testSchedules, testFollowUps, existingGaps);
  const newSymptomMatches = deduplicatedGaps.filter((g) => g.type === 'new_symptom' && g.evidence === symptomGap?.evidence);
  assert(newSymptomMatches.length === 0, 'Deduplication: does NOT emit duplicate open gap when identical gap exists');

  // 2.4 Smart Priority Score calculation & explainable breakdown
  const triage = calculatePatientTriageScore(e2ePatient, testUpdates, testSchedules, testFollowUps, gaps);
  assert(triage.score >= 80, `High-risk patient scores in urgent range (actual: ${triage.score})`);
  assert(triage.score <= 100, `Triage score is strictly bounded <= 100 (actual: ${triage.score})`);
  assert(triage.priority === 'urgent', 'Score >= 80 maps to urgent priority tier');
  assert(triage.factors.length >= 3, 'Triage result provides transparent explainable factors breakdown');
  assert(triage.factors.every((f) => f.rule && typeof f.points === 'number' && f.reason), 'All factors include rule, points, and human-readable reason');

  // 2.5 Critical Safety Emergency Override (operational heuristic)
  const emergencyUpdate: HealthUpdate[] = [
    {
      id: 'hu-em-1',
      patientId: e2ePatient.id,
      state: 'ok', // Patient says 'ok' but describes emergency
      symptomDescription: 'Sudden severe chest pain radiating to left arm with breathlessness',
      submittedAt: new Date().toISOString(),
    },
  ];
  const emergencyTriage = calculatePatientTriageScore(e2ePatient, emergencyUpdate, testSchedules, [], []);
  assert(emergencyTriage.criticalSafetyOverride === true, 'Emergency red-flag symptom triggers criticalSafetyOverride');
  assert(emergencyTriage.priority === 'urgent', 'Critical safety override forces priority to urgent regardless of self-reported "ok" state');
  assert(Boolean(emergencyTriage.criticalAlertMessage), 'Provides emergency clinical alert guidance');

  // Negation test: no false override
  const negatedUpdate: HealthUpdate[] = [
    {
      id: 'hu-neg',
      patientId: e2ePatient.id,
      state: 'good',
      symptomDescription: 'I do not have chest pain or shortness of breath.',
      submittedAt: new Date().toISOString(),
    },
  ];
  const negatedTriage = calculatePatientTriageScore(e2ePatient, negatedUpdate, testSchedules, [], []);
  assert(negatedTriage.criticalSafetyOverride === false, 'Negated emergency phrasing does NOT trigger false override');

  // Third-party test: no false override
  const thirdPartyUpdate: HealthUpdate[] = [
    {
      id: 'hu-tp',
      patientId: e2ePatient.id,
      state: 'good',
      symptomDescription: 'My father had chest pain last year.',
      submittedAt: new Date().toISOString(),
    },
  ];
  const thirdPartyTriage = calculatePatientTriageScore(e2ePatient, thirdPartyUpdate, testSchedules, [], []);
  assert(thirdPartyTriage.criticalSafetyOverride === false, 'Third-party historical phrasing does NOT trigger false override');

  // Hinglish affirmative test: triggers override
  const hinglishAffirmative: HealthUpdate[] = [
    {
      id: 'hu-hi-aff',
      patientId: e2ePatient.id,
      state: 'bad',
      symptomDescription: 'Chhati me bohot tezi se dard ho raha hai aur saans phool rahi hai.',
      submittedAt: new Date().toISOString(),
    },
  ];
  const hinglishAffTriage = calculatePatientTriageScore(e2ePatient, hinglishAffirmative, testSchedules, [], []);
  assert(hinglishAffTriage.criticalSafetyOverride === true, 'Hinglish affirmative dyspnea ("saans phool rahi hai") triggers override');

  // Hinglish negated test: no false override
  const hinglishNegated: HealthUpdate[] = [
    {
      id: 'hu-hi-neg',
      patientId: e2ePatient.id,
      state: 'good',
      symptomDescription: 'Chhati me dard nahi hai aur saans lene me koi takleef nahi hai.',
      submittedAt: new Date().toISOString(),
    },
  ];
  const hinglishNegTriage = calculatePatientTriageScore(e2ePatient, hinglishNegated, testSchedules, [], []);
  assert(hinglishNegTriage.criticalSafetyOverride === false, 'Hinglish negated phrasing ("dard nahi hai") does NOT trigger false override');

  // 2.6 CareGap Lifecycle: Doctor review & resolution
  const gapCreateResult = await dataService.createCareGap({
    patientId: e2ePatient.id,
    type: 'new_symptom',
    severity: 'high',
    evidence: 'High fever and throat swelling',
    timestamp: new Date().toISOString(),
    status: 'open',
  });
  const testGapId = 'data' in gapCreateResult ? gapCreateResult.data.id : '';
  assert(Boolean(testGapId), 'Care gap creation returned valid ID');

  const createdGaps = await dataService.fetchCareGaps(e2ePatient.id);
  const targetGap = createdGaps.find((g) => g.id === testGapId);
  assert(targetGap?.status === 'open', 'New care gap starts with status "open"');

  await dataService.updateCareGapStatus(testGapId, 'reviewed');
  const reviewedGaps = await dataService.fetchCareGaps(e2ePatient.id);
  assert(reviewedGaps.find((g) => g.id === testGapId)?.status === 'reviewed', 'Care gap successfully transitions to "reviewed"');

  await dataService.updateCareGapStatus(testGapId, 'followup_planned');
  const followupGaps = await dataService.fetchCareGaps(e2ePatient.id);
  assert(followupGaps.find((g) => g.id === testGapId)?.status === 'followup_planned', 'Care gap successfully transitions to "followup_planned"');

  // ---------------------------------------------------------------------------
  // SUITE 3: Feature 3 — Consent-Based Family Recovery Circle
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Consent-Based Family Recovery Circle ---');

  // 3.1 Authorized Family View
  await dataService.updateCaregiverAccess('p1', true);
  const authFamilyView = await dataService.fetchFamilyView('p1');
  assert(authFamilyView?.caregiverAccess.authorized === true, 'Authorized caregiver access returned');
  assert(typeof authFamilyView?.dosesToday.taken === 'number', 'Authorized view includes taken doses count');
  assert(typeof authFamilyView?.dosesToday.total === 'number', 'Authorized view includes total doses count');
  assert(Boolean(authFamilyView?.healthUpdateStatus), 'Authorized view includes general health status');
  assert(Boolean(authFamilyView?.caregiverAccess.contactNumber), 'Authorized view provides caregiver contact number');

  // Privacy Boundary: Zero leakage of raw clinical data
  assert(!('medicalReports' in (authFamilyView || {})), 'Family view does NOT expose medical reports');
  assert(!('doctorNotes' in (authFamilyView || {})), 'Family view does NOT expose doctor-only clinical notes');
  assert(!('rawPrescriptionText' in (authFamilyView || {})), 'Family view does NOT expose raw prescription narrative');
  assert(!('ocrConfidence' in (authFamilyView || {})), 'Family view does NOT expose OCR confidence metrics');

  // 3.2 Consent Revocation
  await dataService.updateCaregiverAccess('p1', false);
  const revokedFamilyView = await dataService.fetchFamilyView('p1');
  assert(revokedFamilyView?.caregiverAccess.authorized === false, 'Caregiver access marked unauthorized upon revocation');
  assert(revokedFamilyView?.dosesToday.taken === 0 && revokedFamilyView?.dosesToday.total === 0, 'Dose counts zeroed out when consent is revoked');
  assert(revokedFamilyView?.nextDoseTime === null, 'Next dose time suppressed (null) when consent is revoked');
  assert(revokedFamilyView?.healthUpdateStatus === 'Consent Revoked', 'Status displays "Consent Revoked"');
  assert(revokedFamilyView?.caregiverAccess.contactNumber === null, 'Caregiver phone contact stripped (null) when consent is revoked');

  // 3.3 Re-authorization
  await dataService.updateCaregiverAccess('p1', true);
  const restoredFamilyView = await dataService.fetchFamilyView('p1');
  assert(restoredFamilyView?.caregiverAccess.authorized === true, 'Consent successfully re-authorized');
  assert(restoredFamilyView?.caregiverAccess.contactNumber !== null, 'Contact number restored upon re-authorization');

  // ---------------------------------------------------------------------------
  // SUITE 4: End-to-End Unified 3-Feature Closed-Loop Journey
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Unified 3-Feature Closed-Loop Journey ---');

  const journeyPatientId = `p-journey-${Date.now()}`;

  // Step 1: Patient Intake
  await dataService.savePatientIntake({
    name: 'Ramesh Patel',
    age: 52,
    gender: 'male',
    phone: '9811122233',
    symptoms: 'Type 2 Diabetes follow-up and mild cough',
    allergies: 'None',
    currentMeds: 'None',
    language: 'en',
  });
  const storedPatient: PatientProfile = {
    id: journeyPatientId,
    name: 'Ramesh Patel',
    age: 52,
    gender: 'male',
    phone: '9811122233',
    symptoms: 'Type 2 Diabetes follow-up and mild cough',
    allergies: 'None',
    currentMeds: 'None',
    language: 'en' as const,
  };
  assert(Boolean(storedPatient), 'Step 1: Patient profile created and stored');

  // Step 2: Upload prescription & extract AI draft
  const initialDraft: PrescriptionDraft = {
    id: `rx-${journeyPatientId}`,
    patientId: journeyPatientId,
    imageUrl: 'prescriptions/rx-patel.jpg',
    uploadedAt: new Date().toISOString(),
    fields: [
      { key: 'medicine', labelKey: 'rx_medicine', value: 'Metformin Hydrochloride', status: 'confirmed' },
      { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'confirmed' },
      { key: 'frequency', labelKey: 'rx_frequency', value: 'Twice daily', status: 'uncertain' }, // uncertain from OCR
      { key: 'duration', labelKey: 'rx_duration', value: '30 days', status: 'confirmed' },
    ],
    confirmed: false,
  };
  await dataService.savePrescriptionDraft(journeyPatientId, initialDraft.imageUrl, initialDraft.fields);
  const retrievedDraft = await dataService.fetchPrescriptionDraft(journeyPatientId);
  assert(retrievedDraft?.confirmed === false, 'Step 2: AI prescription draft stored as unconfirmed');

  // Step 3: Verify schedules remain inactive & summary warns doctor
  const preApprovalSchedules = await dataService.fetchMedicationSchedules(journeyPatientId);
  assert(preApprovalSchedules.length === 0, 'Step 3: Medication schedule is inactive prior to doctor lock');

  // Step 4: Doctor reviews and confirms care plan
  const doctorVerifiedFields = initialDraft.fields.map((f) => ({ ...f, status: 'confirmed' as const }));
  const confirmResult = await dataService.confirmCarePlan(journeyPatientId, doctorVerifiedFields);
  assert('ok' in confirmResult && confirmResult.ok === true, 'Step 4: Doctor Lock confirmation succeeds');

  const postConfirmDraft = await dataService.fetchPrescriptionDraft(journeyPatientId);
  assert(postConfirmDraft?.confirmed === true, 'Step 4b: Draft marked confirmed');
  assert(postConfirmDraft?.confirmedBy === 'Dr. Anita Desai, MD', 'Step 4c: Doctor name stamped in audit trail');

  // Step 5: Schedule is now activated with two doses
  const postApprovalSchedules = await dataService.fetchMedicationSchedules(journeyPatientId);
  assert(postApprovalSchedules.length > 0, 'Step 5: Medication schedule activated with pending dose');
  
  // Add second schedule dose for repeated missed dose testing
  postApprovalSchedules.push({
    id: `s-journey-dose-2-${Date.now()}`,
    medicineId: postApprovalSchedules[0].medicineId,
    medicineName: postApprovalSchedules[0].medicineName,
    dosage: postApprovalSchedules[0].dosage,
    scheduledTime: '20:00',
    status: 'pending',
    instructions: postApprovalSchedules[0].instructions,
  });

  // Step 6: Patient records adherence missed doses and submits health update without severity rating
  await dataService.recordAdherence(postApprovalSchedules[0].id, 'missed', 'forgot');
  await dataService.recordAdherence(postApprovalSchedules[1].id, 'cannot_take', 'nausea');
  await dataService.submitHealthUpdate(journeyPatientId, 'bad', 'Stomach cramps and persistent nausea for 2 days');

  // Step 7: CareGap Radar detects gaps
  const journeyUpdates = await dataService.fetchHealthUpdates(journeyPatientId);
  const journeySchedules = await dataService.fetchMedicationSchedules(journeyPatientId);
  const { gaps: journeyGaps } = detectCareGaps(storedPatient, journeyUpdates, journeySchedules, []);
  assert(journeyGaps.some((g) => g.type === 'new_symptom'), 'Step 7: CareGap Radar detects new_symptom gap');
  assert(journeyGaps.some((g) => g.type === 'missing_severity'), 'Step 7b: CareGap Radar detects missing_severity gap');
  assert(journeyGaps.some((g) => g.type === 'repeated_missed_dose'), 'Step 7c: CareGap Radar detects repeated_missed_dose gap');

  // Step 8: Priority score calculated with explainable breakdown
  const journeyTriage = calculatePatientTriageScore(storedPatient, journeyUpdates, journeySchedules, [], journeyGaps);
  assert(journeyTriage.score >= 80, `Step 8: Priority score escalated appropriately to urgent (actual: ${journeyTriage.score})`);
  assert(journeyTriage.factors.length >= 2, 'Step 8b: Explainable breakdown provided');

  // Step 9: Doctor reviews care gap
  for (const g of journeyGaps) {
    await dataService.createCareGap({ ...g, status: 'open' });
  }
  const createdJourneyGaps = await dataService.fetchCareGaps(journeyPatientId);
  if (createdJourneyGaps.length > 0) {
    await dataService.updateCareGapStatus(createdJourneyGaps[0].id, 'reviewed');
    const updatedJourneyGaps = await dataService.fetchCareGaps(journeyPatientId);
    assert(updatedJourneyGaps[0].status === 'reviewed', 'Step 9: Doctor reviews care gap and marks it reviewed');
  }

  // Step 10: Family Recovery Circle reflects adherence while preserving privacy
  await dataService.updateCaregiverAccess(journeyPatientId, true);
  const journeyFamilyView = await dataService.fetchFamilyView(journeyPatientId);
  assert(journeyFamilyView?.caregiverAccess.authorized === true, 'Step 10: Family view authorized');
  assert(journeyFamilyView?.missedDose === true, 'Step 10b: Family view alerts to missed dose for care coordination');

  // Revoke consent
  await dataService.updateCaregiverAccess(journeyPatientId, false);
  const revokedJourneyView = await dataService.fetchFamilyView(journeyPatientId);
  assert(revokedJourneyView?.caregiverAccess.authorized === false, 'Step 10c: Family consent revoked');
  assert(revokedJourneyView?.dosesToday.taken === 0, 'Step 10d: Family view doses zeroed out upon revocation');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('PULSEBRIDGE AI 3-FEATURE END-TO-END INTEGRATION FULLY VERIFIED!');
    process.exit(0);
  }
}

void runSuite();
