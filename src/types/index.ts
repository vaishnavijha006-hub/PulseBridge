export type Language = 'en' | 'hi';

export type Priority = 'on_track' | 'needs_attention' | 'urgent';

export type DoseStatus = 'pending' | 'taken' | 'missed' | 'snoozed' | 'cannot_take';

export type DoseActionReason =
  | 'side_effect'
  | 'medicine_unavailable'
  | 'forgot'
  | 'doctor_advised_stop'
  | 'other';

export type HealthState = 'good' | 'ok' | 'bad';


export type CareGapType =
  | 'new_symptom'
  | 'missing_severity'
  | 'repeated_missed_dose'
  | 'unanswered_followup'
  | 'overdue_update'
  | 'allergy_conflict'
  | 'duplicate_medicine';

export type CareGapStatus = 'open' | 'reviewed' | 'followup_planned';

export type PrescriptionFieldStatus = 'uncertain' | 'confirmed' | 'editable';

export interface PrescriptionField {
  key: string;
  labelKey: string;
  value: string;
  status: PrescriptionFieldStatus;
}

export interface PrescriptionDraft {
  id: string;
  patientId: string;
  imageUrl: string;
  uploadedAt: string;
  fields: PrescriptionField[];
  confirmed: boolean;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  rawText?: string | null;
}

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  confirmed: boolean;
}

export interface CarePlan {
  id: string;
  patientId: string;
  prescriptionId?: string;
  doctorId?: string;
  status: 'draft' | 'active' | 'completed' | 'discontinued';
  diagnosis?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PatientIntakeData = Omit<PatientProfile, 'id'>;


export interface MedicationSchedule {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  status: DoseStatus;
  instructions: string;
  snoozedUntil?: string | null;
  reason?: string | null;
  patientId?: string;
}

export interface AdherenceLog {
  id: string;
  scheduleId: string;
  medicineName: string;
  scheduledTime: string;
  status: DoseStatus;
  recordedAt: string | null;
  reason?: string | null;
  notes?: string | null;
}

export interface HealthUpdate {
  id: string;
  patientId: string;
  state: HealthState;
  symptomDescription: string;
  submittedAt: string;
  source: 'patient' | 'doctor';
}

export interface CareGap {
  id: string;
  patientId: string;
  type: CareGapType;
  evidence: string;
  timestamp: string;
  missingInfo: string | null;
  followupQuestion: string | null;
  status: CareGapStatus;
  severity?: 'low' | 'medium' | 'high';
}

export interface FollowUp {
  id: string;
  patientId: string;
  question: string;
  askedAt: string;
  answeredAt: string | null;
  answer: string | null;
  status: 'pending' | 'answered' | 'planned';
}

export interface Reminder {
  id: string;
  patientId: string;
  scheduleId?: string;
  type: 'dose' | 'missed_dose' | 'followup' | 'doctor_review';
  message: string;
  scheduledFor: string;
  acknowledged: boolean;
  channel?: 'in_app_simulated' | 'push' | 'sms';
  escalated?: boolean;
}

export interface PatientProfile {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  phone: string;
  symptoms: string;
  allergies: string;
  currentMeds: string;
  language: Language;
}

export interface PatientSummary {
  patient: PatientProfile;
  dosesToday: {
    taken: number;
    missed: number;
    pending: number;
    total: number;
  };
  adherence7Day: number;
  latestUpdate: HealthUpdate | null;
  openGaps: number;
  gapReasons: string[];
  lastUpdateAt: string;
  priority: Priority;
  triageScore?: number;
  criticalSafetyOverride?: boolean;
  criticalAlertMessage?: string;
  scoreFactors?: { reason: string; points: number; evidence?: string }[];
  pendingRxCount?: number;
  dataWarnings?: string[];
  overdueFollowUpsCount?: number;
  overdueTasksCount?: number;
}


export interface CaregiverAccess {
  patientId: string;
  caregiverName: string;
  authorized: boolean;
  contactNumber: string | null;
  relationship: string;
}

export interface FamilyView {
  patientName: string;
  headlineKey: string;
  dosesToday: { taken: number; total: number };
  nextDoseTime: string | null;
  healthUpdateStatus: string;
  missedDose: boolean;
  caregiverAccess: CaregiverAccess;
}

export type MedicalReportType = 'lab' | 'cardiology' | 'discharge' | 'radiology' | 'other';

export interface MedicalReportFinding {
  testOrParameter: string;
  value: string;
  unit?: string | null;
  referenceRange?: string | null;
  isAbnormal?: boolean | null; // true = outside range; false = in range; null = range not provided
  clinicalNotes?: string;
  sourceEvidence?: string;
}

export interface MedicalReport {
  id: string;
  patientId: string;
  title: string;
  reportType: MedicalReportType;
  date: string;
  facilityOrLab?: string;
  orderingDoctor?: string;
  rawText: string;
  structuredFindings?: MedicalReportFinding[];
}

export type SummaryEngineMode = 'rule_based_mvp' | 'ai_assisted' | 'ai_unavailable_fallback';

export interface ReportSummary {
  reportId: string;
  patientId: string;
  reportOverview: {
    title: string;
    reportType: string;
    date: string;
    facility?: string;
    orderingDoctor?: string;
    sourceIntegrity: 'complete' | 'incomplete' | 'unreadable' | 'empty';
  };
  keyFindings: {
    name: string;
    value: string;
    unit?: string | null;
    referenceRange?: string | null;
    flag: 'normal' | 'abnormal' | 'unspecified_range';
    sourceEvidence: string;
  }[];
  abnormalValues: {
    name: string;
    value: string;
    unit?: string | null;
    referenceRange: string;
    interpretation: string;
    sourceEvidence: string;
  }[];
  missingOrUncertainInfo: {
    item: string;
    reason: string;
  }[];
  needsClinicianReview: {
    questionOrFinding: string;
    context: string;
  }[];
  disclaimer: string;
  engineMode: SummaryEngineMode;
  aiMetadata?: {
    provider: 'groq' | 'gemini' | 'anthropic' | 'openai' | 'mock_test_provider' | 'none';
    modelName: string;
    verifiedGrounded: boolean;
    latencyMs?: number;
    failureReason?: string;
  };
  generatedAt: string;
}

export type FindingChangeDirection = 'increased' | 'decreased' | 'unchanged' | 'incomparable';

export interface ComparedFinding {
  testName: string;
  baseline: {
    reportId: string;
    reportDate: string;
    value: string;
    numericValue: number | null;
    unit?: string | null;
    referenceRange?: string | null;
    isAbnormal?: boolean | null;
    status: 'present' | 'unavailable';
  };
  current: {
    reportId: string;
    reportDate: string;
    value: string;
    numericValue: number | null;
    unit?: string | null;
    referenceRange?: string | null;
    isAbnormal?: boolean | null;
    status: 'present' | 'unavailable';
  };
  comparable: boolean;
  delta: number | null;
  percentChange: number | null;
  direction: FindingChangeDirection;
  incomparabilityReason?: string;
}

export interface ReportComparisonResult {
  patientId: string;
  baselineReport: {
    id: string;
    title: string;
    date: string;
    reportType: MedicalReportType;
  };
  comparisonReport: {
    id: string;
    title: string;
    date: string;
    reportType: MedicalReportType;
  };
  findings: ComparedFinding[];
  disclaimer: string;
  generatedAt: string;
}

export interface LabTrendDataPoint {
  reportId: string;
  date: string;
  value: string;
  numericValue: number | null;
  unit?: string | null;
  referenceRange?: string | null;
  isAbnormal?: boolean | null;
}

export interface LabTrendSeries {
  testName: string;
  unit: string;
  dataPoints: LabTrendDataPoint[];
  hasSufficientData: boolean; // true if >= 3 data points
  summary?: {
    min: number;
    max: number;
    earliest: number;
    latest: number;
    delta: number;
    direction: FindingChangeDirection;
  };
  insufficientDataReason?: string;
}

