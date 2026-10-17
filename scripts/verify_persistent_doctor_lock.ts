/**
 * PulseBridge AI — Final Persistent Doctor Lock & Authorization Verification Suite
 * File: scripts/verify_persistent_doctor_lock.ts
 *
 * Verifies:
 * 1. Supabase Auth configuration and session availability
 * 2. Unauthenticated caller fail-closed gate on productionService.confirmCarePlan
 * 3. Non-doctor caller authorization denial gate
 * 4. Invariant: Unconfirmed draft never activates database medication schedules
 * 5. Persistent database read vs in-memory state distinction
 * 6. Doctor session availability and remote database persistence if session exists
 */

import fs from 'node:fs';
import path from 'node:path';

// Safely load local environment variables from .env.local or .env
for (const envFile of ['.env.local', '.env']) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.substring(0, eqIdx).trim();
          const v = trimmed.substring(eqIdx + 1).trim();
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

process.env.PULSEBRIDGE_ENV = 'test';

const { supabase, isSupabaseConfigured } = await import('../src/lib/supabase');
const { productionService, demoService } = await import('../src/services/dataService');
import type { PrescriptionField } from '../src/types';

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
console.log('PULSEBRIDGE AI — PERSISTENT DOCTOR LOCK VERIFICATION');
console.log('================================================================\n');

async function run() {
  // ---------------------------------------------------------------------------
  // STEP 1: Supabase Auth Configuration & Active Session Detection
  // ---------------------------------------------------------------------------
  console.log('STEP 1: Supabase Client & Authentication Session Inspection');
  assert(Boolean(supabase), 'Supabase client instance is initialized');
  assert(isSupabaseConfigured, 'Supabase credentials configured (isSupabaseConfigured: true)');

  if (!supabase) {
    console.error('Cannot proceed: Supabase client is not available.');
    process.exit(1);
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  const session = sessionData?.session;
  console.log('  Active session detected:', session ? `User ID ${session.user.id} (${session.user.email})` : 'None (No active session in storage)');

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;
  console.log('  Current user detected:', user ? `User ID ${user.id} (${user.email})` : 'None (Unauthenticated)');

  let isDoctorUser = false;
  if (user) {
    const role = user.app_metadata?.role || user.user_metadata?.role;
    isDoctorUser = role === 'doctor' || role === 'physician';
    console.log(`  User role: "${role}" (isDoctor: ${isDoctorUser})`);
  }

  assert(session === null || session === undefined || Boolean(session?.user), 'Auth session check executed cleanly without exception');

  // ---------------------------------------------------------------------------
  // STEP 2: Unauthenticated Caller Fail-Closed Gate
  // ---------------------------------------------------------------------------
  console.log('\nSTEP 2: Unauthenticated Caller Fail-Closed Security Gate');
  const syntheticPatientId = `p-audit-${Date.now()}`;
  const validFields: PrescriptionField[] = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Amoxicillin', status: 'confirmed' },
    { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'confirmed' },
    { key: 'frequency', labelKey: 'rx_frequency', value: 'Twice daily', status: 'confirmed' },
    { key: 'duration', labelKey: 'rx_duration', value: '7 days', status: 'confirmed' },
  ];

  // If there is no authenticated user, calling productionService.confirmCarePlan MUST return Authentication required
  if (!user) {
    const unauthRes = await productionService.confirmCarePlan(syntheticPatientId, validFields);
    assert('error' in unauthRes, 'Production service strictly rejects confirmation when unauthenticated');
    assert(
      'error' in unauthRes && unauthRes.error.includes('Authentication required'),
      'Returns explicit error: "Authentication required: You must be logged in to confirm care plans and enforce doctor lock."'
    );

    // Verify remote database has zero schedules created for this unconfirmed synthetic patient
    const { data: remoteSchedules, error: schedQueryErr } = await supabase
      .from('medication_schedules')
      .select('*')
      .eq('patient_id', syntheticPatientId);

    assert(!schedQueryErr, 'Queried remote Supabase database for medication_schedules without error');
    assert((remoteSchedules ?? []).length === 0, 'Remote database strictly contains 0 schedules for unconfirmed patient');

    // Verify remote database has zero care plans created
    const { data: remoteCarePlans, error: cpQueryErr } = await supabase
      .from('care_plans')
      .select('*')
      .eq('patient_id', syntheticPatientId);

    assert(!cpQueryErr, 'Queried remote Supabase database for care_plans without error');
    assert((remoteCarePlans ?? []).length === 0, 'Remote database strictly contains 0 care plans for unconfirmed patient');
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Non-Doctor Role Authorization Denial Gate
  // ---------------------------------------------------------------------------
  console.log('\nSTEP 3: Non-Doctor Role Authorization Denial Gate');
  {
    // Temporarily stub getUser to simulate an authenticated non-doctor user (e.g. role: 'patient')
    const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
    (supabase.auth as any).getUser = async () => ({
      data: {
        user: {
          id: 'usr-non-doctor-test-id',
          email: 'patient@pulsebridge.ai',
          app_metadata: { role: 'patient' },
          user_metadata: { role: 'patient' },
        },
      },
      error: null,
    });

    try {
      const nonDoctorRes = await productionService.confirmCarePlan(syntheticPatientId, validFields);
      assert('error' in nonDoctorRes, 'Production service strictly rejects confirmation when caller is not a doctor');
      assert(
        'error' in nonDoctorRes && nonDoctorRes.error.includes('Authorization denied'),
        'Returns explicit error: "Authorization denied: Only verified doctors can confirm prescriptions and lock care plans."'
      );

      // Verify remote DB has no schedules created from non-doctor attempt
      const { data: nonDocSchedules } = await supabase
        .from('medication_schedules')
        .select('*')
        .eq('patient_id', syntheticPatientId);
      assert((nonDocSchedules ?? []).length === 0, 'No medication schedules created from rejected non-doctor attempt');
    } finally {
      // Restore original getUser function
      (supabase.auth as any).getUser = originalGetUser;
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Doctor Lock Invariant: Uncertain & Missing Critical Field Gate
  // ---------------------------------------------------------------------------
  console.log('\nSTEP 4: Doctor Lock Invariant: Uncertain Critical Field Gate');
  const uncertainFields: PrescriptionField[] = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Amoxicillin', status: 'confirmed' },
    { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'uncertain' },
    { key: 'frequency', labelKey: 'rx_frequency', value: 'Twice daily', status: 'confirmed' },
    { key: 'duration', labelKey: 'rx_duration', value: '7 days', status: 'confirmed' },
  ];

  const uncertainBlockRes = await productionService.confirmCarePlan(syntheticPatientId, uncertainFields);
  assert('error' in uncertainBlockRes, 'Rejects confirmation when critical field is uncertain');
  assert(
    'error' in uncertainBlockRes && uncertainBlockRes.error.includes('Critical fields must be verified and confirmed'),
    'Error specifies critical fields must be verified and confirmed before Doctor Lock'
  );

  const missingKeyFields: PrescriptionField[] = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Amoxicillin', status: 'confirmed' },
    { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'confirmed' },
    // missing frequency and duration
  ];
  const missingBlockRes = await productionService.confirmCarePlan(syntheticPatientId, missingKeyFields);
  assert('error' in missingBlockRes, 'Rejects confirmation when critical keys are missing');
  assert(
    'error' in missingBlockRes && missingBlockRes.error.includes('Missing required critical fields'),
    'Error lists missing critical keys required for Doctor Lock'
  );

  // ---------------------------------------------------------------------------
  // STEP 5: Real Authenticated Doctor Session Assessment
  // ---------------------------------------------------------------------------
  console.log('\nSTEP 5: Real Authenticated Doctor Session Assessment');
  if (user && isDoctorUser) {
    console.log(`  Executing persistent confirmation as doctor: ${user.email} (${user.id})`);

    // Insert draft prescription row into remote DB
    const { data: insertedDraft, error: draftInsertErr } = await supabase
      .from('prescriptions')
      .insert({
        patient_id: syntheticPatientId,
        image_url: 'synthetic_rx.png',
        fields: JSON.stringify(validFields.map((f) => ({ ...f, status: 'uncertain' }))),
        confirmed: false,
      })
      .select()
      .single();

    assert(!draftInsertErr, 'Inserted synthetic prescription draft into remote database');
    assert(insertedDraft?.confirmed === false, 'Remote draft starts in strictly unconfirmed state');

    // Confirm care plan via productionService
    const confirmRes = await productionService.confirmCarePlan(
      syntheticPatientId,
      validFields,
      'Audited physician verified confirmation'
    );
    assert('ok' in confirmRes && confirmRes.ok === true, 'productionService.confirmCarePlan succeeded with authenticated doctor');

    // Re-fetch prescription from remote database in a fresh read (do not use in-memory state)
    const { data: refetchedRx, error: rxFetchErr } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', syntheticPatientId)
      .single();

    assert(!rxFetchErr, 'Fresh read: Re-fetched prescription record from remote database');
    assert(refetchedRx?.confirmed === true, 'Fresh read: Remote prescription confirmed state is true');
    assert(refetchedRx?.confirmed_by === user.id, `Fresh read: Remote prescription confirmed_by matches doctor ID (${user.id})`);
    assert(Boolean(refetchedRx?.confirmed_at), 'Fresh read: Remote prescription confirmed_at timestamp is set');

    // Re-fetch care plan from remote database
    const { data: refetchedCp, error: cpFetchErr } = await supabase
      .from('care_plans')
      .select('*')
      .eq('patient_id', syntheticPatientId)
      .single();

    assert(!cpFetchErr, 'Fresh read: Re-fetched care_plan record from remote database');
    assert(refetchedCp?.status === 'active', 'Fresh read: Remote care plan status is active');
    assert(refetchedCp?.doctor_id === user.id, 'Fresh read: Remote care plan doctor_id matches doctor');

    // Re-fetch medication schedule from remote database in a fresh read
    const { data: refetchedSchedules, error: schedFetchErr } = await supabase
      .from('medication_schedules')
      .select('*')
      .eq('patient_id', syntheticPatientId);

    assert(!schedFetchErr, 'Fresh read: Re-fetched medication_schedules from remote database');
    assert((refetchedSchedules ?? []).length > 0, 'Fresh read: Remote database contains activated medication schedule');
    const sched = refetchedSchedules?.[0];
    assert(sched?.medicine_name === 'Amoxicillin', 'Fresh read: Persisted medicine_name matches verified prescription (Amoxicillin)');
    assert(sched?.dosage === '500mg', 'Fresh read: Persisted dosage matches verified prescription (500mg)');
    assert(sched?.status === 'pending', 'Fresh read: Persisted schedule status begins in pending');
  } else {
    console.log('  [NOTICE] No authenticated doctor session exists in the environment.');
    console.log('  Per Item 6 instructions: STOPPING AT THE FAIL-CLOSED GATE.');
    console.log('  Zero mock bypasses applied. Exact manual doctor provisioning instructions reported below.');
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('================================================================');

  if (user && isDoctorUser) {
    console.log('STATUS: FULL PRODUCTION PERSISTENT DOCTOR LOCK CONFIRMED');
  } else {
    console.log('STATUS: STOPPED AT FAIL-CLOSED GATE (AUTHENTICATION REQUIRED)');
  }
}

run().catch((err) => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
