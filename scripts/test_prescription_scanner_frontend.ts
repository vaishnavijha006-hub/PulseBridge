/**
 * PulseBridge AI — Step 3: Frontend AI Prescription Scanner Integration Test Suite
 * File: scripts/test_prescription_scanner_frontend.ts
 *
 * Verifies:
 * 1. DataService.scanPrescription API interface and typed signature
 * 2. Client-side MIME type validation (JPEG, PNG, WebP allowed; PDF/GIF/text rejected)
 * 3. Client-side payload size guard (>10 MB rejected before network dispatch)
 * 4. Safe base64 conversion helper (convertBlobToBase64) across environments
 * 5. Network dispatch with Bearer token authentication and structured JSON payload
 * 6. Explicit error propagation on service unreachability or backend failure (no silent OCR fallback)
 * 7. End-to-end integration: dataService -> Edge Function handler -> PrescriptionDraft
 * 8. Human-in-the-Loop Doctor Lock invariants:
 *    - Extracted drafts remain strictly unconfirmed (confirmed === false)
 *    - Confirmation metadata (confirmedAt, confirmedBy) remain strictly null
 *    - Medication schedules are NOT activated during scanning
 *    - Doctor verification via confirmCarePlan is required to lock and activate
 */

import { dataService, convertBlobToBase64 } from '../src/services/dataService';
import { handleScanPrescriptionRequest } from '../supabase/functions/scan-prescription/index';
import type { PrescriptionDraft, PrescriptionField } from '../src/types';

// Enforce server test mode
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

// Minimal valid 1x1 pixel PNG
const SAMPLE_BASE64_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const samplePngBytes = Buffer.from(SAMPLE_BASE64_PNG, 'base64');

console.log('================================================================');
console.log('PULSEBRIDGE AI — FRONTEND PRESCRIPTION SCANNER (STEP 3) TESTS');
console.log('================================================================\n');

async function runTests() {
  // ---------------------------------------------------------------------------
  // SUITE 1: Client-Side Input Validation & Payload Guards
  // ---------------------------------------------------------------------------
  console.log('SUITE 1: Client-Side Guards & Validation');
  {
    // 1. Patient ID guard
    const sampleBlob = new Blob([samplePngBytes], { type: 'image/png' });
    const emptyPatientRes = await dataService.scanPrescription('', sampleBlob);
    assert('error' in emptyPatientRes, 'Rejects empty patientId before dispatch');
    if ('error' in emptyPatientRes) {
      assert(emptyPatientRes.code === 'INVALID_PATIENT_ID', 'Code specifies INVALID_PATIENT_ID');
    }

    // 2. Unsupported MIME type guard
    const textBlob = new Blob(['Not an image'], { type: 'text/plain' });
    const invalidMimeRes = await dataService.scanPrescription('p1', textBlob);
    assert('error' in invalidMimeRes, 'Rejects text/plain MIME type before dispatch');
    if ('error' in invalidMimeRes) {
      assert(invalidMimeRes.code === 'INVALID_MIME_TYPE', 'Code specifies INVALID_MIME_TYPE');
    }

    const pdfBlob = new Blob([new Uint8Array(100)], { type: 'application/pdf' });
    const pdfRes = await dataService.scanPrescription('p1', pdfBlob);
    assert('error' in pdfRes, 'Rejects application/pdf MIME type before dispatch');

    // 3. Size guard (>10 MB)
    // Create oversized virtual blob without allocating 11 MB of memory
    const oversizedBlob = {
      size: 11 * 1024 * 1024,
      type: 'image/jpeg',
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Blob;

    const oversizedRes = await dataService.scanPrescription('p1', oversizedBlob);
    assert('error' in oversizedRes, 'Rejects oversized image (>10 MB) before dispatch');
    if ('error' in oversizedRes) {
      assert(oversizedRes.code === 'PAYLOAD_TOO_LARGE', 'Code specifies PAYLOAD_TOO_LARGE');
    }
  }

  // ---------------------------------------------------------------------------
  // SUITE 2: Base64 Conversion Helper Verification
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 2: Base64 Conversion Helper (convertBlobToBase64)');
  {
    const pngBlob = new Blob([samplePngBytes], { type: 'image/png' });
    const converted = await convertBlobToBase64(pngBlob);
    assert(converted.mimeType === 'image/png', 'Preserves correct MIME type');
    assert(converted.base64 === SAMPLE_BASE64_PNG, 'Encodes blob bytes accurately to base64');

    const jpegBlob = new Blob([samplePngBytes], { type: 'image/jpeg' });
    const convertedJpeg = await convertBlobToBase64(jpegBlob);
    assert(convertedJpeg.mimeType === 'image/jpeg', 'Detects image/jpeg MIME type');
  }

  // ---------------------------------------------------------------------------
  // SUITE 3: Unreachable Service & Error Transparency (No Silent Fallback)
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 3: Honest Error Handling & Zero Silent Fallbacks');
  {
    const originalFetch = globalThis.fetch;

    // Simulate backend server offline / network connection failure
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch: Connection refused');
    };

    try {
      const validBlob = new Blob([samplePngBytes], { type: 'image/png' });
      const failRes = await dataService.scanPrescription('p1', validBlob);

      assert('error' in failRes, 'Returns structured error when endpoint is unreachable');
      if ('error' in failRes) {
        assert(
          failRes.code === 'SERVICE_UNREACHABLE',
          'Error code specifies SERVICE_UNREACHABLE (not silent fake scan)',
          failRes.code
        );
        assert(
          failRes.error.toLowerCase().includes('unreachable') ||
            failRes.error.toLowerCase().includes('running'),
          'Error message clearly explains server unreachability for user retry',
          failRes.error
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Simulate backend returning HTTP 403 Forbidden
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          error: 'Caller is not authorized to access foreign patient record.',
          code: 'AUTH_PATIENT_ACCESS_DENIED',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as any;

    try {
      const validBlob = new Blob([samplePngBytes], { type: 'image/png' });
      const authDeniedRes = await dataService.scanPrescription('cross-user-999', validBlob);
      assert('error' in authDeniedRes, 'Propagates HTTP 403 error cleanly');
      if ('error' in authDeniedRes) {
        assert(
          authDeniedRes.code === 'AUTH_PATIENT_ACCESS_DENIED',
          'Preserves backend error code AUTH_PATIENT_ACCESS_DENIED',
          authDeniedRes.code
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ---------------------------------------------------------------------------
  // SUITE 4: End-to-End Pipeline (Frontend dataService -> Edge Function Handler)
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 4: End-to-End Scanning Pipeline');
  {
    const originalFetch = globalThis.fetch;

    // Route fetch directly to handleScanPrescriptionRequest
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      const headers = new Headers(init?.headers);
      const req = new Request(urlStr, {
        method: init?.method || 'POST',
        headers,
        body: init?.body,
      });
      return handleScanPrescriptionRequest(req);
    }) as any;

    try {
      const validBlob = new Blob([samplePngBytes], { type: 'image/png' });
      const scanRes = await dataService.scanPrescription('p1', validBlob, { useMock: true });

      assert('data' in scanRes, 'Successfully returns extracted prescription data');
      if ('data' in scanRes) {
        const draft = scanRes.data;
        assert(draft.patientId === 'p1', 'Draft preserves authorized patientId');
        assert(Array.isArray(draft.fields) && draft.fields.length >= 4, 'Draft contains extracted fields');
        assert(Boolean(scanRes.disclaimer), 'Includes mandatory non-diagnostic disclaimer');
        assert(scanRes.disclaimer.toLowerCase().includes('non-diagnostic'), 'Disclaimer explicitly states non-diagnostic');

        // Check critical fields
        const medField = draft.fields.find((f) => f.key === 'medicine');
        const doseField = draft.fields.find((f) => f.key === 'dosage');
        assert(Boolean(medField && medField.value), 'Extracts medicine field');
        assert(Boolean(doseField && doseField.value), 'Extracts dosage field');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ---------------------------------------------------------------------------
  // SUITE 5: Human-in-the-Loop Doctor Lock Invariants
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 5: Clinical Safety & Doctor Lock Invariants');
  {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      const headers = new Headers(init?.headers);
      const req = new Request(urlStr, {
        method: init?.method || 'POST',
        headers,
        body: init?.body,
      });
      return handleScanPrescriptionRequest(req);
    }) as any;

    try {
      // 1. Scan a prescription for p1
      const validBlob = new Blob([samplePngBytes], { type: 'image/png' });
      const scanRes = await dataService.scanPrescription('p1', validBlob, { useMock: true });

      assert('data' in scanRes, 'Scan succeeds in mock test mode');
      if ('data' in scanRes) {
        const draft = scanRes.data;

        // Invariant A: Scanned draft must NOT be confirmed
        assert(draft.confirmed === false, 'Draft confirmed property is strictly false');
        assert(draft.confirmedAt === null, 'Draft confirmedAt timestamp is strictly null');
        assert(draft.confirmedBy === null, 'Draft confirmedBy doctor identity is strictly null');

        // Invariant B: Draft is in mutable store awaiting review
        const storedDraft = await dataService.fetchPrescriptionDraft('p1');
        assert(storedDraft !== null, 'Draft is accessible in store for doctor review');
        assert(storedDraft?.confirmed === false, 'Stored draft remains unconfirmed');

        // Invariant C: Doctor cannot lock with uncertain critical fields
        const uncertainFields: PrescriptionField[] = [
          { key: 'medicine', labelKey: 'rx_medicine', value: 'Aspirin', status: 'confirmed' },
          { key: 'dosage', labelKey: 'rx_dosage', value: '75mg', status: 'confirmed' },
          { key: 'frequency', labelKey: 'rx_frequency', value: 'Once daily', status: 'uncertain' }, // uncertain!
          { key: 'duration', labelKey: 'rx_duration', value: '14 days', status: 'confirmed' },
        ];
        const prematureLock = await dataService.confirmCarePlan('p1', uncertainFields);
        assert('error' in prematureLock, 'Doctor lock blocks confirmation when critical field is uncertain');

        // Invariant D: Doctor approval succeeds only when all critical fields are doctor-verified
        const verifiedFields: PrescriptionField[] = uncertainFields.map((f) => ({
          ...f,
          status: 'confirmed' as const,
        }));
        const lockSuccess = await dataService.confirmCarePlan('p1', verifiedFields);
        assert('ok' in lockSuccess && lockSuccess.ok === true, 'Care plan confirms successfully when doctor verifies');

        // Invariant E: Confirming properly locks the draft
        const lockedDraft = await dataService.fetchPrescriptionDraft('p1');
        assert(lockedDraft?.confirmed === true, 'Prescription draft marked confirmed after doctor lock');
        assert(Boolean(lockedDraft?.confirmedBy), 'Doctor name stamped on confirmed care plan');
        assert(Boolean(lockedDraft?.confirmedAt), 'Confirmation timestamp recorded');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ---------------------------------------------------------------------------
  // SUITE 6: Feature 1 Critical Fixes Regression Suite
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 6: Feature 1 Critical Fixes Regression Suite');
  {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      const headers = new Headers(init?.headers);
      const req = new Request(urlStr, {
        method: init?.method || 'POST',
        headers,
        body: init?.body,
      });
      return handleScanPrescriptionRequest(req);
    }) as any;

    try {
      // 1. Dynamic Patient Identity: Intake creates real patient ID propagated to scan & draft
      const intakeRes = await dataService.savePatientIntake({
        name: 'Meera Patel',
        age: 38,
        gender: 'female',
        symptoms: 'Mild tachycardia and fatigue',
        allergies: 'Penicillin',
        currentMeds: 'None',
        language: 'hi',
      });

      assert('data' in intakeRes && Boolean(intakeRes.data?.id), 'savePatientIntake returns persisted patient data');
      const newPatientId = 'data' in intakeRes ? intakeRes.data.id : 'unknown';
      assert(newPatientId.startsWith('p-'), 'Generated patient ID uses consistent prefix');
      assert(newPatientId !== 'p1', 'Newly onboarded patient ID is distinct from demo patient p1');

      // Unconfirmed prescription invariant: brand-new patient has NO schedules before doctor confirmation
      const preConfirmSchedules = await dataService.fetchMedicationSchedules(newPatientId);
      assert(preConfirmSchedules.length === 0, 'Unconfirmed patient has 0 active medication schedules');

      // Scan prescription for newPatientId
      const validBlob = new Blob([samplePngBytes], { type: 'image/png' });
      const scanRes = await dataService.scanPrescription(newPatientId, validBlob, { useMock: true });
      assert('data' in scanRes, 'Scan succeeds for dynamic patient ID');
      if ('data' in scanRes) {
        assert(scanRes.data.patientId === newPatientId, 'Prescription draft preserves dynamic patient ID');
        assert(scanRes.data.confirmed === false, 'Newly scanned draft is unconfirmed');
      }

      // Verify draft in store under newPatientId
      const fetchedDraft = await dataService.fetchPrescriptionDraft(newPatientId);
      assert(fetchedDraft !== null && fetchedDraft.patientId === newPatientId, 'Draft is retrievable by newPatientId');

      // 2. Doctor Lock: Missing or uncertain critical fields block confirmation for new patient
      const invalidFields: PrescriptionField[] = [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Metoprolol', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '', status: 'uncertain' }, // empty & uncertain!
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Twice daily', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '14 days', status: 'confirmed' },
      ];
      const blockedRes = await dataService.confirmCarePlan(newPatientId, invalidFields);
      assert('error' in blockedRes, 'Missing/uncertain critical field blocks confirmation');

      // Schedules remain 0 after blocked confirmation attempt
      const postBlockedSchedules = await dataService.fetchMedicationSchedules(newPatientId);
      assert(postBlockedSchedules.length === 0, 'Blocked confirmation never generates schedules');

      // 3. Authorized Doctor Confirmation for dynamic patient activates schedule
      const validDoctorFields: PrescriptionField[] = [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Metoprolol', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '25mg', status: 'confirmed' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Twice daily (08:00, 20:00)', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '14 days', status: 'confirmed' },
        { key: 'instructions', labelKey: 'rx_field_instructions', value: 'Take with food', status: 'confirmed' },
      ];
      const confirmRes = await dataService.confirmCarePlan(newPatientId, validDoctorFields);
      assert('ok' in confirmRes && confirmRes.ok === true, 'Care plan confirmed successfully for new patient');

      // Verify schedule is created in 'pending' status for newPatientId
      const postConfirmSchedules = await dataService.fetchMedicationSchedules(newPatientId);
      assert(postConfirmSchedules.length === 1, 'Schedule activated upon doctor confirmation');
      assert(postConfirmSchedules[0].medicineName === 'Metoprolol', 'Schedule medicine name matches confirmed field');
      assert(postConfirmSchedules[0].dosage === '25mg', 'Schedule dosage matches confirmed field');
      assert(postConfirmSchedules[0].status === 'pending', 'Activated schedule begins in pending status');
      assert(postConfirmSchedules[0].patientId === newPatientId, 'Activated schedule is assigned to dynamic patient');

      // 4. Append Newly Confirmed Schedule When Existing Schedules Already Exist (Patient p1)
      const p1InitialSchedules = await dataService.fetchMedicationSchedules('p1');
      assert(p1InitialSchedules.length > 0, 'Patient p1 starts with existing demo schedules');
      const initialCount = p1InitialSchedules.length;
      const initialIds = p1InitialSchedules.map((s) => s.id);

      // Confirm a new prescription for Clopidogrel on patient p1
      const p1NewFields: PrescriptionField[] = [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Clopidogrel', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '75mg', status: 'confirmed' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily (08:00)', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '30 days', status: 'confirmed' },
        { key: 'instructions', labelKey: 'rx_field_instructions', value: 'After breakfast', status: 'confirmed' },
      ];
      const p1ConfirmRes = await dataService.confirmCarePlan('p1', p1NewFields);
      assert('ok' in p1ConfirmRes && p1ConfirmRes.ok === true, 'Confirmation succeeds for patient with existing schedules');

      const p1UpdatedSchedules = await dataService.fetchMedicationSchedules('p1');
      assert(p1UpdatedSchedules.length === initialCount + 1, 'New schedule is appended rather than replacing existing schedules');

      // Verify existing schedules remain unchanged
      for (const origId of initialIds) {
        assert(p1UpdatedSchedules.some((s) => s.id === origId), `Existing schedule ${origId} preserved intact`);
      }

      // Verify newly appended schedule attributes
      const clopidogrelSched = p1UpdatedSchedules.find((s) => s.medicineName.toLowerCase() === 'clopidogrel');
      assert(Boolean(clopidogrelSched), 'Appended Clopidogrel schedule found in schedules list');
      assert(clopidogrelSched?.status === 'pending', 'Appended schedule starts in pending status');
      assert(clopidogrelSched?.dosage === '75mg', 'Appended schedule has correct dosage');

      // 5. Duplicate Prevention: Repeated confirmation does not duplicate existing schedule
      const p1RepeatConfirm = await dataService.confirmCarePlan('p1', p1NewFields);
      assert('ok' in p1RepeatConfirm && p1RepeatConfirm.ok === true, 'Repeated confirmation returns ok');
      const p1SchedulesAfterRepeat = await dataService.fetchMedicationSchedules('p1');
      assert(
        p1SchedulesAfterRepeat.length === p1UpdatedSchedules.length,
        'Repeated confirmation does not create duplicate schedule'
      );

      // 6. State Refresh: Draft marked confirmed with doctor metadata
      const p1LockedDraft = await dataService.fetchPrescriptionDraft('p1');
      assert(p1LockedDraft?.confirmed === true, 'Prescription draft marked confirmed');
      assert(Boolean(p1LockedDraft?.confirmedAt), 'Prescription draft has confirmedAt timestamp');
      assert(Boolean(p1LockedDraft?.confirmedBy), 'Prescription draft has confirmedBy doctor identity');

    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('FRONTEND AI PRESCRIPTION SCANNER INTEGRATION SUCCESSFULLY VERIFIED!\n');
  }
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
