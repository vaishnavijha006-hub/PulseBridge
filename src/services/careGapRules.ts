import type { CareGap, CareGapType, HealthUpdate, MedicationSchedule, FollowUp, PatientProfile } from '@/types';

export interface CareGapRuleResult {
  gaps: Omit<CareGap, 'id' | 'status'>[];
}

export function detectCareGaps(
  patient: PatientProfile,
  healthUpdates: HealthUpdate[],
  schedules: MedicationSchedule[],
  followUps: FollowUp[],
): CareGapRuleResult {
  const gaps: Omit<CareGap, 'id' | 'status'>[] = [];

  const latestUpdate = healthUpdates[0];
  const missedDoses = schedules.filter((s) => s.status === 'missed');

  if (latestUpdate && latestUpdate.state === 'bad') {
    gaps.push({
      patientId: patient.id,
      type: 'new_symptom',
      evidence: `New symptom reported: "${latestUpdate.symptomDescription || 'Feeling unwell'}"`,
      timestamp: latestUpdate.submittedAt,
      missingInfo: latestUpdate.symptomDescription ? 'Severity and duration not specified' : 'No symptom description provided',
      followupQuestion: 'Aapko kya takleef hai? Kab se hai?',
    });
  }

  if (latestUpdate && latestUpdate.symptomDescription && latestUpdate.state !== 'good') {
    const hasSeverity = /\b(severity|pain scale|\d+\s*\/\s*10)\b/i.test(latestUpdate.symptomDescription);
    if (!hasSeverity) {
      gaps.push({
        patientId: patient.id,
        type: 'missing_severity',
        evidence: `Symptom "${latestUpdate.symptomDescription}" reported without severity rating`,
        timestamp: latestUpdate.submittedAt,
        missingInfo: 'Pain/discomfort scale 1-10',
        followupQuestion: 'Lakshan 1 se 10 mein kitna tej hai?',
      });
    }
  }

  if (missedDoses.length >= 2) {
    const medNames = [...new Set(missedDoses.map((d) => d.medicineName))];
    gaps.push({
      patientId: patient.id,
      type: 'repeated_missed_dose',
      evidence: `${missedDoses.length} missed doses in recent period (${medNames.join(', ')})`,
      timestamp: new Date().toISOString(),
      missingInfo: null,
      followupQuestion: `Kya ${medNames[0]} ke saath koi problem hai?`,
    });
  }

  const unansweredFollowUps = followUps.filter((f) => f.status === 'pending');
  for (const f of unansweredFollowUps) {
    const hoursSinceAsked = (Date.now() - new Date(f.askedAt).getTime()) / 3600000;
    if (hoursSinceAsked > 24) {
      gaps.push({
        patientId: patient.id,
        type: 'unanswered_followup',
        evidence: `Follow-up question unanswered for ${Math.floor(hoursSinceAsked)} hours: "${f.question}"`,
        timestamp: new Date().toISOString(),
        missingInfo: 'Patient response',
        followupQuestion: f.question,
      });
    }
  }

  if (!latestUpdate) {
    gaps.push({
      patientId: patient.id,
      type: 'overdue_update',
      evidence: 'No health update submitted',
      timestamp: new Date().toISOString(),
      missingInfo: 'Current health status',
      followupQuestion: 'Aaj kaisa lag raha hai?',
    });
  } else {
    const hoursSinceUpdate = (Date.now() - new Date(latestUpdate.submittedAt).getTime()) / 3600000;
    if (hoursSinceUpdate > 36) {
      gaps.push({
        patientId: patient.id,
        type: 'overdue_update',
        evidence: `No health update in ${Math.floor(hoursSinceUpdate)} hours`,
        timestamp: new Date().toISOString(),
        missingInfo: 'Current health status',
        followupQuestion: 'Aaj kaisa lag raha hai?',
      });
    }
  }

  if (patient.allergies && patient.allergies !== 'None') {
    const allergyMeds = patient.allergies.toLowerCase();
    const currentMedNames = schedules.map((s) => s.medicineName.toLowerCase());
    for (const med of currentMedNames) {
      if (allergyMeds.includes(med) || med.includes(allergyMeds.split(',')[0].trim())) {
        gaps.push({
          patientId: patient.id,
          type: 'allergy_conflict',
          evidence: `Patient allergic to ${patient.allergies}, current medicine "${med}" may conflict`,
          timestamp: new Date().toISOString(),
          missingInfo: 'Confirm medicine safety',
          followupQuestion: null,
        });
        break;
      }
    }
  }

  return { gaps };
}

export const gapTypeLabels: Record<CareGapType, string> = {
  new_symptom: 'New Symptom Reported',
  missing_severity: 'Missing Severity',
  repeated_missed_dose: 'Repeated Missed Dose',
  unanswered_followup: 'Unanswered Follow-up',
  overdue_update: 'Overdue Health Update',
  allergy_conflict: 'Allergy Conflict',
  duplicate_medicine: 'Duplicate Medicine',
};
