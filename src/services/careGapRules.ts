import type {
  CareGap,
  CareGapType,
  HealthUpdate,
  MedicationSchedule,
  FollowUp,
  PatientProfile,
  Priority,
} from '@/types';

export interface CareGapRuleResult {
  gaps: Omit<CareGap, 'id' | 'status'>[];
}

export interface QueueScoreFactor {
  rule?: string;
  reason: string;
  points: number;
  evidence: string;
}

export interface PatientTriageResult {
  score: number;
  priority: Priority;
  reasons: string[];
  factors: QueueScoreFactor[];
  criticalSafetyOverride: boolean;
  criticalAlertMessage?: string;
  disclaimer: string;
}

// Emergency red-flag symptoms requiring immediate clinical override regardless of score
const EMERGENCY_SYMPTOM_PATTERNS = [
  /\b(chest pain|chest pressure|chest heaviness|chhati me dard|angina)\b/i,
  /\b(breathless(ness)?|shortness of breath|saans phoolna|dyspnea|difficulty breathing)\b/i,
  /\b(unconscious|fainted|behoshi|syncope)\b/i,
  /\b(severe bleeding|khun behna|hemorrhage)\b/i,
  /\b(stroke|facial droop|slurred speech)\b/i,
  /\b(anaphylaxis|swollen throat|severe allergy)\b/i,
];

/**
 * Detects clinically actionable CareGaps using deterministic safety rules.
 * Deduplicates to prevent generating multiple open gaps for the same event.
 */
export function detectCareGaps(
  patient: PatientProfile,
  healthUpdates: HealthUpdate[],
  schedules: MedicationSchedule[],
  followUps: FollowUp[],
  existingGaps: CareGap[] = []
): CareGapRuleResult {
  const gaps: Omit<CareGap, 'id' | 'status'>[] = [];

  const latestUpdate = healthUpdates[0];
  const missedDoses = schedules.filter(
    (s) => s.status === 'missed' || s.status === 'cannot_take'
  );

  // 1. New / Worsening symptom reported
  if (latestUpdate && latestUpdate.state === 'bad') {
    gaps.push({
      patientId: patient.id,
      type: 'new_symptom',
      severity: 'high',
      evidence: `New or worsening symptom reported: "${latestUpdate.symptomDescription || 'Feeling unwell'}"`,
      timestamp: latestUpdate.submittedAt,
      missingInfo: latestUpdate.symptomDescription
        ? 'Severity (1-10) and duration not specified'
        : 'Detailed symptom description needed',
      followupQuestion: 'Aapko kya takleef ho rahi hai? Kab se shuru hui?',
    });
  }

  // 2. Missing severity scale for symptoms
  if (latestUpdate && latestUpdate.symptomDescription && latestUpdate.state !== 'good') {
    const hasSeverity = /\b(severity|pain scale|\d+\s*\/\s*10|\b(mild|moderate|severe)\b)\b/i.test(
      latestUpdate.symptomDescription
    );
    if (!hasSeverity) {
      gaps.push({
        patientId: patient.id,
        type: 'missing_severity',
        severity: 'medium',
        evidence: `Symptom "${latestUpdate.symptomDescription}" reported without pain/severity rating`,
        timestamp: latestUpdate.submittedAt,
        missingInfo: 'Pain / discomfort scale (1-10)',
        followupQuestion: 'Lakshan 1 se 10 mein kitna tej hai?',
      });
    }
  }

  // 3. Repeated missed doses (2 or more in window)
  if (missedDoses.length >= 2) {
    const medNames = [...new Set(missedDoses.map((d) => d.medicineName))];
    const reasons = missedDoses
      .map((d) => d.reason)
      .filter(Boolean)
      .join('; ');

    gaps.push({
      patientId: patient.id,
      type: 'repeated_missed_dose',
      severity: 'high',
      evidence: `${missedDoses.length} missed doses recorded (${medNames.join(', ')})${reasons ? ` — Reasons: ${reasons}` : ''}`,
      timestamp: new Date().toISOString(),
      missingInfo: reasons ? null : 'Reason for non-adherence',
      followupQuestion: `Kya ${medNames[0]} lene mein koi takleef ya side effect hai?`,
    });
  }

  // 4. Unanswered follow-up (> 24 hours)
  const unansweredFollowUps = followUps.filter((f) => f.status === 'pending');
  for (const f of unansweredFollowUps) {
    const hoursSinceAsked = (Date.now() - new Date(f.askedAt).getTime()) / 3600000;
    if (hoursSinceAsked > 24) {
      gaps.push({
        patientId: patient.id,
        type: 'unanswered_followup',
        severity: 'medium',
        evidence: `Follow-up question unanswered for ${Math.floor(hoursSinceAsked)}h: "${f.question}"`,
        timestamp: new Date().toISOString(),
        missingInfo: 'Patient response',
        followupQuestion: f.question,
      });
    }
  }

  // 5. Overdue health update (> 24 hours)
  if (!latestUpdate) {
    gaps.push({
      patientId: patient.id,
      type: 'overdue_update',
      severity: 'low',
      evidence: 'No health update has been submitted since onboarding',
      timestamp: new Date().toISOString(),
      missingInfo: 'Current recovery status check-in',
      followupQuestion: 'Aaj aapki tabiyat kaisi hai?',
    });
  } else {
    const hoursSinceUpdate = (Date.now() - new Date(latestUpdate.submittedAt).getTime()) / 3600000;
    if (hoursSinceUpdate > 24) {
      gaps.push({
        patientId: patient.id,
        type: 'overdue_update',
        severity: 'low',
        evidence: `No health update recorded in ${Math.floor(hoursSinceUpdate)} hours`,
        timestamp: new Date().toISOString(),
        missingInfo: 'Current recovery status check-in',
        followupQuestion: 'Aaj aapki tabiyat kaisi hai?',
      });
    }
  }

  // 6. Allergy Conflict (with drug class cross-reactivity)
  if (patient.allergies && patient.allergies.toLowerCase() !== 'none') {
    const allergyMeds = patient.allergies.toLowerCase();
    const currentMedNames = schedules
      .map((s) => (s?.medicineName || '').toLowerCase().trim())
      .filter(Boolean);
    const drugClassAliases: Record<string, string[]> = {
      penicillin: ['amoxicillin', 'ampicillin', 'augmentin', 'penicillin', 'piperacillin'],
      sulfa: ['sulfamethoxazole', 'bactrim', 'septra', 'cotrimoxazole', 'sulfa'],
      aspirin: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'nsaid'],
    };

    for (const med of currentMedNames) {
      let isConflict = allergyMeds.includes(med) || med.includes(allergyMeds.split(',')[0].trim());
      if (!isConflict) {
        for (const [cls, members] of Object.entries(drugClassAliases)) {
          if (allergyMeds.includes(cls) && members.some((m) => med.includes(m))) {
            isConflict = true;
            break;
          }
        }
      }

      if (isConflict) {
        gaps.push({
          patientId: patient.id,
          type: 'allergy_conflict',
          severity: 'high',
          evidence: `Patient recorded allergy to "${patient.allergies}", current medicine "${med}" may conflict`,
          timestamp: new Date().toISOString(),
          missingInfo: 'Doctor clinical confirmation of medicine safety',
          followupQuestion: null,
        });
        break;
      }
    }
  }

  // 7. Duplicate Medication Check (count >= 2 for same normalized medication)
  const medCounts = schedules.reduce<Record<string, number>>((acc, s) => {
    if (!s?.medicineName) return acc;
    const norm = s.medicineName.trim().toLowerCase();
    acc[norm] = (acc[norm] || 0) + 1;
    return acc;
  }, {});

  for (const [med, count] of Object.entries(medCounts)) {
    if (count >= 2) {
      gaps.push({
        patientId: patient.id,
        type: 'duplicate_medicine',
        severity: 'high',
        evidence: `Multiple active schedules (${count}) detected for "${med}"`,
        timestamp: new Date().toISOString(),
        missingInfo: 'Doctor schedule verification',
        followupQuestion: null,
      });
      break;
    }
  }

  // Filter out gaps that already exist in an open status with matching type & evidence
  const deduplicatedGaps = gaps.filter(
    (newGap) =>
      !existingGaps.some(
        (eg) => eg.status === 'open' && eg.type === newGap.type && eg.evidence === newGap.evidence
      )
  );

  return { gaps: deduplicatedGaps };
}

/**
 * Transparent Prototype Heuristic for Doctor Queue Sorting.
 *
 * Scoring Rules:
 * - New or worsening symptom: +40
 * - Possible allergy / duplicate safety flag: +40
 * - 2 or more missed doses in 24–48h window: +30
 * - Missing symptom severity/duration: +20
 * - Unanswered follow-up (>24h): +15
 * - No health update for >24 hours: +10
 *
 * Thresholds:
 * - >= 80: Urgent Review
 * - 50–79: Needs Attention
 * - < 50: On Track
 *
 * Red-flag emergency symptoms trigger Urgent Review regardless of score.
 */
export function calculatePatientTriageScore(
  patient: PatientProfile,
  healthUpdates: HealthUpdate[],
  schedules: MedicationSchedule[],
  followUps: FollowUp[],
  careGaps: CareGap[] = []
): PatientTriageResult {
  let score = 0;
  const factors: QueueScoreFactor[] = [];
  const reasons: string[] = [];

  const latestUpdate = healthUpdates[0];
  const missedDoses = schedules.filter(
    (s) => s.status === 'missed' || s.status === 'cannot_take'
  );

  // 1. Critical safety emergency check (Red Flag override)
  let criticalSafetyOverride = false;
  let criticalAlertMessage: string | undefined;

  if (latestUpdate?.symptomDescription) {
    for (const pattern of EMERGENCY_SYMPTOM_PATTERNS) {
      if (pattern.test(latestUpdate.symptomDescription)) {
        criticalSafetyOverride = true;
        criticalAlertMessage = `CRITICAL ALERT: Emergency symptom detected ("${latestUpdate.symptomDescription}"). Immediate evaluation needed.`;
        break;
      }
    }
  }

  // Rule A: New or worsening symptom (+40)
  if (latestUpdate && latestUpdate.state === 'bad') {
    score += 40;
    factors.push({
      rule: 'new_symptom',
      reason: 'New or worsening symptom reported',
      points: 40,
      evidence: latestUpdate.symptomDescription || 'Patient reported feeling bad',
    });
    reasons.push('New/worsening symptom (+40)');
  }

  // Rule B: Allergy or duplicate safety flag (+40)
  const hasAllergyOrDuplicate = careGaps.some(
    (g) => g.status === 'open' && (g.type === 'allergy_conflict' || g.type === 'duplicate_medicine')
  );
  if (hasAllergyOrDuplicate) {
    score += 40;
    factors.push({
      rule: 'safety_flag',
      reason: 'Safety concern: Allergy conflict or duplicate medication',
      points: 40,
      evidence: careGaps.find((g) => g.type === 'allergy_conflict' || g.type === 'duplicate_medicine')?.evidence ?? 'Allergy conflict detected',
    });
    reasons.push('Safety flag / allergy conflict (+40)');
  }

  // Rule C: Two or more missed doses in 24–48-hour window (+30)
  if (missedDoses.length >= 2) {
    score += 30;
    const meds = [...new Set(missedDoses.map((d) => d.medicineName))].join(', ');
    factors.push({
      rule: 'repeated_missed_dose',
      reason: 'Two or more missed doses in recovery window',
      points: 30,
      evidence: `${missedDoses.length} doses missed (${meds})`,
    });
    reasons.push('Repeated missed doses (+30)');
  }

  // Rule D: Missing symptom severity/duration (+20)
  const hasMissingSeverityGap = careGaps.some((g) => g.status === 'open' && g.type === 'missing_severity');
  const hasUnratedSymptom = Boolean(
    latestUpdate?.symptomDescription &&
    latestUpdate.state !== 'good' &&
    !/\b(severity|pain scale|\d+\s*\/\s*10|\b(mild|moderate|severe)\b)\b/i.test(latestUpdate.symptomDescription)
  );
  if (hasMissingSeverityGap || hasUnratedSymptom) {
    score += 20;
    factors.push({
      rule: 'missing_severity',
      reason: 'Symptom reported without clinical severity/duration scale',
      points: 20,
      evidence: 'Missing 1-10 pain/discomfort rating',
    });
    reasons.push('Missing severity rating (+20)');
  }

  // Rule E: Unanswered follow-up (>24h) (+15)
  const hasUnanswered = followUps.some((f) => {
    if (f.status !== 'pending') return false;
    const hours = (Date.now() - new Date(f.askedAt).getTime()) / 3600000;
    return hours > 24;
  });
  if (hasUnanswered) {
    score += 15;
    factors.push({
      rule: 'unanswered_followup',
      reason: 'Follow-up question unanswered for more than 24 hours',
      points: 15,
      evidence: 'Pending clinical question',
    });
    reasons.push('Unanswered follow-up (>24h) (+15)');
  }

  // Rule F: No health update for > 24 hours (+10)
  if (!latestUpdate) {
    score += 10;
    factors.push({
      rule: 'overdue_update',
      reason: 'No health check-in submitted since enrollment',
      points: 10,
      evidence: 'Check-in overdue',
    });
    reasons.push('No health update (>24h) (+10)');
  } else {
    const hoursSinceUpdate = (Date.now() - new Date(latestUpdate.submittedAt).getTime()) / 3600000;
    if (hoursSinceUpdate > 24) {
      score += 10;
      factors.push({
        rule: 'overdue_update',
        reason: 'No health update recorded for > 24 hours',
        points: 10,
        evidence: `Last update ${Math.floor(hoursSinceUpdate)} hours ago`,
      });
      reasons.push('Overdue health update (+10)');
    }
  }

  // Priority categorization
  let priority: Priority;
  if (criticalSafetyOverride || score >= 80) {
    priority = 'urgent';
  } else if (score >= 50) {
    priority = 'needs_attention';
  } else {
    priority = 'on_track';
  }

  return {
    score,
    priority,
    reasons,
    factors,
    criticalSafetyOverride,
    criticalAlertMessage,
    disclaimer: 'Prototype queue-sorting heuristic only, not a medical risk prediction. Clinical judgment always supersedes score.',
  };
}

export const gapTypeLabels: Record<CareGapType, string> = {
  new_symptom: 'New Symptom Reported',
  missing_severity: 'Missing Severity Rating',
  repeated_missed_dose: 'Repeated Missed Dose',
  unanswered_followup: 'Unanswered Follow-up',
  overdue_update: 'Overdue Health Update',
  allergy_conflict: 'Allergy Conflict Flag',
  duplicate_medicine: 'Duplicate Medicine Warning',
};
