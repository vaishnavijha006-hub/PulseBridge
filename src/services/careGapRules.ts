import type {
  CareGap,
  CareGapType,
  HealthUpdate,
  MedicationSchedule,
  FollowUp,
  PatientProfile,
  Priority,
} from '@/types';
import type { CareAction } from '@/types/careAction';

export interface CareGapRuleResult {
  gaps: Omit<CareGap, 'id' | 'status'>[];
}

export interface QueueScoreFactor {
  rule?: string;
  reason: string;
  points: number;
  evidence: string;
}

export interface ScoringWeights {
  newSymptom: number;
  safetyFlag: number;
  repeatedMissedDoses: number;
  missingSeverity: number;
  unansweredFollowup: number;
  overdueUpdate: number;
  overdueCareTask: number;
  unresolvedCareGap: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  newSymptom: 40,
  safetyFlag: 40,
  repeatedMissedDoses: 30,
  missingSeverity: 20,
  unansweredFollowup: 15,
  overdueUpdate: 10,
  overdueCareTask: 20,
  unresolvedCareGap: 15,
};

export interface PatientTriageResult {
  score: number;
  priority: Priority;
  reasons: string[];
  factors: QueueScoreFactor[];
  criticalSafetyOverride: boolean;
  criticalAlertMessage?: string;
  dataWarnings: string[];
  disclaimer: string;
}

// Emergency red-flag symptoms requiring immediate clinical override regardless of score
export const EMERGENCY_SYMPTOM_PATTERNS = [
  /\b(chest pain|chest pressure|chest heaviness|chhati me dard|angina)\b/i,
  /\b(breathless(ness)?|shortness of breath|saans\s*(phool|fool)\w*|dyspnea|difficulty breathing)\b/i,
  /\b(unconscious|fainted|behoshi|syncope)\b/i,
  /\b(severe bleeding|khun behna|hemorrhage)\b/i,
  /\b(stroke|facial droop|slurred speech)\b/i,
  /\b(anaphylaxis|swollen throat|severe allergy)\b/i,
];

// Contextual triggers indicating that a symptom mention is negated, third-person, or informational
export const NEGATION_PATTERNS = [
  /\b(no|not|neither|nor|without|deny|denies|denied|don't have|do not have|does not have|doesn't have|free of|negative for|ruled out)\b/i,
  /\b(nahi|nhi|na)\b/i,
  /\b(absent|none|resolved|denied)\b/i,
];

export const THIRD_PARTY_OR_INFO_PATTERNS = [
  /\b(my father|my mother|my brother|my sister|my parent|my parents|my friend|my husband|my wife|my son|my daughter|father had|mother had|brother had|sister had|family history|dad had|mom had)\b/i,
  /\b(read an article|read about|watching|news about|documentary about|movie about|story about|article about|book about)\b/i,
  /\b(history of|past history|years ago|months ago|in \d{4})\b/i,
];

/**
 * Checks for affirmative emergency symptoms in patient narrative text.
 * Filters out negated phrases (e.g., "no chest pain"), third-person/family history, and informational references.
 * NOTE: Heuristic filter for doctor triage queue; not a clinically validated diagnostic engine.
 */
export function detectEmergencyOverride(text: string): {
  isEmergency: boolean;
  alertMessage?: string;
  matchedClause?: string;
} {
  if (!text || !text.trim()) {
    return { isEmergency: false };
  }

  // Split into clauses by punctuation or contrasting conjunctions
  const clauses = text
    .split(/(?:[.!?;,\n]|\b(?:but|however|except|yet|lekin|parantu|magar)\b)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    let matchesEmergency = false;
    for (const pattern of EMERGENCY_SYMPTOM_PATTERNS) {
      if (pattern.test(clause)) {
        matchesEmergency = true;
        break;
      }
    }

    if (matchesEmergency) {
      const isNegated = NEGATION_PATTERNS.some((p) => p.test(clause));
      const isThirdPartyOrInfo = THIRD_PARTY_OR_INFO_PATTERNS.some((p) => p.test(clause));

      if (!isNegated && !isThirdPartyOrInfo) {
        return {
          isEmergency: true,
          alertMessage: `CRITICAL ALERT: Emergency symptom detected ("${clause}"). Immediate evaluation needed.`,
          matchedClause: clause,
        };
      }
    }
  }

  return { isEmergency: false };
}


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
  const normPatientAllergy = (patient.allergies || '').trim().toLowerCase();
  const hasKnownDocumentedAllergies =
    Boolean(normPatientAllergy) &&
    normPatientAllergy !== 'none' &&
    normPatientAllergy !== 'no_known_allergies' &&
    normPatientAllergy !== 'no known allergies' &&
    normPatientAllergy !== 'unknown' &&
    normPatientAllergy !== 'not_sure';

  if (hasKnownDocumentedAllergies) {
    const allergyMeds = normPatientAllergy;
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
  careGaps: CareGap[] = [],
  customWeights?: Partial<ScoringWeights>,
  careActions?: CareAction[]
): PatientTriageResult {
  const w: ScoringWeights = { ...DEFAULT_SCORING_WEIGHTS, ...customWeights };
  let rawScore = 0;
  const factors: QueueScoreFactor[] = [];
  const reasons: string[] = [];
  const dataWarnings: string[] = [];

  const latestUpdate = healthUpdates[0];
  const missedDoses = schedules.filter(
    (s) => s.status === 'missed' || s.status === 'cannot_take'
  );

  // 1. Critical safety emergency check (Red Flag override)
  let criticalSafetyOverride = false;
  let criticalAlertMessage: string | undefined;

  if (latestUpdate?.symptomDescription) {
    const emergencyCheck = detectEmergencyOverride(latestUpdate.symptomDescription);
    if (emergencyCheck.isEmergency) {
      criticalSafetyOverride = true;
      criticalAlertMessage = emergencyCheck.alertMessage;
    }
  }

  // Rule A: New or worsening symptom
  if (latestUpdate && latestUpdate.state === 'bad') {
    rawScore += w.newSymptom;
    factors.push({
      rule: 'new_symptom',
      reason: 'New or worsening symptom reported',
      points: w.newSymptom,
      evidence: latestUpdate.symptomDescription || 'Patient reported feeling bad',
    });
    reasons.push(`New/worsening symptom (+${w.newSymptom})`);
  }

  // Rule B: Allergy or duplicate safety flag
  const hasAllergyOrDuplicate = careGaps.some(
    (g) => g.status === 'open' && (g.type === 'allergy_conflict' || g.type === 'duplicate_medicine')
  );
  if (hasAllergyOrDuplicate) {
    rawScore += w.safetyFlag;
    factors.push({
      rule: 'safety_flag',
      reason: 'Safety concern: Allergy conflict or duplicate medication',
      points: w.safetyFlag,
      evidence: careGaps.find((g) => g.type === 'allergy_conflict' || g.type === 'duplicate_medicine')?.evidence ?? 'Allergy conflict detected',
    });
    reasons.push(`Safety flag / allergy conflict (+${w.safetyFlag})`);
  }

  // Rule C: Two or more missed doses in 24–48-hour window
  if (missedDoses.length >= 2) {
    rawScore += w.repeatedMissedDoses;
    const meds = [...new Set(missedDoses.map((d) => d.medicineName))].join(', ');
    factors.push({
      rule: 'repeated_missed_dose',
      reason: 'Two or more missed doses in recovery window',
      points: w.repeatedMissedDoses,
      evidence: `${missedDoses.length} doses missed (${meds})`,
    });
    reasons.push(`Repeated missed doses (+${w.repeatedMissedDoses})`);
  }

  // Rule D: Missing symptom severity/duration
  const hasMissingSeverityGap = careGaps.some((g) => g.status === 'open' && g.type === 'missing_severity');
  const hasUnratedSymptom = Boolean(
    latestUpdate?.symptomDescription &&
    latestUpdate.state !== 'good' &&
    !/\b(severity|pain scale|\d+\s*\/\s*10|\b(mild|moderate|severe)\b)\b/i.test(latestUpdate.symptomDescription)
  );
  if (hasMissingSeverityGap || hasUnratedSymptom) {
    rawScore += w.missingSeverity;
    factors.push({
      rule: 'missing_severity',
      reason: 'Symptom reported without clinical severity/duration scale',
      points: w.missingSeverity,
      evidence: 'Missing 1-10 pain/discomfort rating',
    });
    reasons.push(`Missing severity rating (+${w.missingSeverity})`);
  }

  // Rule E: Unanswered follow-up (>24h)
  const overdueFollowUps = followUps.filter((f) => {
    if (f.status !== 'pending') return false;
    const hours = (Date.now() - new Date(f.askedAt).getTime()) / 3600000;
    return hours > 24;
  });
  if (overdueFollowUps.length > 0) {
    rawScore += w.unansweredFollowup;
    factors.push({
      rule: 'unanswered_followup',
      reason: 'Follow-up question unanswered for more than 24 hours',
      points: w.unansweredFollowup,
      evidence: `${overdueFollowUps.length} pending clinical question(s)`,
    });
    reasons.push(`Unanswered follow-up (>24h) (+${w.unansweredFollowup})`);
  }

  // Rule F: No health update for > 24 hours
  if (!latestUpdate) {
    rawScore += w.overdueUpdate;
    factors.push({
      rule: 'overdue_update',
      reason: 'No health check-in submitted since enrollment',
      points: w.overdueUpdate,
      evidence: 'Check-in overdue',
    });
    reasons.push(`No health update (>24h) (+${w.overdueUpdate})`);
    dataWarnings.push('Missing data: No health check-in submitted since enrollment.');
  } else {
    const hoursSinceUpdate = (Date.now() - new Date(latestUpdate.submittedAt).getTime()) / 3600000;
    if (hoursSinceUpdate > 24) {
      rawScore += w.overdueUpdate;
      factors.push({
        rule: 'overdue_update',
        reason: 'No health update recorded for > 24 hours',
        points: w.overdueUpdate,
        evidence: `Last update ${Math.floor(hoursSinceUpdate)} hours ago`,
      });
      reasons.push(`Overdue health update (+${w.overdueUpdate})`);
      dataWarnings.push(`Stale data: Last health check-in was submitted ${Math.floor(hoursSinceUpdate)} hours ago.`);
    }
  }

  // Missing medication schedule warning
  if (!schedules || schedules.length === 0) {
    dataWarnings.push('No active medication schedules: Awaiting doctor prescription review or lock.');
  }

  // Overdue follow-up warning
  if (overdueFollowUps.length > 0) {
    dataWarnings.push(`${overdueFollowUps.length} follow-up question(s) overdue (> 24 hours).`);
  }

  // Rule G: Overdue care-plan task
  if (careActions && careActions.length > 0) {
    const nowMs = Date.now();
    const overdueTasks = careActions.filter((a) => {
      if (a.status === 'resolved' || a.status === 'documented') return false;
      if (!a.dueDate) return false;
      return new Date(a.dueDate).getTime() < nowMs;
    });
    if (overdueTasks.length > 0) {
      rawScore += w.overdueCareTask;
      factors.push({
        rule: 'overdue_care_task',
        reason: 'Overdue care-plan action or clinician task',
        points: w.overdueCareTask,
        evidence: `${overdueTasks.length} task(s) overdue (e.g. "${overdueTasks[0].title}")`,
      });
      reasons.push(`Overdue care-plan task (+${w.overdueCareTask})`);
      dataWarnings.push(`${overdueTasks.length} care-plan task(s) past due date.`);
    }
  }

  // Enforce strict 0 to 100 boundary
  const boundedScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Priority categorization
  let priority: Priority;
  if (criticalSafetyOverride || boundedScore >= 80) {
    priority = 'urgent';
  } else if (boundedScore >= 50) {
    priority = 'needs_attention';
  } else {
    priority = 'on_track';
  }

  return {
    score: boundedScore,
    priority,
    reasons,
    factors,
    criticalSafetyOverride,
    criticalAlertMessage,
    dataWarnings,
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
