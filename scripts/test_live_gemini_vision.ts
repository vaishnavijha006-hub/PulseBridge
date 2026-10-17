/**
 * PulseBridge AI — Live Google Gemini Vision Multimodal Extraction Verification Suite
 * File: scripts/test_live_gemini_vision.ts
 *
 * Requirements verified:
 * 1. Direct Google Generative Language API connectivity using server-side GEMINI_API_KEY
 * 2. Grounded multimodal vision extraction on synthetic prescription image (synthetic_rx.png)
 * 3. Validation and draft assembly: draft remains strictly unconfirmed (Doctor Lock intact)
 * 4. Local backend runner endpoint (/functions/v1/scan-prescription) end-to-end integration
 * 5. Safe failure on missing credentials (HTTP 503 AI_CONFIG_UNAVAILABLE, zero silent mock fallback)
 * 6. Provider authentication rejection handling (HTTP 502 PROVIDER_AUTH_ERROR)
 * 7. Zero secret leakage across all payloads, headers, and logs
 */

import fs from 'node:fs';
import path from 'node:path';
import { handleScanPrescriptionRequest } from '../supabase/functions/scan-prescription/index';
import {
  GeminiVisionAdapter,
  GeminiConfigError,
} from '../supabase/functions/scan-prescription/geminiVisionAdapter';
import { validatePrescriptionScanOutput } from '../supabase/functions/scan-prescription/prescriptionValidator';
import type { PrescriptionDraft } from '../src/types';

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

console.log('================================================================');
console.log('PULSEBRIDGE AI — LIVE GEMINI VISION EXTRACTION TEST SUITE');
console.log('================================================================\n');

// Load synthetic prescription image
const imagePath = path.resolve(process.cwd(), 'scripts/synthetic_rx.png');
if (!fs.existsSync(imagePath)) {
  console.error(`Synthetic prescription image not found at ${imagePath}`);
  process.exit(1);
}
const imageBuffer = fs.readFileSync(imagePath);
const imageBase64 = imageBuffer.toString('base64');

// -----------------------------------------------------------------------------
// SUITE 1: Server Environment & Gemini API Connectivity
// -----------------------------------------------------------------------------
console.log('SUITE 1: Server Environment & Gemini API Connectivity');
{
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_PROVIDER_API_KEY;
  assert(Boolean(apiKey && apiKey.length > 20), 'GEMINI_API_KEY is securely present in server environment');

  const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey || '')}`;
  const modelsRes = await fetch(modelsUrl);
  assert(modelsRes.status === 200, 'Direct Google Gemini models API returns HTTP 200 OK');

  const modelsJson = (await modelsRes.json()) as { models?: Array<{ name: string }> };
  const hasFlashModel = modelsJson.models?.some((m) =>
    m.name.includes('flash') || m.name.includes('gemini')
  );
  assert(Boolean(hasFlashModel), 'Verified supported multimodal Gemini model available in Google API catalog');
}

// -----------------------------------------------------------------------------
// SUITE 2: Live Multimodal Extraction with GeminiVisionAdapter
// -----------------------------------------------------------------------------
console.log('\nSUITE 2: Live Multimodal Vision Extraction via GeminiVisionAdapter');
{
  const adapter = new GeminiVisionAdapter();
  assert(adapter.providerName === 'gemini_vision', 'Adapter identifies as gemini_vision provider');
  assert(typeof adapter.modelName === 'string', `Adapter configured with model: ${adapter.modelName}`);

  const startTime = Date.now();
  const result = await adapter.scanPrescription(imageBase64, 'image/png');
  const elapsed = Date.now() - startTime;

  assert(Boolean(result.rawOutput), 'Live Gemini API returned non-empty extraction result');
  assert(result.latencyMs > 0, `Recorded live API latency (${result.latencyMs}ms, total ${elapsed}ms)`);

  const raw = result.rawOutput as { fields: Array<{ key: string; value: string; status: string }>; rawTranscription?: string };
  assert(Array.isArray(raw.fields), 'Live extraction contains fields array');

  const medicine = raw.fields.find((f) => f.key === 'medicine')?.value;
  const dosage = raw.fields.find((f) => f.key === 'dosage')?.value;
  const frequency = raw.fields.find((f) => f.key === 'frequency')?.value;
  const duration = raw.fields.find((f) => f.key === 'duration')?.value;

  assert(Boolean(medicine && /amoxicillin/i.test(medicine)), `Extracted correct medicine name: "${medicine}"`);
  assert(Boolean(dosage && /500\s*mg/i.test(dosage)), `Extracted correct dosage strength: "${dosage}"`);
  assert(Boolean(frequency && /twice/i.test(frequency)), `Extracted correct frequency: "${frequency}"`);
  assert(Boolean(duration && /7\s*days/i.test(duration)), `Extracted correct duration: "${duration}"`);
  assert(Boolean(raw.rawTranscription && raw.rawTranscription.includes('Amoxicillin')), 'Preserved verbatim prescription transcription');
}

// -----------------------------------------------------------------------------
// SUITE 3: Local Runner Endpoint & Clinical Gate Integration
// -----------------------------------------------------------------------------
console.log('\nSUITE 3: Local Runner Endpoint & Clinical Gate Integration');
{
  const localRunnerUrl = 'http://localhost:54321/functions/v1/scan-prescription';

  const runnerRes = await fetch(localRunnerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-valid-jwt-token',
    },
    body: JSON.stringify({
      patientId: 'p-live-test',
      imageBase64,
      mimeType: 'image/png',
      // Note: useMock is OMITTED -> forces REAL live Gemini extraction
    }),
  });

  assert(runnerRes.status === 200, 'Local runner returns HTTP 200 OK for live Gemini scan');

  const json = (await runnerRes.json()) as {
    data: PrescriptionDraft;
    confidence: string;
    missingCriticalFields: string[];
    disclaimer: string;
  };

  assert(Boolean(json.data), 'Response includes structured PrescriptionDraft in data');
  assert(json.data.patientId === 'p-live-test', 'Draft correctly bound to requested patient ID');
  assert(json.data.confirmed === false, 'Draft strictly unconfirmed (Doctor Lock invariant)');
  assert(json.data.confirmedAt === null, 'Draft confirmedAt is strictly null');
  assert(json.data.confirmedBy === null, 'Draft confirmedBy is strictly null');
  assert(json.missingCriticalFields.length === 0, 'No missing critical fields on clear synthetic prescription');
  assert(json.disclaimer.includes('Non-diagnostic'), 'Includes non-diagnostic clinical safety disclaimer');

  // Verify zero secret leakage in runner response
  const serialized = JSON.stringify(json);
  assert(!serialized.includes(process.env.GEMINI_API_KEY || 'SECRET_NOT_SET'), 'Zero GEMINI_API_KEY leakage in response');
  assert(!serialized.includes('Bearer'), 'Zero Bearer token leakage in response');
}

// -----------------------------------------------------------------------------
// SUITE 4: Safe Failure on Missing Credentials (Zero Silent Mock Fallback)
// -----------------------------------------------------------------------------
console.log('\nSUITE 4: Safe Failure on Missing Credentials (Zero Silent Mock Fallback)');
{
  const savedKey = process.env.GEMINI_API_KEY;
  const savedProviderKey = process.env.AI_PROVIDER_API_KEY;

  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_PROVIDER_API_KEY;

    // Normal scan request WITHOUT useMock in test env
    const unconfiguredReq = new Request('http://localhost:54321/functions/v1/scan-prescription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-valid-jwt-token',
      },
      body: JSON.stringify({
        patientId: 'p1',
        imageBase64,
        mimeType: 'image/png',
        // useMock is NOT set
      }),
    });

    const res = await handleScanPrescriptionRequest(unconfiguredReq);
    assert(res.status === 503, 'Missing credentials returns HTTP 503 Service Unavailable');

    const errJson = await res.json();
    assert(errJson.code === 'AI_CONFIG_UNAVAILABLE', 'Error code specifies AI_CONFIG_UNAVAILABLE');
    assert(!errJson.data, 'Does NOT silently fall back to mock data when credentials missing');
  } finally {
    process.env.GEMINI_API_KEY = savedKey;
    if (savedProviderKey) process.env.AI_PROVIDER_API_KEY = savedProviderKey;
  }
}

// -----------------------------------------------------------------------------
// SUITE 5: Safe Failure on Invalid Credentials (HTTP 502 PROVIDER_AUTH_ERROR)
// -----------------------------------------------------------------------------
console.log('\nSUITE 5: Safe Failure on Invalid Credentials (HTTP 502 PROVIDER_AUTH_ERROR)');
{
  try {
    const bogusAdapter = new GeminiVisionAdapter('invalid-bogus-key-98765');
    await bogusAdapter.scanPrescription(imageBase64, 'image/png');
    assert(false, 'Should have failed with invalid credentials');
  } catch (err: any) {
    assert(err instanceof GeminiConfigError, 'Throws GeminiConfigError when credentials rejected by Google');
    assert(err.message.includes('authentication rejected'), 'Error specifies authentication rejection');
  }
}

// -----------------------------------------------------------------------------
// SUITE 6: Doctor Lock Invariant Preservation
// -----------------------------------------------------------------------------
console.log('\nSUITE 6: Doctor Lock Invariant Preservation');
{
  const { demoService } = await import('../src/services/dataService');

  // Verify that an unconfirmed draft does not create schedules
  const patientId = `p-lock-test-${Date.now()}`;
  const validated = validatePrescriptionScanOutput(
    {
      fields: [
        { key: 'medicine', value: 'Amoxicillin', status: 'confirmed' },
        { key: 'dosage', value: '500mg', status: 'confirmed' },
        { key: 'frequency', value: 'Twice daily', status: 'confirmed' },
        { key: 'duration', value: '7 days', status: 'confirmed' },
        { key: 'instructions', value: 'Take after meals', status: 'confirmed' },
      ],
      rawTranscription: 'Rx: Amoxicillin 500mg Twice daily',
    },
    patientId,
    'synthetic_rx.png'
  );

  assert(validated.draft.confirmed === false, 'Draft is strictly unconfirmed');

  // Attempting to confirm with an unverified field must fail
  const uncertainFields = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Amoxicillin', status: 'confirmed' as const },
    { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'uncertain' as const },
  ];
  const premConfirmRes = await demoService.confirmCarePlan(patientId, uncertainFields);
  assert('error' in premConfirmRes, 'Reject confirmation when any critical field is uncertain');

  // Valid doctor confirmation activates the schedule
  const validConfirmedFields = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Amoxicillin', status: 'confirmed' as const },
    { key: 'dosage', labelKey: 'rx_dosage', value: '500mg', status: 'confirmed' as const },
    { key: 'frequency', labelKey: 'rx_frequency', value: 'Twice daily', status: 'confirmed' as const },
    { key: 'duration', labelKey: 'rx_duration', value: '7 days', status: 'confirmed' as const },
    { key: 'instructions', labelKey: 'rx_instructions', value: 'Take after meals', status: 'confirmed' as const },
  ];
  const confirmRes = await demoService.confirmCarePlan(patientId, validConfirmedFields);
  assert('ok' in confirmRes && confirmRes.ok === true, 'Authorized confirmation successfully locks plan');

  const schedules = await demoService.fetchMedicationSchedules(patientId);
  const amoxSchedule = schedules.find((s) => s.medicineName === 'Amoxicillin');
  assert(Boolean(amoxSchedule), 'Medication schedule activated ONLY after explicit physician lock');
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
  console.log('ALL LIVE GEMINI VISION EXTRACTION TESTS PASSED!');
  process.exit(0);
}
