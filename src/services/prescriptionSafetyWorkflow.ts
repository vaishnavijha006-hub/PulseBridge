/**
 * PulseBridge AI — Intelligent Prescription Safety & Auto-Readiness Workflow Engine
 * File: src/services/prescriptionSafetyWorkflow.ts
 *
 * Requirements:
 * 1. Validate prescription drafts against patient context (allergies, schedules, previous Rx, recency).
 * 2. If data is unavailable, strictly mark check as 'unknown', not 'passed'.
 * 3. Never treat previous prescriptions as current without checking their status and date.
 * 4. Explicit workflow states: needs_review, uncertain_fields, allergy_alert, prescription_conflict,
 *    ready_for_doctor_review, doctor_approved, rejected_or_superseded.
 * 5. Meaningful patient status labels (Requirement 6).
 * 6. Doctor dashboard in-app notifications with honest delivery status (Requirement 5).
 * 7. Doctor Lock gating: Block confirmation until critical fields, allergy alerts, and conflicts are resolved.
 */

import type {
  PrescriptionDraft,
  PrescriptionField,
  PatientProfile,
  MedicationSchedule,
  PrescriptionWorkflowState,
  PrescriptionSafetyAssessment,
  DoctorNotification,
} from '@/types';

// Common drug class cross-reactivity mappings for clinical safety flags
const ALLERGY_DRUG_CLASSES: Record<string, string[]> = {
  penicillin: ['amoxicillin', 'ampicillin', 'augmentin', 'penicillin', 'piperacillin', 'cloxacillin'],
  sulfa: ['sulfamethoxazole', 'bactrim', 'septra', 'cotrimoxazole', 'sulfadiazine', 'sulfasalazine', 'sulfa'],
  aspirin: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'nsaid', 'ketorolac', 'indomethacin'],
  nsaid: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'indomethacin', 'meloxicam', 'ketorolac'],
  cephalosporin: ['cephalexin', 'ceftriaxone', 'cefixime', 'cefuroxime', 'cefepime'],
  statin: ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin'],
};

const CRITICAL_KEYS = ['medicine', 'dosage', 'frequency', 'duration'] as const;

export interface EvaluatePrescriptionSafetyOptions {
  acknowledgedAllergy?: boolean;
  acknowledgedConflict?: boolean;
}

/**
 * Evaluates prescription draft against patient context and produces a structured safety assessment.
 */
export function evaluatePrescriptionSafety(
  draft: PrescriptionDraft,
  patient?: PatientProfile | null,
  activeSchedules: MedicationSchedule[] = [],
  previousPrescriptions: PrescriptionDraft[] = [],
  options?: EvaluatePrescriptionSafetyOptions
): PrescriptionSafetyAssessment {
  const fields = draft.fields || [];
  const blockingReasons: string[] = [];
  const notifications: DoctorNotification[] = [];

  const medField = fields.find((f) => f.key === 'medicine');
  const dosageField = fields.find((f) => f.key === 'dosage');
  const freqField = fields.find((f) => f.key === 'frequency');
  const durField = fields.find((f) => f.key === 'duration');

  const medicineName = medField?.value?.trim() || '';
  const normMed = medicineName.toLowerCase();

  // ---------------------------------------------------------------------------
  // CHECK 1: Critical Fields (Medicine, Dosage, Frequency, Duration)
  // ---------------------------------------------------------------------------
  const missingCritical: string[] = [];
  const uncertainCritical: string[] = [];

  for (const critKey of CRITICAL_KEYS) {
    const f = fields.find((item) => item.key === critKey);
    if (!f || !f.value || !f.value.trim()) {
      missingCritical.push(critKey);
    } else if (f.status === 'uncertain') {
      uncertainCritical.push(critKey);
    }
  }

  let criticalFieldsStatus: 'passed' | 'alert' | 'unknown' = 'passed';
  let criticalFieldsEvidence = 'All critical prescription parameters (medicine, dosage, frequency, duration) are present and legibly verified.';

  if (missingCritical.length > 0 || uncertainCritical.length > 0) {
    criticalFieldsStatus = 'alert';
    const missingDesc = missingCritical.length > 0 ? `Missing: [${missingCritical.join(', ')}]` : '';
    const uncertainDesc = uncertainCritical.length > 0 ? `Uncertain/Unverified: [${uncertainCritical.join(', ')}]` : '';
    criticalFieldsEvidence = `Critical parameter validation failure: ${[missingDesc, uncertainDesc].filter(Boolean).join('; ')}. Hand-written details require clinician review.`;
    blockingReasons.push(criticalFieldsEvidence);

    // Doctor notification for unreadable or missing instructions
    notifications.push({
      id: `notif-unreadable-${draft.id}-${Date.now()}`,
      patientId: draft.patientId,
      prescriptionId: draft.id,
      type: 'unreadable_fields',
      severity: 'high',
      title: 'Unreadable or Missing Prescription Parameters',
      message: `Prescription requires doctor review: ${[missingDesc, uncertainDesc].filter(Boolean).join('; ')}`,
      evidence: criticalFieldsEvidence,
      createdAt: new Date().toISOString(),
      channel: 'in_app_simulated',
      externalDeliveryAttempted: false,
      externalDeliveryStatus: 'not_configured',
      externalDeliveryReason: 'External email/SMS/push delivery gateway is not configured; alert presented in-app.',
      read: false,
    });
  }

  // ---------------------------------------------------------------------------
  // CHECK 2: Known Allergies & Documented Reactions
  // ---------------------------------------------------------------------------
  let allergyStatus: 'passed' | 'alert' | 'unknown' = 'passed';
  let matchedAllergy: string | undefined;
  let allergyEvidence = 'No documented allergy conflicts detected with prescribed medication.';

  const rawAllergyStr = (patient?.allergies || '').trim().toLowerCase();
  if (
    patient === undefined ||
    patient === null ||
    patient.allergies === undefined ||
    patient.allergies === null ||
    !rawAllergyStr ||
    rawAllergyStr === 'unknown' ||
    rawAllergyStr === 'not_sure'
  ) {
    allergyStatus = 'unknown';
    allergyEvidence = 'Patient allergy history is unverified or unknown ("unknown"). Clinical verification required before schedule activation.';
  } else if (
    rawAllergyStr === 'no_known_allergies' ||
    rawAllergyStr === 'none' ||
    rawAllergyStr === 'no known allergies' ||
    rawAllergyStr === 'no allergies'
  ) {
    allergyStatus = 'passed';
    allergyEvidence = 'Patient has no documented drug allergies on file ("No known allergies").';
  } else if (normMed) {
    const rawAllergies = patient.allergies.toLowerCase().split(/[,;]/).map((s) => s.trim());
    let isConflict = false;

    for (const allergy of rawAllergies) {
      if (!allergy) continue;
      // Exact / substring match
      if (normMed.includes(allergy) || allergy.includes(normMed)) {
        isConflict = true;
        matchedAllergy = allergy;
        break;
      }
      // Drug class cross-reactivity match
      for (const [cls, members] of Object.entries(ALLERGY_DRUG_CLASSES)) {
        if (allergy.includes(cls)) {
          if (members.some((m) => normMed.includes(m))) {
            isConflict = true;
            matchedAllergy = `${allergy} (${cls} class cross-reaction)`;
            break;
          }
        }
      }
      if (isConflict) break;
    }

    if (isConflict) {
      allergyStatus = 'alert';
      allergyEvidence = `Known allergy match: Patient has documented allergy to "${patient.allergies}". Prescribed medication "${medicineName}" poses potential adverse reaction risk.`;
      if (!options?.acknowledgedAllergy) {
        blockingReasons.push(allergyEvidence);
      }

      notifications.push({
        id: `notif-allergy-${draft.id}-${Date.now()}`,
        patientId: draft.patientId,
        prescriptionId: draft.id,
        type: 'allergy_match',
        severity: 'high',
        title: 'Documented Drug Allergy Conflict',
        message: `High risk: "${medicineName}" conflicts with patient allergy "${patient.allergies}".`,
        evidence: allergyEvidence,
        createdAt: new Date().toISOString(),
        channel: 'in_app_simulated',
        externalDeliveryAttempted: false,
        externalDeliveryStatus: 'not_configured',
        externalDeliveryReason: 'External email/SMS/push delivery gateway is not configured; alert presented in-app.',
        read: false,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // CHECK 3: Duplicate Medicines & Active Medication Schedules
  // ---------------------------------------------------------------------------
  let duplicateStatus: 'passed' | 'alert' | 'unknown' = 'passed';
  let duplicateName: string | undefined;
  let duplicateEvidence = 'No duplicate active medication therapies found in patient care plan.';

  // If patient medication context is unavailable and active schedules are empty, mark unknown
  if (
    (patient === undefined || patient === null || patient.currentMeds === undefined || patient.currentMeds === null) &&
    activeSchedules.length === 0
  ) {
    duplicateStatus = 'unknown';
    duplicateEvidence = 'Active medication records and patient medication history unavailable. Duplicate check status unknown.';
  } else if (normMed) {
    // Check against active medication schedules
    const existingScheduleMatch = activeSchedules.find((s) => {
      const sName = (s.medicineName || '').toLowerCase().trim();
      return sName && (sName.includes(normMed) || normMed.includes(sName));
    });

    // Check against patient currentMeds
    const currentMedsText = patient?.currentMeds?.toLowerCase() || '';
    const currentMedsMatch =
      currentMedsText &&
      currentMedsText !== 'none' &&
      (currentMedsText.includes(normMed) || normMed.includes(currentMedsText.split(',')[0].trim()));

    if (existingScheduleMatch || currentMedsMatch) {
      duplicateStatus = 'alert';
      duplicateName = existingScheduleMatch?.medicineName || medicineName;
      duplicateEvidence = existingScheduleMatch
        ? `Duplicate therapy: Patient already has an active medication schedule for "${existingScheduleMatch.medicineName}" (${existingScheduleMatch.dosage}).`
        : `Duplicate therapy: Patient's current medications list includes "${patient?.currentMeds}".`;
      if (!options?.acknowledgedConflict) {
        blockingReasons.push(duplicateEvidence);
      }

      notifications.push({
        id: `notif-duplicate-${draft.id}-${Date.now()}`,
        patientId: draft.patientId,
        prescriptionId: draft.id,
        type: 'duplicate_medication',
        severity: 'medium',
        title: 'Possible Duplicate Medication Therapy',
        message: `Prescribed "${medicineName}" duplicates existing active medication "${duplicateName}".`,
        evidence: duplicateEvidence,
        createdAt: new Date().toISOString(),
        channel: 'in_app_simulated',
        externalDeliveryAttempted: false,
        externalDeliveryStatus: 'not_configured',
        externalDeliveryReason: 'External email/SMS/push delivery gateway is not configured; alert presented in-app.',
        read: false,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // CHECK 4: Previous Prescriptions & Conflict / Superseded Context
  // ---------------------------------------------------------------------------
  let conflictStatus: 'passed' | 'alert' | 'unknown' = 'passed';
  let conflictingRxId: string | undefined;
  let conflictEvidence = 'No conflicting prior prescriptions identified.';

  if (previousPrescriptions.length > 0 && normMed) {
    for (const prevRx of previousPrescriptions) {
      if (prevRx.id === draft.id) continue;

      // Rule: Do NOT treat superseded or rejected prescriptions as active conflicts!
      if (prevRx.status === 'rejected_or_superseded') {
        continue;
      }

      const prevMed = prevRx.fields.find((f) => f.key === 'medicine')?.value?.toLowerCase().trim() || '';
      const prevDosage = prevRx.fields.find((f) => f.key === 'dosage')?.value?.trim() || '';

      if (prevMed && (prevMed.includes(normMed) || normMed.includes(prevMed))) {
        // If the previous prescription is confirmed and has a different dosage or instructions, flag conflict
        const currDosage = dosageField?.value?.trim() || '';
        if (prevRx.confirmed && prevDosage && currDosage && prevDosage !== currDosage) {
          conflictStatus = 'alert';
          conflictingRxId = prevRx.id;
          conflictEvidence = `Prescription conflict: Prior confirmed prescription (${prevRx.id}) ordered "${prevMed}" at ${prevDosage}, whereas new draft orders ${currDosage}. Requires doctor reconciliation.`;
          if (!options?.acknowledgedConflict) {
            blockingReasons.push(conflictEvidence);
          }

          notifications.push({
            id: `notif-conflict-${draft.id}-${Date.now()}`,
            patientId: draft.patientId,
            prescriptionId: draft.id,
            type: 'prescription_conflict',
            severity: 'high',
            title: 'Conflicting Previous Prescription Detected',
            message: `Conflicting dosage between new prescription (${currDosage}) and prior Rx (${prevDosage}).`,
            evidence: conflictEvidence,
            createdAt: new Date().toISOString(),
            channel: 'in_app_simulated',
            externalDeliveryAttempted: false,
            externalDeliveryStatus: 'not_configured',
            externalDeliveryReason: 'External email/SMS/push delivery gateway is not configured; alert presented in-app.',
            read: false,
          });
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // CHECK 5: Prescription Recency & Date Check
  // ---------------------------------------------------------------------------
  let recencyStatus: 'passed' | 'alert' | 'unknown' = 'passed';
  const rxDateField = fields.find((f) => f.key === 'prescription_date');
  const rxDateStr = rxDateField?.value?.trim() || draft.prescriptionDate;
  let isExpired = false;
  let recencyEvidence = 'Prescription date is valid and within active clinical timeframe.';

  if (!rxDateStr) {
    recencyStatus = 'unknown';
    recencyEvidence = 'Prescription date is not explicitly visible or readable on document. Context undated.';
  } else {
    const parsedDate = new Date(rxDateStr);
    if (!isNaN(parsedDate.getTime())) {
      const daysOld = (Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld > 180) {
        // Prescription older than 6 months is potentially expired
        recencyStatus = 'alert';
        isExpired = true;
        recencyEvidence = `Prescription dated ${rxDateStr} is older than 180 days (${Math.floor(daysOld)} days). Clinician verification required.`;
        blockingReasons.push(recencyEvidence);

        notifications.push({
          id: `notif-expired-${draft.id}-${Date.now()}`,
          patientId: draft.patientId,
          prescriptionId: draft.id,
          type: 'validation_failure',
          severity: 'medium',
          title: 'Potentially Expired or Stale Prescription',
          message: `Prescription dated ${rxDateStr} is over 6 months old.`,
          evidence: recencyEvidence,
          createdAt: new Date().toISOString(),
          channel: 'in_app_simulated',
          externalDeliveryAttempted: false,
          externalDeliveryStatus: 'not_configured',
          externalDeliveryReason: 'External email/SMS/push delivery gateway is not configured; alert presented in-app.',
          read: false,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // WORKFLOW STATE ASSIGNMENT
  // ---------------------------------------------------------------------------
  let workflowState: PrescriptionWorkflowState;

  if (draft.confirmed) {
    workflowState = 'doctor_approved';
  } else if (draft.status === 'rejected_or_superseded') {
    workflowState = 'rejected_or_superseded';
  } else if (allergyStatus === 'alert') {
    workflowState = 'allergy_alert';
  } else if (duplicateStatus === 'alert' || conflictStatus === 'alert') {
    workflowState = 'prescription_conflict';
  } else if (criticalFieldsStatus === 'alert') {
    workflowState = 'uncertain_fields';
  } else if (allergyStatus === 'unknown' || duplicateStatus === 'unknown') {
    workflowState = 'needs_review';
  } else {
    // Only transitions to ready_for_doctor_review when all critical fields are valid and no unhandled alerts exist
    workflowState = 'ready_for_doctor_review';
  }

  // ---------------------------------------------------------------------------
  // PATIENT UI STATUS LABEL MAPPING (Requirement 6)
  // ---------------------------------------------------------------------------
  let patientStatusLabel: string;
  switch (workflowState) {
    case 'doctor_approved':
      patientStatusLabel = 'Doctor approved — reminders activated';
      break;
    case 'uncertain_fields':
      // Differentiate if dosage is the specific unclear field
      if (uncertainCritical.includes('dosage') || missingCritical.includes('dosage')) {
        patientStatusLabel = 'Doctor review required — unclear dosage';
      } else {
        patientStatusLabel = 'Doctor review required — unclear parameters';
      }
      break;
    case 'allergy_alert':
      patientStatusLabel = 'Doctor review required — possible allergy conflict';
      break;
    case 'prescription_conflict':
      patientStatusLabel = 'Prescription conflict detected — schedule paused';
      break;
    case 'rejected_or_superseded':
      patientStatusLabel = 'Prescription superseded — not active';
      break;
    case 'ready_for_doctor_review':
    case 'needs_review':
    default:
      patientStatusLabel = 'Prescription extracted — awaiting doctor approval';
      break;
  }

  // Doctor alert banner message
  let doctorAlertMessage: string | undefined;
  if (workflowState === 'allergy_alert') {
    doctorAlertMessage = `CRITICAL ALLERGY ALERT: Patient allergy to "${patient?.allergies}" conflicts with "${medicineName}".`;
  } else if (workflowState === 'prescription_conflict') {
    doctorAlertMessage = conflictStatus === 'alert' ? conflictEvidence : duplicateEvidence;
  } else if (workflowState === 'uncertain_fields') {
    doctorAlertMessage = criticalFieldsEvidence;
  }

  const canDoctorApprove = blockingReasons.length === 0;

  return {
    workflowState,
    patientStatusLabel,
    doctorAlertMessage,
    canDoctorApprove,
    blockingReasons,
    checks: {
      criticalFields: {
        status: criticalFieldsStatus,
        missing: missingCritical,
        uncertain: uncertainCritical,
        evidence: criticalFieldsEvidence,
      },
      allergies: {
        status: allergyStatus,
        matchedAllergy,
        evidence: allergyEvidence,
      },
      duplicateMeds: {
        status: duplicateStatus,
        duplicateName,
        evidence: duplicateEvidence,
      },
      conflictingPrescriptions: {
        status: conflictStatus,
        conflictingRxId,
        evidence: conflictEvidence,
      },
      prescriptionRecency: {
        status: recencyStatus,
        prescriptionDate: rxDateStr,
        isExpired,
        evidence: recencyEvidence,
      },
    },
    notifications,
  };
}
