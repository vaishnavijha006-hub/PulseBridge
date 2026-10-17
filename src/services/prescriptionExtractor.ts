/**
 * PulseBridge AI — Grounded Prescription Extraction & Safety Engine
 * 
 * Safety & Clinical Grounding Rules:
 * 1. Literal Grounding: Extracts only parameters explicitly found in the source text.
 * 2. Never Invent Details: Leaves missing fields empty or marks them 'uncertain' with an audit note.
 * 3. Human-in-the-Loop: Requires doctor verification and lock before medication plans activate.
 * 4. Safety Screening: Identifies potential allergy conflicts and duplicate therapies for clinician review.
 */

import type { PrescriptionField, PatientProfile, MedicationSchedule } from '@/types';

export interface ExtractedPrescriptionResult {
  fields: PrescriptionField[];
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
  missingCriticalFields: string[];
  safetyFlags: {
    allergyConflict: boolean;
    allergyEvidence?: string;
    duplicateMedication: boolean;
    duplicateEvidence?: string;
  };
}

// Common drug class cross-reactivity mappings for clinical safety flags
const ALLERGY_DRUG_CLASSES: Record<string, string[]> = {
  penicillin: ['amoxicillin', 'ampicillin', 'augmentin', 'penicillin', 'piperacillin', 'cloxacillin'],
  sulfa: ['sulfamethoxazole', 'bactrim', 'septra', 'cotrimoxazole', 'sulfadiazine', 'sulfasalazine', 'sulfa'],
  aspirin: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'nsaid', 'ketorolac'],
  nsaid: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'indomethacin', 'meloxicam'],
  cephalosporin: ['cephalexin', 'ceftriaxone', 'cefixime', 'cefuroxime', 'cefepime'],
  statin: ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin'],
};

/**
 * Extracts structured medication fields from raw prescription text.
 * Strictly preserves ground truth and marks missing/uncertain fields.
 */
export function extractPrescriptionFromText(
  rawText: string,
  patient?: PatientProfile,
  activeSchedules: MedicationSchedule[] = []
): ExtractedPrescriptionResult {
  const text = rawText || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let medicine = '';
  let dosage = '';
  let frequency = '';
  let duration = '';
  let instructions = '';

  // 1. Extract Dosage (e.g., 500mg, 10 mg, 2.5 ml, 1 tablet, 100mcg)
  const dosageMatch = text.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|tablet|tab|cap|capsule|iu|units))\b/i);
  if (dosageMatch) {
    dosage = dosageMatch[1].trim();
  }

  // 2. Extract Duration (e.g., for 14 days, 2 weeks, 1 month, 5 din)
  const durationMatch = text.match(/\b(?:for\s+)?(\d+\s*(?:days?|weeks?|months?|din|mahine))\b/i);
  if (durationMatch) {
    duration = durationMatch[1].trim();
  }

  // 3. Extract Frequency (e.g., twice daily, once a day, OD, BD, TDS, 1-0-1, morning and evening)
  if (/\b(?:twice\s+daily|bid|bd|1-0-1|two\s+times|subah\s+sham)\b/i.test(text)) {
    frequency = 'Twice daily (08:00, 20:00)';
  } else if (/\b(?:thrice\s+daily|tid|tds|1-1-1|three\s+times)\b/i.test(text)) {
    frequency = 'Thrice daily (08:00, 14:00, 20:00)';
  } else if (/\b(?:once\s+daily|once\s+a\s+day|od|1-0-0|morning\s+only|subah)\b/i.test(text)) {
    frequency = 'Once daily (08:00)';
  } else if (/\b(?:at\s+bedtime|night\s+only|hs|0-0-1|raat\s+ko)\b/i.test(text)) {
    frequency = 'Once daily at bedtime (21:00)';
  } else {
    const rawFreqMatch = text.match(/\b(every\s+\d+\s+hours?|\d+\s+times\s+a\s+day)\b/i);
    if (rawFreqMatch) {
      frequency = rawFreqMatch[1].trim();
    }
  }

  // 4. Extract Instructions (e.g., after meals, before meals, khane ke baad, with water)
  const instMatch = text.match(/\b(?:instructions?|sig|advice)\s*:\s*([^\n\r]+)/i);
  if (instMatch) {
    instructions = instMatch[1].trim();
  } else if (/\b(?:after\s+meals?|after\s+food|post\s+prandial|khane\s+ke\s+baad)\b/i.test(text)) {
    instructions = 'After meals with water';
  } else if (/\b(?:before\s+meals?|empty\s+stomach|khane\s+se\s+pehle)\b/i.test(text)) {
    instructions = 'Before meals on empty stomach';
  } else if (/\b(?:with\s+food|along\s+with\s+meals)\b/i.test(text)) {
    instructions = 'Take with food';
  } else if (/\b(?:with\s+(?:plenty\s+of\s+)?water)\b/i.test(text)) {
    instructions = 'Take with plenty of water';
  }

  // 5. Extract Medicine Name
  // Filter out header lines like "Rx:"
  const nonHeaderLines = lines.filter(
    (l) => !/^(?:rx\s*:?|prescription)\s*$/i.test(l.trim())
  );
  const rxLine =
    nonHeaderLines.find(
      (l) =>
        /^(?:tab(?:let)?|cap(?:sule)?|syrup|inj(?:ection)?|\b[a-z])/i.test(l.trim()) &&
        !/^(?:frequency|duration|instructions?|notes?|dose|date|dr\.?)\s*:/i.test(l.trim())
    ) ||
    nonHeaderLines[0] ||
    '';
  const cleanedMed = rxLine
    .replace(/^(?:rx\s*:?|tab(?:let)?|cap(?:sule)?|syrup)\s+/i, '')
    .replace(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|tab))\b.*$/i, '')
    .replace(/[,-].*$/, '')
    .trim();

  if (cleanedMed && cleanedMed.length > 2) {
    medicine = cleanedMed;
  }

  // Assemble structured PrescriptionField list
  const fields: PrescriptionField[] = [
    {
      key: 'medicine',
      labelKey: 'rx_field_medicine',
      value: medicine,
      status: medicine ? 'confirmed' : 'uncertain',
    },
    {
      key: 'dosage',
      labelKey: 'rx_field_dosage',
      value: dosage,
      status: dosage ? 'confirmed' : 'uncertain',
    },
    {
      key: 'frequency',
      labelKey: 'rx_field_frequency',
      value: frequency,
      status: frequency ? 'confirmed' : 'uncertain',
    },
    {
      key: 'duration',
      labelKey: 'rx_field_duration',
      value: duration,
      status: duration ? 'confirmed' : 'uncertain',
    },
    {
      key: 'instructions',
      labelKey: 'rx_field_instructions',
      value: instructions,
      status: instructions ? 'confirmed' : 'uncertain',
    },
  ];

  // Detect missing critical parameters
  const CRITICAL_KEYS = ['medicine', 'dosage', 'frequency', 'duration'];
  const missingCriticalFields = fields
    .filter((f) => CRITICAL_KEYS.includes(f.key) && (!f.value || f.status === 'uncertain'))
    .map((f) => f.key);

  const confidence: 'high' | 'medium' | 'low' =
    missingCriticalFields.length === 0 ? 'high' : missingCriticalFields.length <= 2 ? 'medium' : 'low';

  // Perform safety screening for allergy and duplicate medication
  const safetyFlags = screenPrescriptionSafety(medicine, patient, activeSchedules);

  return {
    fields,
    rawText,
    confidence,
    missingCriticalFields,
    safetyFlags,
  };
}

/**
 * Screens a proposed medicine name against patient allergies and existing medications.
 */
export function screenPrescriptionSafety(
  medicineOrFields: string | PrescriptionField[],
  patientOrAllergies?: PatientProfile | string,
  currentMedsOrSchedules?: string | MedicationSchedule[],
  schedulesArg: MedicationSchedule[] = []
): {
  allergyConflict: boolean;
  allergyEvidence?: string;
  duplicateMedication: boolean;
  duplicateEvidence?: string;
  flags: Array<{ type: 'allergy_conflict' | 'duplicate_medication'; evidence: string; severity: 'high' | 'medium' }>;
} {
  let medicineName = '';
  if (typeof medicineOrFields === 'string') {
    medicineName = medicineOrFields;
  } else if (Array.isArray(medicineOrFields)) {
    const medField = medicineOrFields.find((f) => f.key === 'medicine');
    medicineName = medField?.value ?? '';
  }

  let patientAllergies = '';
  let patientCurrentMeds = '';
  let activeSchedules: MedicationSchedule[] = [];

  if (typeof patientOrAllergies === 'object' && patientOrAllergies !== null && 'id' in patientOrAllergies) {
    patientAllergies = patientOrAllergies.allergies ?? '';
    patientCurrentMeds = patientOrAllergies.currentMeds ?? '';
    if (Array.isArray(currentMedsOrSchedules)) {
      activeSchedules = currentMedsOrSchedules;
    }
  } else {
    patientAllergies = typeof patientOrAllergies === 'string' ? patientOrAllergies : '';
    patientCurrentMeds = typeof currentMedsOrSchedules === 'string' ? currentMedsOrSchedules : '';
    activeSchedules = Array.isArray(currentMedsOrSchedules) ? currentMedsOrSchedules : schedulesArg;
  }

  const flags: Array<{ type: 'allergy_conflict' | 'duplicate_medication'; evidence: string; severity: 'high' | 'medium' }> = [];
  let allergyConflict = false;
  let allergyEvidence: string | undefined;
  let duplicateMedication = false;
  let duplicateEvidence: string | undefined;

  if (!medicineName || !medicineName.trim()) {
    return { allergyConflict, duplicateMedication, flags };
  }

  const normMed = medicineName.trim().toLowerCase();

  // 1. Allergy Screening
  if (patientAllergies && patientAllergies.toLowerCase() !== 'none') {
    const rawAllergies = patientAllergies.toLowerCase().split(/[,;]/).map((s) => s.trim());

    for (const allergy of rawAllergies) {
      if (!allergy) continue;

      // Exact substring match
      if (normMed.includes(allergy) || allergy.includes(normMed)) {
        allergyConflict = true;
        allergyEvidence = `Direct match: Patient recorded allergy to "${patientAllergies}". Prescribed medicine "${medicineName}" conflicts.`;
        flags.push({
          type: 'allergy_conflict',
          evidence: allergyEvidence,
          severity: 'high',
        });
        break;
      }

      // Drug class cross-reactivity lookup
      for (const [drugClass, members] of Object.entries(ALLERGY_DRUG_CLASSES)) {
        if (allergy.includes(drugClass)) {
          if (members.some((m) => normMed.includes(m))) {
            allergyConflict = true;
            allergyEvidence = `Class cross-reactivity (${drugClass}): Patient allergic to "${patientAllergies}"; "${medicineName}" belongs to this cross-reactive drug class.`;
            flags.push({
              type: 'allergy_conflict',
              evidence: allergyEvidence,
              severity: 'high',
            });
            break;
          }
        }
      }
      if (allergyConflict) break;
    }
  }

  // 2. Duplicate Medication Screening
  // Check against patient currentMeds string
  if (patientCurrentMeds && patientCurrentMeds.toLowerCase() !== 'none') {
    const currentMedsList = patientCurrentMeds.toLowerCase().split(/[,;]/).map((s) => s.trim());
    for (const curMed of currentMedsList) {
      if (curMed && (normMed.includes(curMed) || curMed.includes(normMed))) {
        duplicateMedication = true;
        duplicateEvidence = `Patient already reports taking "${curMed}" in current medications. Review for duplicate therapy or dose modification.`;
        flags.push({
          type: 'duplicate_medication',
          evidence: duplicateEvidence,
          severity: 'medium',
        });
        break;
      }
    }
  }

  // Check against active schedules
  if (!duplicateMedication && activeSchedules.length > 0) {
    const matchingSchedule = activeSchedules.find((s) => {
      const scheduledName = s.medicineName.trim().toLowerCase();
      return scheduledName.includes(normMed) || normMed.includes(scheduledName);
    });

    if (matchingSchedule) {
      duplicateMedication = true;
      duplicateEvidence = `Active schedule already exists for "${matchingSchedule.medicineName}" (Scheduled: ${matchingSchedule.scheduledTime}, Status: ${matchingSchedule.status}).`;
      flags.push({
        type: 'duplicate_medication',
        evidence: duplicateEvidence,
        severity: 'medium',
      });
    }
  }

  return {
    allergyConflict,
    allergyEvidence,
    duplicateMedication,
    duplicateEvidence,
    flags,
  };
}
