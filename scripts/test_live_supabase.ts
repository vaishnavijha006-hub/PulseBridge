import { dataService } from '../src/services/dataService';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { detectCareGaps, calculatePatientTriageScore } from '../src/services/careGapRules';
import assert from 'node:assert';

async function main() {
  console.log('=== PulseBridge AI — Live Supabase Integration Test ===\n');

  if (!isSupabaseConfigured || !supabase) {
    console.error('FAIL: Supabase client is not configured.');
    process.exit(1);
  }

  console.log('Mode:', dataService.mode);

  // 1. Check patients table and seed data
  console.log('\n[1/10] Testing Patients Query...');
  const patients = await dataService.fetchPatients();
  console.log(`Fetched ${patients.length} patients from Supabase.`);
  assert(patients.length > 0, 'Seed patients must exist');

  // 2. Create a test patient (savePatientIntake)
  console.log('\n[2/10] Testing Patient Intake Creation...');
  const testPatientData = {
    name: 'Hackathon Test Patient',
    age: 45,
    gender: 'female' as const,
    phone: '9998887770',
    symptoms: 'Post-op mild soreness',
    allergies: 'None',
    currentMeds: 'Paracetamol',
    language: 'hi' as const,
  };
  const intakeRes = await dataService.savePatientIntake(testPatientData);
  assert('data' in intakeRes, 'Patient intake must succeed');
  const testPatientId = intakeRes.data.id;
  console.log(`Created test patient ID: ${testPatientId}`);

  try {
    // 3. Save unverified prescription draft
    console.log('\n[3/10] Testing Prescription Draft Storage...');
    const draftFields = [
      { key: 'medicine', labelKey: 'rx_medicine', value: 'Amoxicillin', status: 'confirmed' as const },
      { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'confirmed' as const },
      { key: 'frequency', labelKey: 'rx_frequency', value: 'Thrice daily', status: 'uncertain' as const },
      { key: 'duration', labelKey: 'rx_duration', value: '', status: 'uncertain' as const },
      { key: 'instructions', labelKey: 'rx_instructions', value: 'After meals', status: 'confirmed' as const },
    ];
    const draftRes = await dataService.savePrescriptionDraft(
      testPatientId,
      'https://example.com/prescription.jpg',
      draftFields
    );
    assert('data' in draftRes, 'Prescription draft should be saved');
    assert(draftRes.data.confirmed === false, 'Draft must remain unconfirmed');
    console.log(`Prescription draft created with ID: ${draftRes.data.id} (confirmed: false)`);

    // 4. Critical missing/uncertain fields block care plan confirmation
    console.log('\n[4/10] Testing Critical Field Validation...');
    const invalidConfirmation = await dataService.confirmCarePlan(testPatientId, draftFields);
    assert('error' in invalidConfirmation, 'Confirmation must be blocked when duration is empty');
    console.log(`Correctly blocked: ${invalidConfirmation.error}`);

    // 5. Doctor verifies and confirms care plan
    console.log('\n[5/10] Testing Doctor Confirmation & Schedule Activation...');
    const verifiedFields = draftFields.map((f) => ({
      ...f,
      value: f.key === 'duration' ? '7 days' : f.value,
      status: 'confirmed' as const,
    }));
    const confirmRes = await dataService.confirmCarePlan(testPatientId, verifiedFields, 'Verified by Dr. Test');
    assert('ok' in confirmRes && confirmRes.ok === true, 'Confirmation must succeed with verified fields');
    console.log('Doctor care plan confirmed successfully.');

    // 6. Medication schedules appear for the patient
    console.log('\n[6/10] Verifying Generated Medication Schedules...');
    const schedules = await dataService.fetchMedicationSchedules(testPatientId);
    assert(schedules.length > 0, 'Medication schedule must be generated from confirmed care plan');
    const schedule = schedules[0];
    console.log(`Generated schedule: ${schedule.medicineName} (${schedule.dosage}) at ${schedule.scheduledTime}`);

    // 7. Record Adherence (taken, cannot_take, snoozed)
    console.log('\n[7/10] Testing Adherence Logging...');
    const adhRes1 = await dataService.recordAdherence(schedule.id, 'taken');
    assert('ok' in adhRes1, 'Adherence taken must succeed');

    const adhRes2 = await dataService.recordAdherence(
      schedule.id,
      'cannot_take',
      'Side effect - Nausea',
      'Patient reported dizziness'
    );
    assert('ok' in adhRes2, 'Adherence cannot_take must succeed');

    const logs = await dataService.fetchAdherenceLogs(testPatientId);
    console.log(`Fetched ${logs.length} adherence logs for patient.`);
    assert(logs.length >= 2, 'Adherence logs must persist in database');

    // 8. Health updates & CareGap creation
    console.log('\n[8/10] Testing Health Updates & CareGap Detection...');
    const updateRes = await dataService.submitHealthUpdate(
      testPatientId,
      'bad',
      'Throat irritation and mild fever',
      'patient'
    );
    assert('data' in updateRes, 'Health update must succeed');

    const gapRes = await dataService.createCareGap({
      patientId: testPatientId,
      type: 'missing_severity',
      evidence: 'Throat irritation reported without pain score',
      missingInfo: 'Pain scale (1-10)',
      followupQuestion: 'Dard kitna hai 1 se 10 mein?',
      status: 'open',
    });
    assert('data' in gapRes, 'CareGap creation must succeed');

    const reviewRes = await dataService.updateCareGapStatus(gapRes.data.id, 'reviewed');
    assert('ok' in reviewRes, 'Doctor review of CareGap must succeed');
    console.log('CareGap created and reviewed successfully in database.');

    // 9. Family Recovery Circle & Consent Enforcement
    console.log('\n[9/10] Testing Family Recovery Circle & Privacy Redaction...');
    // Create consent record
    await supabase.from('caregiver_consent').insert({
      patient_id: testPatientId,
      caregiver_name: 'Rahul (Son)',
      relationship: 'Son',
      contact_number: '9876543210',
      authorized: true,
    });

    const authorizedView = await dataService.fetchFamilyView(testPatientId);
    assert(authorizedView, 'Authorized family view must be returned');
    assert(authorizedView.caregiverAccess.authorized === true, 'Consent must be active');
    console.log(`Authorized View: ${authorizedView.dosesToday.taken}/${authorizedView.dosesToday.total} doses, Status: ${authorizedView.healthUpdateStatus}`);

    // Revoke consent
    await dataService.updateCaregiverAccess(testPatientId, false);
    const revokedView = await dataService.fetchFamilyView(testPatientId);
    assert(revokedView, 'Revoked view must return');
    assert(revokedView.caregiverAccess.authorized === false, 'Authorized must be false');
    assert(revokedView.dosesToday.taken === 0 && revokedView.dosesToday.total === 0, 'Doses must be redacted to 0');
    assert(revokedView.caregiverAccess.contactNumber === null, 'Contact number must be redacted');
    console.log('Revoked consent strictly redacted all sensitive metrics.');

    // 10. Doctor Patient Summaries
    console.log('\n[10/10] Testing Doctor Patient Summaries...');
    const summaries = await dataService.fetchPatientSummaries();
    assert(summaries.length > 0, 'Doctor summaries must be computed from live tables');
    const targetSummary = summaries.find((s) => s.patient.id === testPatientId);
    assert(targetSummary, 'Created patient must be in summaries');
    console.log(`Summary computed: Score ${targetSummary.triageScore}, Priority: ${targetSummary.priority}`);

    console.log('\n✅ ALL 10 PRODUCTION DATABASE INTEGRATION CHECKS PASSED!');
  } finally {
    // Cleanup test record
    console.log('\nCleaning up test patient record...');
    await supabase.from('patients').delete().eq('id', testPatientId);
    console.log('Cleanup completed.');
  }
}

main().catch((err) => {
  console.error('\n❌ Production integration test failed:', err);
  process.exit(1);
});
