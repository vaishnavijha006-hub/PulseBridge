import { calculatePatientTriageScore } from '@/services/careGapRules';
import type {
  PatientProfile,
  PatientSummary,
  MedicationSchedule,
  HealthUpdate,
  CareGap,
  FollowUp,
  Reminder,
  PrescriptionDraft,
  AdherenceLog,
  Medicine,
  FamilyView,
  CaregiverAccess,
} from '@/types';

export const demoPatients: PatientProfile[] = [
  {
    id: 'p1',
    name: 'Ravi Sharma',
    age: 62,
    gender: 'male',
    phone: '9876543210',
    symptoms: 'Chest heaviness since morning',
    allergies: 'Penicillin',
    currentMeds: 'Aspirin, Metformin',
    language: 'hi',
  },
  {
    id: 'p2',
    name: 'Sunita Devi',
    age: 55,
    gender: 'female',
    phone: '9876543211',
    symptoms: 'Knee pain, mild swelling',
    allergies: 'None',
    currentMeds: 'Calcium, Vitamin D',
    language: 'hi',
  },
  {
    id: 'p3',
    name: 'Ahmed Khan',
    age: 48,
    gender: 'male',
    phone: '9876543212',
    symptoms: 'Blood pressure fluctuation',
    allergies: 'Sulfa drugs',
    currentMeds: 'Amlodipine',
    language: 'en',
  },
  {
    id: 'p4',
    name: 'Lakshmi Rao',
    age: 70,
    gender: 'female',
    phone: '9876543213',
    symptoms: 'Diabetes management follow-up',
    allergies: 'None',
    currentMeds: 'Metformin, Glimepiride',
    language: 'hi',
  },
];

export const demoMedicines: Record<string, Medicine[]> = {
  p1: [
    { id: 'm1', name: 'Aspirin', dosage: '75mg', frequency: 'Once daily', duration: '30 days', instructions: 'After breakfast', confirmed: true },
    { id: 'm2', name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', duration: 'Ongoing', instructions: 'After meals', confirmed: true },
    { id: 'm3', name: 'Atorvastatin', dosage: '10mg', frequency: 'Once at night', duration: '30 days', instructions: 'At bedtime', confirmed: true },
  ],
  p2: [
    { id: 'm4', name: 'Calcium', dosage: '500mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'With milk', confirmed: true },
    { id: 'm5', name: 'Vitamin D', dosage: '60K IU', frequency: 'Once weekly', duration: '8 weeks', instructions: 'Sunday morning', confirmed: true },
  ],
  p3: [
    { id: 'm6', name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Morning', confirmed: true },
    { id: 'm7', name: 'Telmisartan', dosage: '40mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Evening', confirmed: true },
  ],
  p4: [
    { id: 'm8', name: 'Metformin', dosage: '1000mg', frequency: 'Twice daily', duration: 'Ongoing', instructions: 'After meals', confirmed: true },
    { id: 'm9', name: 'Glimepiride', dosage: '2mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Before breakfast', confirmed: true },
    { id: 'm10', name: 'Insulin', dosage: '10 units', frequency: 'Twice daily', duration: 'Ongoing', instructions: 'Before meals, subcutaneous', confirmed: true },
  ],
};

export const demoSchedules: Record<string, MedicationSchedule[]> = {
  p1: [
    { id: 's1', medicineId: 'm1', medicineName: 'Aspirin', dosage: '75mg', scheduledTime: '08:00', status: 'taken', instructions: 'After breakfast' },
    { id: 's2', medicineId: 'm2', medicineName: 'Metformin', dosage: '500mg', scheduledTime: '13:00', status: 'taken', instructions: 'After lunch' },
    { id: 's3', medicineId: 'm2', medicineName: 'Metformin', dosage: '500mg', scheduledTime: '20:00', status: 'pending', instructions: 'After dinner' },
    { id: 's4', medicineId: 'm3', medicineName: 'Atorvastatin', dosage: '10mg', scheduledTime: '22:00', status: 'pending', instructions: 'At bedtime' },
  ],
  p2: [
    { id: 's5', medicineId: 'm4', medicineName: 'Calcium', dosage: '500mg', scheduledTime: '09:00', status: 'taken', instructions: 'With milk' },
  ],
  p3: [
    { id: 's6', medicineId: 'm6', medicineName: 'Amlodipine', dosage: '5mg', scheduledTime: '08:00', status: 'taken', instructions: 'Morning' },
    { id: 's7', medicineId: 'm7', medicineName: 'Telmisartan', dosage: '40mg', scheduledTime: '19:00', status: 'pending', instructions: 'Evening' },
  ],
  p4: [
    { id: 's8', medicineId: 'm8', medicineName: 'Metformin', dosage: '1000mg', scheduledTime: '08:00', status: 'taken', instructions: 'After breakfast' },
    { id: 's9', medicineId: 'm9', medicineName: 'Glimepiride', dosage: '2mg', scheduledTime: '07:30', status: 'taken', instructions: 'Before breakfast' },
    { id: 's10', medicineId: 'm10', medicineName: 'Insulin', dosage: '10 units', scheduledTime: '12:00', status: 'missed', instructions: 'Before lunch' },
  ],
};

export const demoAdherenceLogs: Record<string, AdherenceLog[]> = {
  p1: Array.from({ length: 7 }, (_, i) => ({
    id: `a1-${i}`,
    scheduleId: 's1',
    medicineName: 'Aspirin',
    scheduledTime: '08:00',
    status: i < 6 ? 'taken' : 'taken',
    recordedAt: new Date(Date.now() - (6 - i) * 86400000).toISOString(),
  })),
};

export const demoHealthUpdates: Record<string, HealthUpdate[]> = {
  p1: [
    { id: 'h1', patientId: 'p1', state: 'bad', symptomDescription: 'Chest heaviness since morning', submittedAt: new Date(Date.now() - 3600000).toISOString(), source: 'patient' },
    { id: 'h2', patientId: 'p1', state: 'ok', symptomDescription: 'Slight fatigue', submittedAt: new Date(Date.now() - 86400000).toISOString(), source: 'patient' },
  ],
  p2: [
    { id: 'h3', patientId: 'p2', state: 'ok', symptomDescription: 'Knee pain improved', submittedAt: new Date(Date.now() - 7200000).toISOString(), source: 'patient' },
  ],
  p3: [
    { id: 'h4', patientId: 'p3', state: 'good', symptomDescription: 'Feeling normal', submittedAt: new Date(Date.now() - 10800000).toISOString(), source: 'patient' },
  ],
  p4: [
    { id: 'h5', patientId: 'p4', state: 'ok', symptomDescription: 'Sugar slightly high', submittedAt: new Date(Date.now() - 5400000).toISOString(), source: 'patient' },
  ],
};

export const demoCareGaps: Record<string, CareGap[]> = {
  p1: [
    { id: 'g1', patientId: 'p1', type: 'new_symptom', evidence: 'New symptom: "Chest heaviness since morning"', timestamp: new Date(Date.now() - 3600000).toISOString(), missingInfo: 'Severity not specified', followupQuestion: 'Chest heaviness ke saath koi aur lakshan hai? (sweating, breathlessness?)', status: 'open' },
    { id: 'g2', patientId: 'p1', type: 'repeated_missed_dose', evidence: '2 missed doses in last 5 days (Metformin)', timestamp: new Date(Date.now() - 7200000).toISOString(), missingInfo: null, followupQuestion: 'Kya Metformin ke saath koi problem hai?', status: 'open' },
  ],
  p2: [
    { id: 'g3', patientId: 'p2', type: 'missing_severity', evidence: 'Knee pain reported but severity not captured', timestamp: new Date(Date.now() - 7200000).toISOString(), missingInfo: 'Pain scale 1-10', followupQuestion: 'Knee pain 1 se 10 mein kitna hai?', status: 'open' },
  ],
  p3: [],
  p4: [
    { id: 'g4', patientId: 'p4', type: 'overdue_update', evidence: 'No health update in 36 hours', timestamp: new Date(Date.now() - 1800000).toISOString(), missingInfo: 'Current blood sugar reading', followupQuestion: 'Aaj blood sugar kitna tha?', status: 'open' },
    { id: 'g5', patientId: 'p4', type: 'allergy_conflict', evidence: 'Patient allergic to Sulfa, new Rx may contain related compound', timestamp: new Date(Date.now() - 900000).toISOString(), missingInfo: 'Confirm new medicine class', followupQuestion: null, status: 'open' },
  ],
};

export const demoFollowUps: Record<string, FollowUp[]> = {
  p1: [
    { id: 'f1', patientId: 'p1', question: 'Chest heaviness ke saath koi aur lakshan hai? (sweating, breathlessness?)', askedAt: new Date(Date.now() - 3600000).toISOString(), answeredAt: null, answer: null, status: 'pending' },
  ],
  p2: [
    { id: 'f2', patientId: 'p2', question: 'Knee pain 1 se 10 mein kitna hai?', askedAt: new Date(Date.now() - 7200000).toISOString(), answeredAt: null, answer: null, status: 'pending' },
  ],
  p4: [
    { id: 'f3', patientId: 'p4', question: 'Aaj blood sugar kitna tha?', askedAt: new Date(Date.now() - 1800000).toISOString(), answeredAt: null, answer: null, status: 'pending' },
  ],
};

export const demoReminders: Record<string, Reminder[]> = {
  p1: [
    { id: 'r1', patientId: 'p1', type: 'dose', message: 'Metformin 500mg — After dinner', scheduledFor: new Date(Date.now() + 3600000).toISOString(), acknowledged: false },
    { id: 'r2', patientId: 'p1', type: 'followup', message: 'Chest heaviness ke baare mein ek sawaal', scheduledFor: new Date().toISOString(), acknowledged: false },
  ],
  p4: [
    { id: 'r3', patientId: 'p4', type: 'missed_dose', message: 'Insulin dose missed at 12:00', scheduledFor: new Date().toISOString(), acknowledged: false },
  ],
};

export const demoPrescriptionDrafts: Record<string, PrescriptionDraft> = {
  p1: {
    id: 'rx1',
    patientId: 'p1',
    imageUrl: 'https://images.pexels.com/photos/139398/brainstorming-meeting-patients-diagnosis-139398.jpeg?auto=compress&cs=tinysrgb&w=600',
    uploadedAt: new Date(Date.now() - 7200000).toISOString(),
    confirmed: false,
    fields: [
      { key: 'medicine', labelKey: 'rx_medicine', value: 'Aspirin', status: 'confirmed' },
      { key: 'dosage', labelKey: 'rx_dosage', value: '75mg', status: 'confirmed' },
      { key: 'frequency', labelKey: 'rx_frequency', value: 'Once daily', status: 'uncertain' },
      { key: 'duration', labelKey: 'rx_duration', value: '', status: 'uncertain' },
      { key: 'instructions', labelKey: 'rx_instructions', value: 'After breakfast', status: 'confirmed' },
    ],
  },
};

export const demoCaregiverAccess: CaregiverAccess = {
  patientId: 'p1',
  caregiverName: 'Priya (Daughter)',
  authorized: true,
  contactNumber: '9876543210',
  relationship: 'Daughter',
};

export const demoFamilyView: FamilyView = {
  patientName: 'Ravi Sharma',
  headlineKey: 'family_headline',
  dosesToday: { taken: 2, total: 3 },
  nextDoseTime: '20:00',
  healthUpdateStatus: 'Submitted',
  missedDose: false,
  caregiverAccess: demoCaregiverAccess,
};

export function getPatientSummaries(): PatientSummary[] {
  return demoPatients.map((patient) => {
    const schedules = demoSchedules[patient.id] ?? [];
    const takenCount = schedules.filter((s) => s.status === 'taken').length;
    const missedCount = schedules.filter((s) => s.status === 'missed' || s.status === 'cannot_take').length;
    const pendingCount = schedules.filter((s) => s.status === 'pending' || s.status === 'snoozed').length;

    const dosesToday = {
      taken: takenCount,
      missed: missedCount,
      pending: pendingCount,
      total: schedules.length,
    };

    const adherence7Day = patient.id === 'p1' ? 64 : patient.id === 'p4' ? 78 : patient.id === 'p2' ? 90 : 95;
    const updates = demoHealthUpdates[patient.id] ?? [];
    const latestUpdate = updates[0] ?? null;
    const gaps = demoCareGaps[patient.id] ?? [];
    const followUps = demoFollowUps[patient.id] ?? [];
    const lastUpdateAt = latestUpdate?.submittedAt ?? new Date(Date.now() - 86400000).toISOString();
    const draft = demoPrescriptionDrafts[patient.id];
    const pendingRxCount = draft && !draft.confirmed ? 1 : 0;

    const triageResult = calculatePatientTriageScore(patient, updates, schedules, followUps, gaps);

    return {
      patient,
      dosesToday,
      adherence7Day,
      latestUpdate,
      openGaps: gaps.filter((g) => g.status === 'open').length,
      gapReasons: triageResult.reasons.length > 0 ? triageResult.reasons : gaps.map((g) => g.evidence),
      lastUpdateAt,
      priority: triageResult.priority,
      triageScore: triageResult.score,
      criticalSafetyOverride: triageResult.criticalSafetyOverride,
      criticalAlertMessage: triageResult.criticalAlertMessage,
      scoreFactors: triageResult.factors,
      pendingRxCount,
    };
  });
}

