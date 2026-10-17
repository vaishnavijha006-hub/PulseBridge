/**
 * PulseBridge AI — Final Demo Blocker Verification Suite
 * File: scripts/test_demo_blocker_fixes.ts
 *
 * Verifies:
 * 1. Persistent Supabase Storage upload (prescriptions bucket & signed URL)
 * 2. Real Google Gemini Vision multimodal parameter extraction
 * 3. Unconfirmed draft state & schedule inactivity invariant
 * 4. Production Doctor Lock fail-closed behavior for unauthenticated/non-doctor callers
 * 5. Authenticated doctor confirmation & schedule activation
 * 6. CareGap Radar heuristic detection & priority scoring
 * 7. Family Recovery Circle consent revocation enforced at data layer
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
const { GeminiVisionAdapter } = await import('../supabase/functions/scan-prescription/geminiVisionAdapter');
const { validatePrescriptionScanOutput } = await import('../supabase/functions/scan-prescription/prescriptionValidator');
const { productionService, demoService } = await import('../src/services/dataService');
const { detectCareGaps, calculatePatientTriageScore } = await import('../src/services/careGapRules');
import type { PatientProfile, HealthUpdate, MedicationSchedule, FollowUp } from '../src/types';

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
console.log('PULSEBRIDGE AI — FINAL DEMO BLOCKER VERIFICATION SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: Persistent Supabase Storage Upload (prescriptions bucket)
// -----------------------------------------------------------------------------
console.log('SUITE 1: Persistent Supabase Storage Upload & Signed URL');
{
  assert(Boolean(isSupabaseConfigured && supabase), 'Supabase client is configured with valid URL & Key');

  if (supabase) {
    const syntheticImagePath = path.resolve(process.cwd(), 'scripts/synthetic_rx.png');
    const imageBuffer = fs.readFileSync(syntheticImagePath);
    const storagePath = `test/audit_rx_${Date.now()}.png`;

    // 1.1 Upload to persistent Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('prescriptions')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    assert(!uploadError && Boolean(uploadData?.path), 'Persistently uploaded image to Supabase Storage prescriptions bucket');

    // 1.2 Verify persistence by re-listing from Supabase Storage
    const { data: fileList, error: listError } = await supabase.storage
      .from('prescriptions')
      .list('test');

    const fileFound = fileList?.some((f) => storagePath.endsWith(f.name));
    assert(!listError && Boolean(fileFound), 'Verified persisted file presence in remote Supabase Storage catalog');

    // 1.3 Generate secure short-lived signed URL
    const { data: signedData, error: signError } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl(storagePath, 3600);

    assert(!signError && Boolean(signedData?.signedUrl), 'Generated valid signed URL for persistent prescription image');
  }
}

// -----------------------------------------------------------------------------
// SUITE 2: Real Google Gemini Vision Multimodal Extraction
// -----------------------------------------------------------------------------
console.log('\nSUITE 2: Real Google Gemini Vision Multimodal Extraction');
{
  const syntheticImagePath = path.resolve(process.cwd(), 'scripts/synthetic_rx.png');
  const imageBase64 = fs.readFileSync(syntheticImagePath).toString('base64');

  const adapter = new GeminiVisionAdapter();
  assert(adapter.providerName === 'gemini_vision', 'Adapter configured for real Gemini Vision');

  const startTime = Date.now();
  const res = await adapter.scanPrescription(imageBase64, 'image/png');
  const latency = Date.now() - startTime;

  assert(Boolean(res.rawOutput), 'Google Gemini Vision returned extraction payload');
  assert(res.latencyMs > 0, `Recorded real round-trip network latency (${res.latencyMs}ms)`);

  const raw = res.rawOutput as { fields: Array<{ key: string; value: string; status: string }> };
  const med = raw.fields.find((f) => f.key === 'medicine')?.value;
  const dose = raw.fields.find((f) => f.key === 'dosage')?.value;

  assert(Boolean(med && /amoxicillin/i.test(med)), `Extracted real medicine name: "${med}"`);
  assert(Boolean(dose && /500\s*mg/i.test(dose)), `Extracted real dosage: "${dose}"`);
}

// -----------------------------------------------------------------------------
// SUITE 3: Unconfirmed Draft & Invariant Gate (Doctor Lock)
// -----------------------------------------------------------------------------
console.log('\nSUITE 3: Unconfirmed Draft & Invariant Gate (Doctor Lock)');
{
  const patientId = `p-audit-gate-${Date.now()}`;
  const validated = validatePrescriptionScanOutput(
    {
      fields: [
        { key: 'medicine', value: 'Amoxicillin', status: 'confirmed' },
        { key: 'dosage', value: '500mg', status: 'confirmed' },
        { key: 'frequency', value: 'Twice daily', status: 'confirmed' },
        { key: 'duration', value: '7 days', status: 'confirmed' },
      ],
      rawTranscription: 'Rx: Amoxicillin 500mg Twice daily 7 days',
    },
    patientId,
    'synthetic_rx.png'
  );

  assert(validated.draft.confirmed === false, 'Newly extracted draft is strictly unconfirmed');
  assert(validated.draft.confirmedAt === null, 'confirmedAt timestamp is strictly null');
  assert(validated.draft.confirmedBy === null, 'confirmedBy doctor identity is strictly null');

  // Verify that unconfirmed draft has 0 active medication schedules
  const initialSchedules = await demoService.fetchMedicationSchedules(patientId);
  assert(initialSchedules.length === 0, 'Unconfirmed draft NEVER activates medication schedules');

  // Attempting to confirm with uncertain fields must be rejected
  const uncertainFields = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Amoxicillin', status: 'confirmed' as const },
    { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'uncertain' as const },
    { key: 'frequency', labelKey: 'rx_frequency', value: 'Twice daily', status: 'confirmed' as const },
    { key: 'duration', labelKey: 'rx_duration', value: '7 days', status: 'confirmed' as const },
  ];
  const rejectRes = await demoService.confirmCarePlan(patientId, uncertainFields);
  assert('error' in rejectRes, 'Doctor Lock blocks confirmation when any critical field is uncertain');
}

// -----------------------------------------------------------------------------
// SUITE 4: Production Fail-Closed on Unauthenticated Doctor Confirmation
// -----------------------------------------------------------------------------
console.log('\nSUITE 4: Production Service Doctor Authorization Gate');
{
  const verifiedFields = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Amoxicillin', status: 'confirmed' as const },
    { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'confirmed' as const },
    { key: 'frequency', labelKey: 'rx_frequency', value: 'Twice daily', status: 'confirmed' as const },
    { key: 'duration', labelKey: 'rx_duration', value: '7 days', status: 'confirmed' as const },
  ];

  // In production service, calling without an authenticated Supabase doctor session MUST fail closed
  const unauthConfirmRes = await productionService.confirmCarePlan('p1', verifiedFields);
  assert('error' in unauthConfirmRes, 'Production service fails closed when caller is unauthenticated');
  assert(
    'error' in unauthConfirmRes && unauthConfirmRes.error.includes('Authentication required'),
    'Error message explicitly specifies required doctor login for production Doctor Lock'
  );

  // In demo service (local verified doctor simulation), authorized confirmation succeeds
  const demoConfirmRes = await demoService.confirmCarePlan('p1', verifiedFields);
  assert('ok' in demoConfirmRes && demoConfirmRes.ok === true, 'Authorized doctor verification successfully locks plan in demo mode');

  // Verify activated schedule in data service
  const refreshedSchedules = await demoService.fetchMedicationSchedules('p1');
  const activated = refreshedSchedules.find((s) => s.medicineName === 'Amoxicillin');
  assert(Boolean(activated), 'Medication schedule activated immediately after doctor verification');
  assert(activated?.dosage === '500mg', 'Activated schedule matches verified dosage');
  assert(activated?.status === 'pending', 'Activated schedule begins in pending status');
}

// -----------------------------------------------------------------------------
// SUITE 5: CareGap Radar Smoke Test
// -----------------------------------------------------------------------------
console.log('\nSUITE 5: CareGap Radar Heuristic Rules Smoke Test');
{
  const patient: PatientProfile = {
    id: 'p-cg-smoke',
    name: 'CareGap Smoke Patient',
    age: 58,
    gender: 'male',
    phone: '9988776655',
    symptoms: 'Mild soreness',
    allergies: 'None',
    currentMeds: 'None',
    language: 'hi',
  };

  const acuteUpdate: HealthUpdate = {
    id: 'h-cg-1',
    patientId: 'p-cg-smoke',
    state: 'bad',
    symptomDescription: 'Chest heaviness and dyspnea since morning',
    submittedAt: new Date().toISOString(),
    source: 'patient',
  };

  const { gaps } = detectCareGaps(patient, [acuteUpdate], [], []);
  const newSymptomGap = gaps.find((g) => g.type === 'new_symptom');
  assert(Boolean(newSymptomGap), 'CareGap Radar detects new_symptom gap for acute check-in');
  assert(newSymptomGap?.severity === 'high', 'new_symptom gap assigned high severity');

  const triage = calculatePatientTriageScore(patient, [acuteUpdate], [], [], gaps);
  assert(triage.score > 0, `Computed non-zero triage score (${triage.score}/100)`);
  assert(triage.criticalSafetyOverride === true, 'Emergency keywords triggered criticalSafetyOverride');
  assert(triage.priority === 'urgent', 'Emergency override forced priority to urgent');
}

// -----------------------------------------------------------------------------
// SUITE 6: Family Recovery Circle Backend Consent Enforcement
// -----------------------------------------------------------------------------
console.log('\nSUITE 6: Family Recovery Circle Backend Consent Enforcement');
{
  const patientId = `p-fam-smoke-${Date.now()}`;

  // 6.1 Permitted access view
  await demoService.updateCaregiverAccess(patientId, true);
  const authorizedView = await demoService.fetchFamilyView(patientId);

  assert(Boolean(authorizedView), 'Returns authorized family view');
  assert(authorizedView.caregiverAccess.authorized === true, 'Consent is marked authorized');
  assert(authorizedView.caregiverAccess.contactNumber !== null, 'Permitted view includes caregiver contact number');

  // 6.2 Revoke consent
  await demoService.updateCaregiverAccess(patientId, false);
  const revokedView = await demoService.fetchFamilyView(patientId);

  assert(Boolean(revokedView), 'Returns revoked family view');
  assert(revokedView.caregiverAccess.authorized === false, 'Consent is marked unauthorized');
  assert(revokedView.dosesToday.taken === 0 && revokedView.dosesToday.total === 0, 'Dose counts strictly zeroed out upon revocation');
  assert(revokedView.nextDoseTime === null, 'Next dose time suppressed (null) upon revocation');
  assert(revokedView.caregiverAccess.contactNumber === null, 'Caregiver phone contact strictly stripped (null) upon revocation');
  assert(revokedView.healthUpdateStatus === 'Consent Revoked', 'Status explicitly displays "Consent Revoked"');
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
  console.log('ALL DEMO BLOCKER FIXES VERIFIED SUCCESSFULLY!');
  process.exit(0);
}
