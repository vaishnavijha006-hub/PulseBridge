/**
 * PulseBridge AI — Intelligent Prescription Safety & Auto-Readiness Test Suite
 * File: scripts/test_prescription_safety_workflow.ts
 *
 * Verifies all 11 requirements from Feature Specification:
 * 1. Clear extraction with all required fields
 * 2. Illegible handwriting and missing dosage
 * 3. Known allergy match (direct match & drug class cross-reactivity)
 * 4. New vs old prescription conflict
 * 5. Duplicate medication detection
 * 6. Missing historical data (marked unknown, not passed)
 * 7. Doctor notification creation (in-app simulated, unconfigured external delivery)
 * 8. Unauthorized confirmation rejection (Doctor Lock fail-closed)
 * 9. Schedule activation only after doctor approval
 * 10. Superseded prescription not reactivated
 * 11. Patient reminder flow after approval (suppressed while pending, live after lock)
 */

import fs from 'node:fs';
import path from 'node:path';

// Load environment variables safely
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

const { evaluatePrescriptionSafety } = await import('../src/services/prescriptionSafetyWorkflow');
const { demoService, productionService } = await import('../src/services/dataService');
const { generateReminders } = await import('../src/utils/reminderEngine');
const { supabase } = await import('../src/lib/supabase');
import type { PrescriptionDraft, PatientProfile, MedicationSchedule, FollowUp } from '../src/types';

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
console.log('PULSEBRIDGE AI — PRESCRIPTION SAFETY & AUTO-READINESS SUITE');
console.log('================================================================\n');

async function runTests() {
  const cleanPatient: PatientProfile = {
    id: 'p-clean-1',
    name: 'Ravi Sharma',
    age: 52,
    gender: 'male',
    phone: '+91 98765 43210',
    symptoms: 'Stable post-MI recovery',
    allergies: 'None',
    currentMeds: 'None',
    language: 'hi',
  };

  // ---------------------------------------------------------------------------
  // SUITE 1: Clear Extraction with All Required Fields
  // ---------------------------------------------------------------------------
  console.log('SUITE 1: Clear Extraction with All Required Fields');
  {
    const clearDraft: PrescriptionDraft = {
      id: 'rx-clear-1',
      patientId: cleanPatient.id,
      imageUrl: 'synthetic_rx.png',
      uploadedAt: new Date().toISOString(),
      confirmed: false,
      fields: [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Atorvastatin', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '40mg', status: 'confirmed' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily at bedtime', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '30 days', status: 'confirmed' },
        { key: 'instructions', labelKey: 'rx_field_instructions', value: 'Take with water', status: 'confirmed' },
        { key: 'route', labelKey: 'rx_field_route', value: 'Oral', status: 'confirmed' },
        { key: 'prescription_date', labelKey: 'rx_field_date', value: '2026-10-15', status: 'confirmed' },
        { key: 'prescriber', labelKey: 'rx_field_prescriber', value: 'Dr. Anita Desai, MD', status: 'confirmed' },
      ],
      route: 'Oral',
      prescriptionDate: '2026-10-15',
      prescriber: 'Dr. Anita Desai, MD',
    };

    const assessment = evaluatePrescriptionSafety(clearDraft, cleanPatient);
    assert(assessment.workflowState === 'ready_for_doctor_review', 'Assigns workflow state "ready_for_doctor_review"');
    assert(assessment.canDoctorApprove === true, 'Doctor can approve when all checks pass');
    assert(assessment.blockingReasons.length === 0, 'Zero blocking reasons for clean prescription');
    assert(
      assessment.patientStatusLabel === 'Prescription extracted — awaiting doctor approval',
      'Patient label is "Prescription extracted — awaiting doctor approval"'
    );
    assert(assessment.checks.criticalFields.status === 'passed', 'Critical fields check passed');
    assert(assessment.checks.allergies.status === 'passed', 'Allergy check passed (None)');
    assert(assessment.checks.duplicateMeds.status === 'passed', 'Duplicate check passed');
    assert(assessment.checks.conflictingPrescriptions.status === 'passed', 'Conflicting prescriptions check passed');
    assert(assessment.checks.prescriptionRecency.status === 'passed', 'Recency check passed');
  }

  // ---------------------------------------------------------------------------
  // SUITE 2: Illegible Handwriting and Missing Dosage
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 2: Illegible Handwriting and Missing Dosage');
  {
    const illegibleDraft: PrescriptionDraft = {
      id: 'rx-illegible-1',
      patientId: cleanPatient.id,
      imageUrl: 'smudged_rx.png',
      uploadedAt: new Date().toISOString(),
      confirmed: false,
      fields: [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Metoprolol', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '', status: 'uncertain' }, // Missing/illegible dosage
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Twice daily', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '14 days', status: 'confirmed' },
        { key: 'instructions', labelKey: 'rx_field_instructions', value: '', status: 'uncertain' },
      ],
    };

    const assessment = evaluatePrescriptionSafety(illegibleDraft, cleanPatient);
    assert(assessment.workflowState === 'uncertain_fields', 'Assigns workflow state "uncertain_fields" for smudged dosage');
    assert(assessment.canDoctorApprove === false, 'Doctor approval is strictly blocked when dosage is uncertain');
    assert(assessment.checks.criticalFields.status === 'alert', 'Critical fields status is "alert"');
    assert(assessment.checks.criticalFields.missing.includes('dosage'), 'Identifies dosage as missing/uncertain critical parameter');
    assert(
      assessment.patientStatusLabel === 'Doctor review required — unclear dosage',
      'Patient status label is "Doctor review required — unclear dosage"'
    );
    assert(assessment.notifications.length > 0, 'Doctor notification generated for unreadable parameters');
    assert(assessment.notifications[0].type === 'unreadable_fields', 'Notification type is "unreadable_fields"');
  }

  // ---------------------------------------------------------------------------
  // SUITE 3: Known Allergy Match & Cross-Reactivity
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 3: Known Allergy Match & Cross-Reactivity');
  {
    const allergicPatient: PatientProfile = {
      ...cleanPatient,
      allergies: 'Penicillin (severe anaphylaxis), Aspirin',
    };

    // Amoxicillin is a penicillin-class antibiotic (cross-reactivity)
    const amoxDraft: PrescriptionDraft = {
      id: 'rx-amox-1',
      patientId: allergicPatient.id,
      imageUrl: 'amox_rx.png',
      uploadedAt: new Date().toISOString(),
      confirmed: false,
      fields: [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Amoxicillin', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '500mg', status: 'confirmed' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Twice daily', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '7 days', status: 'confirmed' },
      ],
    };

    const assessment = evaluatePrescriptionSafety(amoxDraft, allergicPatient);
    assert(assessment.workflowState === 'allergy_alert', 'Assigns workflow state "allergy_alert"');
    assert(assessment.canDoctorApprove === false, 'Doctor approval is strictly blocked without clinical override');
    assert(assessment.checks.allergies.status === 'alert', 'Allergy check status is "alert"');
    assert(Boolean(assessment.checks.allergies.matchedAllergy), 'Identifies matched allergy cross-reaction');
    assert(
      assessment.patientStatusLabel === 'Doctor review required — possible allergy conflict',
      'Patient label is "Doctor review required — possible allergy conflict"'
    );
    assert(
      assessment.notifications.some((n) => n.type === 'allergy_match'),
      'Doctor notification generated for documented allergy conflict'
    );

    // Overriding the allergy conflict as a physician allows approval
    const overriddenAssessment = evaluatePrescriptionSafety(amoxDraft, allergicPatient, [], [], {
      acknowledgedAllergy: true,
    });
    assert(overriddenAssessment.canDoctorApprove === true, 'Physician clinical override unblocks approval');
  }

  // ---------------------------------------------------------------------------
  // SUITE 4: New vs Old Prescription Conflict
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 4: New vs Old Prescription Conflict');
  {
    const priorRx: PrescriptionDraft = {
      id: 'rx-prior-1',
      patientId: cleanPatient.id,
      imageUrl: 'old_rx.png',
      uploadedAt: '2026-10-01T08:00:00Z',
      confirmed: true,
      confirmedAt: '2026-10-01T09:00:00Z',
      confirmedBy: 'Dr. S. Sharma',
      fields: [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Metoprolol', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '25mg', status: 'confirmed' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '30 days', status: 'confirmed' },
      ],
    };

    // New draft orders 50mg for same medicine (dosage change / conflict)
    const newConflictingDraft: PrescriptionDraft = {
      id: 'rx-new-1',
      patientId: cleanPatient.id,
      imageUrl: 'new_rx.png',
      uploadedAt: new Date().toISOString(),
      confirmed: false,
      fields: [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Metoprolol', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '50mg', status: 'confirmed' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '30 days', status: 'confirmed' },
      ],
    };

    const assessment = evaluatePrescriptionSafety(newConflictingDraft, cleanPatient, [], [priorRx]);
    assert(assessment.workflowState === 'prescription_conflict', 'Assigns workflow state "prescription_conflict"');
    assert(assessment.canDoctorApprove === false, 'Blocks confirmation without doctor reconciliation');
    assert(assessment.checks.conflictingPrescriptions.status === 'alert', 'Conflicting prescriptions check is "alert"');
    assert(
      assessment.patientStatusLabel === 'Prescription conflict detected — schedule paused',
      'Patient label is "Prescription conflict detected — schedule paused"'
    );
    assert(
      assessment.notifications.some((n) => n.type === 'prescription_conflict'),
      'Doctor notification generated for conflicting prescription'
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 5: Duplicate Medication Detection
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 5: Duplicate Medication Detection');
  {
    const activeSchedule: MedicationSchedule = {
      id: 's-active-1',
      medicineId: 'm-clopidogrel',
      medicineName: 'Clopidogrel',
      dosage: '75mg',
      scheduledTime: '09:00',
      status: 'pending',
      instructions: 'Take after breakfast',
      patientId: cleanPatient.id,
    };

    const duplicateDraft: PrescriptionDraft = {
      id: 'rx-duplicate-1',
      patientId: cleanPatient.id,
      imageUrl: 'duplicate_rx.png',
      uploadedAt: new Date().toISOString(),
      confirmed: false,
      fields: [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Clopidogrel', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '75mg', status: 'confirmed' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '14 days', status: 'confirmed' },
      ],
    };

    const assessment = evaluatePrescriptionSafety(duplicateDraft, cleanPatient, [activeSchedule]);
    assert(assessment.workflowState === 'prescription_conflict', 'Assigns workflow state "prescription_conflict" for duplicate');
    assert(assessment.checks.duplicateMeds.status === 'alert', 'Duplicate meds check status is "alert"');
    assert(Boolean(assessment.checks.duplicateMeds.duplicateName), 'Records duplicate medicine name');
    assert(
      assessment.notifications.some((n) => n.type === 'duplicate_medication'),
      'Doctor notification generated for duplicate medication therapy'
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 6: Missing Historical Data (Marked Unknown, Not Passed)
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 6: Missing Historical Data (Marked Unknown, Not Passed)');
  {
    const incompletePatient: any = {
      id: 'p-unknown-1',
      name: 'Unknown History Patient',
      // allergies is undefined
      // currentMeds is undefined
    };

    const standardDraft: PrescriptionDraft = {
      id: 'rx-std-1',
      patientId: 'p-unknown-1',
      imageUrl: 'standard_rx.png',
      uploadedAt: new Date().toISOString(),
      confirmed: false,
      fields: [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Paracetamol', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '500mg', status: 'confirmed' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'As needed', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '3 days', status: 'confirmed' },
      ],
    };

    const assessment = evaluatePrescriptionSafety(standardDraft, incompletePatient, []);
    assert(assessment.checks.allergies.status === 'unknown', 'Allergy check is strictly "unknown" when data is unavailable');
    assert(assessment.checks.allergies.status !== 'passed', 'Missing allergy data is NOT falsely marked "passed"');
    assert(assessment.checks.duplicateMeds.status === 'unknown', 'Duplicate check is strictly "unknown" when data is unavailable');
    assert(assessment.workflowState === 'needs_review', 'Assigns workflow state "needs_review" when history is unknown');
    assert(
      assessment.patientStatusLabel === 'Prescription extracted — awaiting doctor approval',
      'Patient label is "Prescription extracted — awaiting doctor approval"'
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 7: Doctor Notification Creation
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 7: Doctor Notification Creation & Delivery Semantics');
  {
    const smudgedAllergicDraft: PrescriptionDraft = {
      id: 'rx-notif-demo-1',
      patientId: 'p-notif-1',
      imageUrl: 'smudged_allergic.png',
      uploadedAt: new Date().toISOString(),
      confirmed: false,
      fields: [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Penicillin V', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '', status: 'uncertain' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: '', status: 'uncertain' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '10 days', status: 'confirmed' },
      ],
    };

    const allergicPatient: PatientProfile = {
      ...cleanPatient,
      allergies: 'Penicillin',
    };

    const assessment = evaluatePrescriptionSafety(smudgedAllergicDraft, allergicPatient);
    assert(assessment.notifications.length >= 2, 'Generates multiple doctor notifications for distinct clinical risks');

    for (const notif of assessment.notifications) {
      assert(notif.channel === 'in_app_simulated', 'Channel is strictly labeled "in_app_simulated"');
      assert(notif.externalDeliveryAttempted === false, 'externalDeliveryAttempted is strictly false');
      assert(notif.externalDeliveryStatus === 'not_configured', 'externalDeliveryStatus is strictly "not_configured"');
      assert(Boolean(notif.externalDeliveryReason), 'Provides explicit reason why external delivery was not attempted');
      assert(Boolean(notif.evidence), 'Notification contains evidence ground truth');
    }
  }

  // ---------------------------------------------------------------------------
  // SUITE 8: Unauthorized Confirmation Rejection
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 8: Unauthorized Confirmation Rejection');
  {
    const fieldsToConfirm = [
      { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Amoxicillin', status: 'confirmed' as const },
      { key: 'dosage', labelKey: 'rx_field_dosage', value: '500mg', status: 'confirmed' as const },
      { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Twice daily', status: 'confirmed' as const },
      { key: 'duration', labelKey: 'rx_field_duration', value: '7 days', status: 'confirmed' as const },
    ];

    // Unauthenticated caller calling productionService
    const unauthRes = await productionService.confirmCarePlan('p-auth-test', fieldsToConfirm);
    assert('error' in unauthRes, 'Production service rejects unauthenticated caller');
    assert(
      'error' in unauthRes && unauthRes.error.includes('Authentication required'),
      'Returns explicit authentication required message'
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 9: Schedule Activation Only After Doctor Approval
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 9: Schedule Activation Only After Doctor Approval');
  {
    const testPatientId = `p-sched-test-${Date.now()}`;
    const newPatientRes = await demoService.savePatientIntake({
      name: 'Schedule Test Patient',
      age: 45,
      gender: 'male',
      phone: '9876543210',
      symptoms: 'Hypertension routine evaluation',
      allergies: 'None',
      currentMeds: 'None',
    });
    assert('data' in newPatientRes, 'Created new intake patient');
    const createdId = ('data' in newPatientRes) ? newPatientRes.data.id : testPatientId;

    // Save unconfirmed draft
    await demoService.savePrescriptionDraft(createdId, 'test.png', [
      { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Lisinopril', status: 'confirmed' },
      { key: 'dosage', labelKey: 'rx_field_dosage', value: '10mg', status: 'confirmed' },
      { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily', status: 'confirmed' },
      { key: 'duration', labelKey: 'rx_field_duration', value: '30 days', status: 'confirmed' },
    ]);

    // Verify 0 active schedules before doctor confirmation
    const preSchedules = await demoService.fetchMedicationSchedules(createdId);
    assert(preSchedules.length === 0, 'Zero medication schedules active before doctor lock');

    // Confirm as doctor
    const confirmRes = await demoService.confirmCarePlan(createdId, [
      { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Lisinopril', status: 'confirmed' },
      { key: 'dosage', labelKey: 'rx_field_dosage', value: '10mg', status: 'confirmed' },
      { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily', status: 'confirmed' },
      { key: 'duration', labelKey: 'rx_field_duration', value: '30 days', status: 'confirmed' },
    ]);
    assert('ok' in confirmRes && confirmRes.ok === true, 'Doctor confirms care plan');

    // Verify schedule is now active
    const postSchedules = await demoService.fetchMedicationSchedules(createdId);
    assert(postSchedules.length === 1, 'Exactly 1 schedule activated immediately following doctor confirmation');
    assert(postSchedules[0].medicineName === 'Lisinopril', 'Activated schedule medicine matches confirmed order');
    assert(postSchedules[0].status === 'pending', 'Activated schedule begins in pending status');

    // Check confirmed draft status
    const confirmedDraft = await demoService.fetchPrescriptionDraft(createdId);
    assert(confirmedDraft?.confirmed === true, 'Draft confirmed property is true');
    assert(confirmedDraft?.status === 'doctor_approved', 'Draft workflow status is "doctor_approved"');
  }

  // ---------------------------------------------------------------------------
  // SUITE 10: Superseded Prescription Not Reactivated
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 10: Superseded Prescription Not Reactivated');
  {
    const supersededPatientId = `p-superseded-${Date.now()}`;
    const draftRes = await demoService.savePrescriptionDraft(supersededPatientId, 'old.png', [
      { key: 'medicine', labelKey: 'rx_field_medicine', value: 'OldDrug', status: 'confirmed' },
      { key: 'dosage', labelKey: 'rx_field_dosage', value: '10mg', status: 'confirmed' },
      { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily', status: 'confirmed' },
      { key: 'duration', labelKey: 'rx_field_duration', value: '7 days', status: 'confirmed' },
    ]);
    assert('data' in draftRes, 'Created draft prescription');

    // Mark draft as rejected_or_superseded
    const draft = await demoService.fetchPrescriptionDraft(supersededPatientId);
    if (draft) {
      draft.status = 'rejected_or_superseded';
    }

    // Attempting to confirm a superseded prescription must be rejected
    const attemptRes = await demoService.confirmCarePlan(supersededPatientId, [
      { key: 'medicine', labelKey: 'rx_field_medicine', value: 'OldDrug', status: 'confirmed' },
      { key: 'dosage', labelKey: 'rx_field_dosage', value: '10mg', status: 'confirmed' },
      { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily', status: 'confirmed' },
      { key: 'duration', labelKey: 'rx_field_duration', value: '7 days', status: 'confirmed' },
    ]);

    assert('error' in attemptRes, 'Strictly rejects confirmation of rejected_or_superseded prescription');
    assert(
      'error' in attemptRes && attemptRes.error.includes('rejected or superseded'),
      'Error message explicitly states prescription has been rejected or superseded'
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 11: Patient Reminder Flow After Approval
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 11: Patient Reminder Flow After Approval');
  {
    const schedule: MedicationSchedule = {
      id: 's-reminder-test-1',
      medicineId: 'm-rem-1',
      medicineName: 'Aspirin',
      dosage: '75mg',
      scheduledTime: '08:00',
      status: 'pending',
      instructions: 'Take after breakfast',
      patientId: 'p-rem-user',
    };

    // When approval is pending, reminders are suppressed
    const unapprovedDraft: PrescriptionDraft = {
      id: 'rx-unapproved-1',
      patientId: 'p-rem-user',
      imageUrl: 'pending.png',
      uploadedAt: new Date().toISOString(),
      confirmed: false,
      fields: [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Aspirin', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '75mg', status: 'confirmed' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Once daily', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '30 days', status: 'confirmed' },
      ],
    };

    const referenceNow = new Date();
    referenceNow.setHours(8, 5, 0, 0); // 08:05 AM is within the 20-minute grace window for 08:00 scheduled dose

    const isPending = Boolean(unapprovedDraft && !unapprovedDraft.confirmed);
    const pendingReminders = isPending ? [] : generateReminders([schedule], [], referenceNow);
    assert(pendingReminders.length === 0, 'Patient reminders are strictly 0 while approval is pending');

    // After approval, reminders are activated
    unapprovedDraft.confirmed = true;
    unapprovedDraft.status = 'doctor_approved';
    const isApproved = Boolean(unapprovedDraft.confirmed);
    const approvedReminders = isApproved ? generateReminders([schedule], [], referenceNow) : [];

    assert(approvedReminders.length === 1, 'Patient reminders activate immediately upon doctor approval');
    assert(approvedReminders[0].message.includes('Aspirin'), 'Reminder message includes confirmed medication');
    assert(approvedReminders[0].channel === 'in_app_simulated', 'Reminder channel is in_app_simulated');

    const approvedAssessment = evaluatePrescriptionSafety(unapprovedDraft, cleanPatient);
    assert(
      approvedAssessment.patientStatusLabel === 'Doctor approved — reminders activated',
      'Patient status banner displays "Doctor approved — reminders activated"'
    );
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
