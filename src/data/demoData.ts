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
  MedicalReport,
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

export const demoMedicalReports: Record<string, MedicalReport[]> = {
  p1: [
    {
      id: 'rep-p1-1',
      patientId: 'p1',
      title: 'Cardiac Biomarker & Lipid Panel',
      reportType: 'cardiology',
      date: '2026-10-16',
      facilityOrLab: 'Apex Heart & Vascular Institute — Diagnostic Pathology',
      orderingDoctor: 'Dr. S. Sharma, MD',
      rawText: `APEX HEART & VASCULAR INSTITUTE
PATIENT: Ravi Sharma | AGE: 62 | GENDER: Male | REF: PB-7019
DATE OF SERVICE: 16-OCT-2026 | ORDERING: Dr. S. Sharma, MD

TEST NAME                       RESULT      UNITS      REFERENCE INTERVAL
--------------------------------------------------------------------------
High-Sensitivity Troponin I      48          ng/L       < 14 (99th percentile)   [HIGH]
Total Cholesterol               215         mg/dL      < 200                    [HIGH]
HDL Cholesterol                  42          mg/dL      > 40                     [NORMAL]
LDL Cholesterol                 138         mg/dL      < 100                    [HIGH]
Random Blood Glucose            142         mg/dL      (None provided on req)   [NOT RANGED]
Serum Creatinine                [unreadable smudge] mg/dL 0.7 - 1.3              [DAMAGED PRINT]
--------------------------------------------------------------------------
CLINICAL PATHOLOGIST NOTE: Hs-Troponin elevation detected in patient reporting chest heaviness. Urgent clinical correlation recommended. Re-draw recommended if acute coronary syndrome suspected.`,
      structuredFindings: [
        {
          testOrParameter: 'High-Sensitivity Troponin I',
          value: '48',
          unit: 'ng/L',
          referenceRange: '< 14 ng/L',
          isAbnormal: true,
          clinicalNotes: 'Elevated above 99th percentile upper reference limit',
          sourceEvidence: 'High-Sensitivity Troponin I: 48 ng/L (Ref: < 14)',
        },
        {
          testOrParameter: 'Total Cholesterol',
          value: '215',
          unit: 'mg/dL',
          referenceRange: '< 200 mg/dL',
          isAbnormal: true,
          clinicalNotes: 'Borderline elevated lipid standard',
          sourceEvidence: 'Total Cholesterol: 215 mg/dL (Ref: < 200)',
        },
        {
          testOrParameter: 'HDL Cholesterol',
          value: '42',
          unit: 'mg/dL',
          referenceRange: '> 40 mg/dL',
          isAbnormal: false,
          clinicalNotes: 'Within target range',
          sourceEvidence: 'HDL Cholesterol: 42 mg/dL (Ref: > 40)',
        },
        {
          testOrParameter: 'LDL Cholesterol',
          value: '138',
          unit: 'mg/dL',
          referenceRange: '< 100 mg/dL',
          isAbnormal: true,
          clinicalNotes: 'Elevated atherogenic lipoprotein',
          sourceEvidence: 'LDL Cholesterol: 138 mg/dL (Ref: < 100)',
        },
        {
          testOrParameter: 'Random Blood Glucose',
          value: '142',
          unit: 'mg/dL',
          referenceRange: null, // No reference range provided!
          isAbnormal: null,
          clinicalNotes: 'Reference range omitted on laboratory requisition',
          sourceEvidence: 'Random Blood Glucose: 142 mg/dL (None provided)',
        },
        {
          testOrParameter: 'Serum Creatinine',
          value: '[unreadable smudge]',
          unit: 'mg/dL',
          referenceRange: '0.7 - 1.3 mg/dL',
          isAbnormal: null,
          clinicalNotes: 'Print artifact obscured numeric value',
          sourceEvidence: 'Serum Creatinine: [unreadable smudge]',
        },
      ],
    },
    {
      id: 'rep-p1-2',
      patientId: 'p1',
      title: 'Lipid & Routine Metabolic Follow-Up',
      reportType: 'cardiology',
      date: '2026-07-10',
      facilityOrLab: 'Apex Heart & Vascular Institute — Diagnostic Pathology',
      orderingDoctor: 'Dr. S. Sharma, MD',
      rawText: `APEX HEART & VASCULAR INSTITUTE
PATIENT: Ravi Sharma | AGE: 62 | GENDER: Male | REF: PB-7019
DATE OF SERVICE: 10-JUL-2026 | ORDERING: Dr. S. Sharma, MD

TEST NAME                       RESULT      UNITS      REFERENCE INTERVAL
--------------------------------------------------------------------------
Total Cholesterol               228         mg/dL      < 200                    [HIGH]
HDL Cholesterol                  40          mg/dL      > 40                     [BORDERLINE]
LDL Cholesterol                 152         mg/dL      < 100                    [HIGH]
Random Blood Glucose            138         mg/dL      70 - 140                 [NORMAL]
Serum Creatinine                1.1         mg/dL      0.7 - 1.3                [NORMAL]
--------------------------------------------------------------------------`,
      structuredFindings: [
        {
          testOrParameter: 'Total Cholesterol',
          value: '228',
          unit: 'mg/dL',
          referenceRange: '< 200 mg/dL',
          isAbnormal: true,
          clinicalNotes: 'Elevated total cholesterol',
          sourceEvidence: 'Total Cholesterol: 228 mg/dL (Ref: < 200)',
        },
        {
          testOrParameter: 'HDL Cholesterol',
          value: '40',
          unit: 'mg/dL',
          referenceRange: '> 40 mg/dL',
          isAbnormal: false,
          clinicalNotes: 'Lower threshold of normal',
          sourceEvidence: 'HDL Cholesterol: 40 mg/dL (Ref: > 40)',
        },
        {
          testOrParameter: 'LDL Cholesterol',
          value: '152',
          unit: 'mg/dL',
          referenceRange: '< 100 mg/dL',
          isAbnormal: true,
          clinicalNotes: 'Elevated atherogenic lipoprotein',
          sourceEvidence: 'LDL Cholesterol: 152 mg/dL (Ref: < 100)',
        },
        {
          testOrParameter: 'Random Blood Glucose',
          value: '138',
          unit: 'mg/dL',
          referenceRange: '70 - 140 mg/dL',
          isAbnormal: false,
          clinicalNotes: 'Within non-fasting interval',
          sourceEvidence: 'Random Blood Glucose: 138 mg/dL (Ref: 70 - 140)',
        },
        {
          testOrParameter: 'Serum Creatinine',
          value: '1.1',
          unit: 'mg/dL',
          referenceRange: '0.7 - 1.3 mg/dL',
          isAbnormal: false,
          clinicalNotes: 'Normal renal clearance',
          sourceEvidence: 'Serum Creatinine: 1.1 mg/dL (Ref: 0.7 - 1.3)',
        },
      ],
    },
    {
      id: 'rep-p1-3',
      patientId: 'p1',
      title: 'Baseline Cardiovascular & Lipid Assessment',
      reportType: 'cardiology',
      date: '2026-03-05',
      facilityOrLab: 'Apex Heart & Vascular Institute — Diagnostic Pathology',
      orderingDoctor: 'Dr. S. Sharma, MD',
      rawText: `APEX HEART & VASCULAR INSTITUTE
PATIENT: Ravi Sharma | AGE: 62 | GENDER: Male | REF: PB-7019
DATE OF SERVICE: 05-MAR-2026 | ORDERING: Dr. S. Sharma, MD

TEST NAME                       RESULT      UNITS      REFERENCE INTERVAL
--------------------------------------------------------------------------
Total Cholesterol               240         mg/dL      < 200                    [HIGH]
HDL Cholesterol                  38          mg/dL      > 40                     [LOW]
LDL Cholesterol                 165         mg/dL      < 100                    [HIGH]
Random Blood Glucose            130         mg/dL      70 - 140                 [NORMAL]
Serum Creatinine                1.0         mg/dL      0.7 - 1.3                [NORMAL]
--------------------------------------------------------------------------`,
      structuredFindings: [
        {
          testOrParameter: 'Total Cholesterol',
          value: '240',
          unit: 'mg/dL',
          referenceRange: '< 200 mg/dL',
          isAbnormal: true,
          clinicalNotes: 'Marked hypercholesterolemia',
          sourceEvidence: 'Total Cholesterol: 240 mg/dL (Ref: < 200)',
        },
        {
          testOrParameter: 'HDL Cholesterol',
          value: '38',
          unit: 'mg/dL',
          referenceRange: '> 40 mg/dL',
          isAbnormal: true,
          clinicalNotes: 'Suboptimal protective HDL',
          sourceEvidence: 'HDL Cholesterol: 38 mg/dL (Ref: > 40)',
        },
        {
          testOrParameter: 'LDL Cholesterol',
          value: '165',
          unit: 'mg/dL',
          referenceRange: '< 100 mg/dL',
          isAbnormal: true,
          clinicalNotes: 'Significantly elevated LDL-C',
          sourceEvidence: 'LDL Cholesterol: 165 mg/dL (Ref: < 100)',
        },
        {
          testOrParameter: 'Random Blood Glucose',
          value: '130',
          unit: 'mg/dL',
          referenceRange: '70 - 140 mg/dL',
          isAbnormal: false,
          clinicalNotes: 'Normal glycemic index',
          sourceEvidence: 'Random Blood Glucose: 130 mg/dL (Ref: 70 - 140)',
        },
        {
          testOrParameter: 'Serum Creatinine',
          value: '1.0',
          unit: 'mg/dL',
          referenceRange: '0.7 - 1.3 mg/dL',
          isAbnormal: false,
          clinicalNotes: 'Preserved baseline renal function',
          sourceEvidence: 'Serum Creatinine: 1.0 mg/dL (Ref: 0.7 - 1.3)',
        },
      ],
    },
  ],
  p3: [
    {
      id: 'rep-p3-1',
      patientId: 'p3',
      title: 'Hypertension & Renal Function Panel',
      reportType: 'lab',
      date: '2026-09-28',
      facilityOrLab: 'Apex Laboratories',
      orderingDoctor: 'Dr. Anita Desai, MD',
      rawText: `APEX LABORATORIES
PATIENT: Ahmed Khan | AGE: 48 | GENDER: Male
DATE: 28-SEP-2026

TEST                    VALUE       UNITS       REFERENCE INTERVAL
--------------------------------------------------------------------------
Serum Creatinine        0.9         mg/dL       0.7 - 1.3                         [NORMAL]
Serum Potassium         4.2         mEq/L       3.5 - 5.1                         [NORMAL]
Blood Urea Nitrogen     15          mg/dL       7 - 20                            [NORMAL]
--------------------------------------------------------------------------`,
      structuredFindings: [
        {
          testOrParameter: 'Serum Creatinine',
          value: '0.9',
          unit: 'mg/dL',
          referenceRange: '0.7 - 1.3 mg/dL',
          isAbnormal: false,
          clinicalNotes: 'Normal baseline',
          sourceEvidence: 'Serum Creatinine: 0.9 mg/dL (Ref: 0.7 - 1.3)',
        },
        {
          testOrParameter: 'Serum Potassium',
          value: '4.2',
          unit: 'mEq/L',
          referenceRange: '3.5 - 5.1 mEq/L',
          isAbnormal: false,
          clinicalNotes: 'Normokalemic',
          sourceEvidence: 'Serum Potassium: 4.2 mEq/L (Ref: 3.5 - 5.1)',
        },
        {
          testOrParameter: 'Blood Urea Nitrogen',
          value: '15',
          unit: 'mg/dL',
          referenceRange: '7 - 20 mg/dL',
          isAbnormal: false,
          clinicalNotes: 'Normal clearance',
          sourceEvidence: 'Blood Urea Nitrogen: 15 mg/dL (Ref: 7 - 20)',
        },
      ],
    },
  ],
  p4: [
    {
      id: 'rep-p4-1',
      patientId: 'p4',
      title: 'Diabetic Metabolic & Renal Function Panel',
      reportType: 'lab',
      date: '2026-10-15',
      facilityOrLab: 'City Care Clinical Laboratories',
      orderingDoctor: 'Dr. V. Gupta, MD',
      rawText: `CITY CARE CLINICAL LABORATORIES
PATIENT: Lakshmi Rao | AGE: 70 | GENDER: Female | REF: PB-9481
DATE: 15-OCT-2026

TEST                    VALUE       UNITS       REFERENCE INTERVAL
--------------------------------------------------------------------------
Glycated Hemoglobin (HbA1c) 8.4     %           < 5.7 (Normal), 5.7-6.4 (Prediabetes) [ELEVATED]
Estimated GFR (eGFR)    68          mL/min/1.73m2 > 60                             [NORMAL]
Urine Microalbumin      45          mg/L        < 30                              [ELEVATED]
Serum Potassium         4.8         mEq/L       3.5 - 5.1                         [NORMAL]
--------------------------------------------------------------------------`,
      structuredFindings: [
        {
          testOrParameter: 'Glycated Hemoglobin (HbA1c)',
          value: '8.4',
          unit: '%',
          referenceRange: '< 5.7 %',
          isAbnormal: true,
          clinicalNotes: 'Elevated glycemic control marker in T2D',
          sourceEvidence: 'Glycated Hemoglobin (HbA1c): 8.4 % (Ref: < 5.7)',
        },
        {
          testOrParameter: 'Estimated GFR (eGFR)',
          value: '68',
          unit: 'mL/min/1.73m2',
          referenceRange: '> 60 mL/min/1.73m2',
          isAbnormal: false,
          clinicalNotes: 'Adequate renal filtration',
          sourceEvidence: 'Estimated GFR (eGFR): 68 mL/min/1.73m2 (Ref: > 60)',
        },
        {
          testOrParameter: 'Urine Microalbumin',
          value: '45',
          unit: 'mg/L',
          referenceRange: '< 30 mg/L',
          isAbnormal: true,
          clinicalNotes: 'Microalbuminuria present',
          sourceEvidence: 'Urine Microalbumin: 45 mg/L (Ref: < 30)',
        },
        {
          testOrParameter: 'Serum Potassium',
          value: '4.8',
          unit: 'mEq/L',
          referenceRange: '3.5 - 5.1 mEq/L',
          isAbnormal: false,
          clinicalNotes: 'Normokalemic',
          sourceEvidence: 'Serum Potassium: 4.8 mEq/L (Ref: 3.5 - 5.1)',
        },
      ],
    },
    {
      id: 'rep-p4-2',
      patientId: 'p4',
      title: 'Diabetic Quarterly Follow-Up Panel',
      reportType: 'lab',
      date: '2026-06-20',
      facilityOrLab: 'City Care Clinical Laboratories',
      orderingDoctor: 'Dr. V. Gupta, MD',
      rawText: `CITY CARE CLINICAL LABORATORIES
PATIENT: Lakshmi Rao | AGE: 70 | GENDER: Female | REF: PB-9481
DATE: 20-JUN-2026

TEST                    VALUE       UNITS       REFERENCE INTERVAL
--------------------------------------------------------------------------
Glycated Hemoglobin (HbA1c) 8.9     %           < 5.7 (Normal)                    [ELEVATED]
Estimated GFR (eGFR)    70          mL/min/1.73m2 > 60                             [NORMAL]
Urine Microalbumin      40          mg/L        < 30                              [ELEVATED]
Serum Potassium         4.6         mEq/L       3.5 - 5.1                         [NORMAL]
--------------------------------------------------------------------------`,
      structuredFindings: [
        {
          testOrParameter: 'Glycated Hemoglobin (HbA1c)',
          value: '8.9',
          unit: '%',
          referenceRange: '< 5.7 %',
          isAbnormal: true,
          clinicalNotes: 'Suboptimal glycemic control',
          sourceEvidence: 'Glycated Hemoglobin (HbA1c): 8.9 % (Ref: < 5.7)',
        },
        {
          testOrParameter: 'Estimated GFR (eGFR)',
          value: '70',
          unit: 'mL/min/1.73m2',
          referenceRange: '> 60 mL/min/1.73m2',
          isAbnormal: false,
          clinicalNotes: 'Stable renal filtration',
          sourceEvidence: 'Estimated GFR (eGFR): 70 mL/min/1.73m2 (Ref: > 60)',
        },
        {
          testOrParameter: 'Urine Microalbumin',
          value: '40',
          unit: 'mg/L',
          referenceRange: '< 30 mg/L',
          isAbnormal: true,
          clinicalNotes: 'Persistent microalbuminuria',
          sourceEvidence: 'Urine Microalbumin: 40 mg/L (Ref: < 30)',
        },
        {
          testOrParameter: 'Serum Potassium',
          value: '4.6',
          unit: 'mEq/L',
          referenceRange: '3.5 - 5.1 mEq/L',
          isAbnormal: false,
          clinicalNotes: 'Normokalemic',
          sourceEvidence: 'Serum Potassium: 4.6 mEq/L (Ref: 3.5 - 5.1)',
        },
      ],
    },
    {
      id: 'rep-p4-3',
      patientId: 'p4',
      title: 'Annual Diabetic & Renal Function Review',
      reportType: 'lab',
      date: '2026-01-15',
      facilityOrLab: 'City Care Clinical Laboratories',
      orderingDoctor: 'Dr. V. Gupta, MD',
      rawText: `CITY CARE CLINICAL LABORATORIES
PATIENT: Lakshmi Rao | AGE: 70 | GENDER: Female | REF: PB-9481
DATE: 15-JAN-2026

TEST                    VALUE       UNITS       REFERENCE INTERVAL
--------------------------------------------------------------------------
Glycated Hemoglobin (HbA1c) 9.3     %           < 5.7 (Normal)                    [ELEVATED]
Estimated GFR (eGFR)    72          mL/min/1.73m2 > 60                             [NORMAL]
Urine Microalbumin      38          mg/L        < 30                              [ELEVATED]
Serum Potassium         4.5         mEq/L       3.5 - 5.1                         [NORMAL]
--------------------------------------------------------------------------`,
      structuredFindings: [
        {
          testOrParameter: 'Glycated Hemoglobin (HbA1c)',
          value: '9.3',
          unit: '%',
          referenceRange: '< 5.7 %',
          isAbnormal: true,
          clinicalNotes: 'Poor glycemic control at baseline',
          sourceEvidence: 'Glycated Hemoglobin (HbA1c): 9.3 % (Ref: < 5.7)',
        },
        {
          testOrParameter: 'Estimated GFR (eGFR)',
          value: '72',
          unit: 'mL/min/1.73m2',
          referenceRange: '> 60 mL/min/1.73m2',
          isAbnormal: false,
          clinicalNotes: 'Normal glomerular filtration',
          sourceEvidence: 'Estimated GFR (eGFR): 72 mL/min/1.73m2 (Ref: > 60)',
        },
        {
          testOrParameter: 'Urine Microalbumin',
          value: '38',
          unit: 'mg/L',
          referenceRange: '< 30 mg/L',
          isAbnormal: true,
          clinicalNotes: 'Early microalbuminuria',
          sourceEvidence: 'Urine Microalbumin: 38 mg/L (Ref: < 30)',
        },
        {
          testOrParameter: 'Serum Potassium',
          value: '4.5',
          unit: 'mEq/L',
          referenceRange: '3.5 - 5.1 mEq/L',
          isAbnormal: false,
          clinicalNotes: 'Normokalemic',
          sourceEvidence: 'Serum Potassium: 4.5 mEq/L (Ref: 3.5 - 5.1)',
        },
      ],
    },
  ],
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

