import { supabase, isDemoMode } from '@/lib/supabase';
import {
  demoPatients,
  demoSchedules,
  demoCareGaps,
  demoPrescriptionDrafts,
  demoFollowUps,
  demoHealthUpdates,
  demoFamilyView,
  demoCaregiverAccess,
  demoAdherenceLogs,
  demoMedicalReports,
  getPatientSummaries,
} from '@/data/demoData';
import { calculatePatientTriageScore } from '@/services/careGapRules';
import { calculateSnoozeTimestamp } from '@/utils/reminderEngine';
import { summarizeMedicalReport } from '@/services/reportSummarizer';
import type {
  PatientSummary,
  MedicationSchedule,
  HealthUpdate,
  CareGap,
  PrescriptionDraft,
  FollowUp,
  FamilyView,
  CaregiverAccess,
  DoseStatus,
  HealthState,
  PrescriptionField,
  PatientProfile,
  AdherenceLog,
  MedicalReport,
  ReportSummary,
} from '@/types';

export interface PrescriptionScanResult {
  data: PrescriptionDraft;
  confidence: 'high' | 'medium' | 'low';
  missingCriticalFields: string[];
  disclaimer: string;
}

export interface DataService {
  readonly mode: 'demo' | 'production';

  // 1. Fetching patients and dashboard data
  fetchPatients(): Promise<PatientProfile[]>;
  fetchPatient(patientId: string): Promise<PatientProfile | null>;
  fetchPatientSummaries(): Promise<PatientSummary[]>;
  fetchMedicationSchedules(patientId: string): Promise<MedicationSchedule[]>;

  // 2. Saving patient intake information
  savePatientIntake(profile: Partial<PatientProfile>): Promise<{ data: PatientProfile } | { error: string }>;

  // 3. Uploading a prescription image to private storage
  uploadPrescriptionImage(patientId: string, file: File): Promise<{ url: string; path?: string } | { error: string }>;

  // 3b. AI Prescription Scanning with Gemini Vision
  scanPrescription(
    patientId: string,
    image: File | Blob,
    options?: { imageUrl?: string; useMock?: boolean }
  ): Promise<PrescriptionScanResult | { error: string; code?: string }>;

  // 4. Saving prescription extraction drafts
  savePrescriptionDraft(
    patientId: string,
    imageUrl: string,
    fields: PrescriptionField[]
  ): Promise<{ data: PrescriptionDraft } | { error: string }>;
  fetchPrescriptionDraft(patientId: string): Promise<PrescriptionDraft | null>;

  // 5. Doctor review and confirmation of a care plan
  confirmCarePlan(
    patientId: string,
    fields: PrescriptionField[],
    doctorNotes?: string
  ): Promise<{ ok: true } | { error: string }>;

  // 6. Recording medication adherence
  recordAdherence(
    scheduleId: string,
    status: DoseStatus,
    reason?: string,
    notes?: string
  ): Promise<{ ok: true } | { error: string }>;
  fetchAdherenceLogs(patientId: string): Promise<AdherenceLog[]>;

  // 7. Submitting patient health updates
  submitHealthUpdate(
    patientId: string,
    state: HealthState,
    description: string,
    source?: 'patient' | 'doctor'
  ): Promise<{ data: HealthUpdate } | { error: string }>;
  fetchHealthUpdates(patientId: string): Promise<HealthUpdate[]>;

  // 8. Fetching and reviewing CareGaps
  fetchCareGaps(patientId: string): Promise<CareGap[]>;
  createCareGap(gap: Omit<CareGap, 'id'>): Promise<{ data: CareGap } | { error: string }>;
  updateCareGapStatus(
    gapId: string,
    status: 'open' | 'reviewed' | 'followup_planned'
  ): Promise<{ ok: true } | { error: string }>;

  // 9. Reading caregiver consent and authorized family summaries
  fetchCaregiverAccess(patientId: string): Promise<CaregiverAccess | null>;
  updateCaregiverAccess(patientId: string, authorized: boolean): Promise<{ ok: true } | { error: string }>;
  fetchFamilyView(patientId: string): Promise<FamilyView | null>;

  // 10. Follow-up questions
  fetchFollowUps(patientId: string): Promise<FollowUp[]>;
  updateFollowUp(followUpId: string, answer: string): Promise<{ ok: true } | { error: string }>;

  // 11. Realtime / Live Synchronizations
  subscribeToLiveUpdates(onUpdate: () => void): () => void;

  // 12. Medical Reports & Safe Summarization
  fetchMedicalReports(patientId: string): Promise<MedicalReport[]>;
  getReportSummary(
    reportId: string,
    patientId: string,
    options?: { preferAI?: boolean }
  ): Promise<ReportSummary | null>;
}

// In-memory demo store for fully interactive demo mode without DB
const mutableDemoPatients: PatientProfile[] = [...demoPatients];
const mutableDemoSchedules: Record<string, MedicationSchedule[]> = { ...demoSchedules };
const mutableDemoCareGaps: Record<string, CareGap[]> = { ...demoCareGaps };
const mutableDemoPrescriptionDrafts: Record<string, PrescriptionDraft> = { ...demoPrescriptionDrafts };
const mutableDemoFollowUps: Record<string, FollowUp[]> = { ...demoFollowUps };
const mutableDemoHealthUpdates: Record<string, HealthUpdate[]> = { ...demoHealthUpdates };
const mutableDemoCaregiverAccess: Record<string, CaregiverAccess> = {
  p1: { ...demoCaregiverAccess },
};
const mutableDemoAdherenceLogs: Record<string, AdherenceLog[]> = { ...demoAdherenceLogs };
const mutableDemoMedicalReports: Record<string, MedicalReport[]> = { ...demoMedicalReports };

// Listeners for demo mode live reactivity
const demoListeners = new Set<() => void>();
function notifyDemoListeners() {
  demoListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.warn('Error in demo listener callback:', err);
    }
  });
}

/**
 * Validates critical prescription fields.
 * Any missing or unverified critical field blocks confirmation.
 */
function validatePrescriptionConfirmation(fields: PrescriptionField[]): string | null {
  const CRITICAL_KEYS = ['medicine', 'dosage', 'frequency', 'duration'];

  // 1. Ensure all critical keys exist in the fields array
  const presentKeys = new Set(fields.map((f) => f.key));
  const missingKeys = CRITICAL_KEYS.filter((k) => !presentKeys.has(k));
  if (missingKeys.length > 0) {
    return `Cannot confirm care plan: Missing required critical fields (${missingKeys.join(', ')}).`;
  }

  // 2. Ensure each critical field is verified and marked 'confirmed' (not 'uncertain' or 'editable')
  const invalidFields = fields.filter(
    (f) =>
      CRITICAL_KEYS.includes(f.key) &&
      (!f.value || !f.value.trim() || f.status !== 'confirmed')
  );

  if (invalidFields.length > 0) {
    const names = invalidFields.map((f) => `${f.key} (status: ${f.status || 'empty'})`).join(', ');
    return `Cannot confirm care plan: Critical fields must be verified and confirmed (${names}).`;
  }
  return null;
}

/**
 * Dispatches an AI summarization request to the server-side Edge Function runner.
 * 
 * Trace Path:
 * Frontend -> dataService -> local backend runner or Supabase Edge Function ->
 * Bearer Token Auth & Patient Authorization -> Groq Provider -> Clinical Grounding Validator -> Frontend
 * 
 * In the event of service unreachability, safely and honestly returns 'ai_unavailable_fallback'.
 */
async function invokeAIReportSummary(report: MedicalReport): Promise<ReportSummary> {
  const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined;
  const configuredFunctionsUrl = (metaEnv?.VITE_SUPABASE_FUNCTIONS_URL as string | undefined)?.trim();

  let authToken = 'test-valid-jwt-token';
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        authToken = sessionData.session.access_token;
      }
    } catch {
      // Use test token
    }
  }

  // Endpoints to attempt in prioritized order
  const candidateUrls: string[] = [];
  if (configuredFunctionsUrl) {
    candidateUrls.push(`${configuredFunctionsUrl.replace(/\/$/, '')}/summarize-medical-report`);
  }
  const isLocalDev =
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
  if (isLocalDev) {
    candidateUrls.push('http://localhost:54321/functions/v1/summarize-medical-report');
  }

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ report }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          return json.data as ReportSummary;
        }
      }
    } catch (err: any) {
      console.warn(`[AI Summarizer] Candidate endpoint ${url} unreachable:`, err?.message);
    }
  }

  // Fallback to Supabase client invoke if configured
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('summarize-medical-report', {
        body: { report },
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!error && data && data.data) {
        return data.data as ReportSummary;
      }
    } catch (err: any) {
      console.warn('[AI Edge Function Proxy] Supabase client invoke failed:', err.message);
    }
  }

  // Safe fallback: never label mock as real AI
  const fallback = summarizeMedicalReport(report);
  return {
    ...fallback,
    engineMode: 'ai_unavailable_fallback',
    aiMetadata: {
      provider: 'none',
      modelName: 'none',
      verifiedGrounded: true,
      failureReason: 'AI service unavailable in current environment; displaying verified deterministic fallback.',
    },
  };
}

/**
 * Safely converts a File or Blob into base64 and detects MIME type.
 * Works in both modern browser and Node/testing environments.
 */
export async function convertBlobToBase64(
  blob: Blob
): Promise<{ base64: string; mimeType: string }> {
  const mimeType = blob.type || 'image/jpeg';
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve({ base64, mimeType });
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(blob);
    });
  } else {
    const arrayBuffer = await blob.arrayBuffer();
    const g = globalThis as any;
    if (typeof g.Buffer !== 'undefined') {
      return { base64: g.Buffer.from(arrayBuffer).toString('base64'), mimeType };
    }
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { base64: btoa(binary), mimeType };
  }
}

/**
 * Dispatches an AI prescription scanning request to the server-side Edge Function runner.
 * 
 * Trace Path:
 * Frontend (PrescriptionProcessing) -> dataService.scanPrescription ->
 * Local runner / Supabase Edge Function (/functions/v1/scan-prescription) ->
 * Bearer Token Auth & Patient Guard -> Gemini Vision Multimodal Extraction ->
 * Clinical Grounding Validator -> Frontend (Unconfirmed Draft with Disclaimers)
 */
async function invokeScanPrescriptionEndpoint(
  patientId: string,
  image: File | Blob,
  options?: { imageUrl?: string; useMock?: boolean }
): Promise<PrescriptionScanResult | { error: string; code?: string }> {
  if (!patientId || !patientId.trim()) {
    return {
      error: 'Invalid request: "patientId" is required.',
      code: 'INVALID_PATIENT_ID',
    };
  }

  // 1. Client-side payload size guard (10 MB decoded limit)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (image.size > MAX_SIZE) {
    return {
      error: 'Image size exceeds maximum limit of 10 MB.',
      code: 'PAYLOAD_TOO_LARGE',
    };
  }

  // 2. Client-side MIME validation
  const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  const mimeType = (image.type || 'image/jpeg').toLowerCase();
  if (!ALLOWED_MIMES.includes(mimeType)) {
    return {
      error: `Invalid image format "${mimeType}". Supported formats: JPEG, PNG, WebP.`,
      code: 'INVALID_MIME_TYPE',
    };
  }

  // 3. Convert Blob/File to Base64
  let base64: string;
  try {
    const converted = await convertBlobToBase64(image);
    base64 = converted.base64;
  } catch (err: any) {
    return {
      error: err?.message || 'Failed to read image file into base64.',
      code: 'IMAGE_READ_ERROR',
    };
  }

  // 4. Client authorization token
  let authToken = 'test-valid-jwt-token';
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        authToken = sessionData.session.access_token;
      }
    } catch {
      // Use test token
    }
  }

  // 5. Candidate endpoint resolution
  const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined;
  const configuredFunctionsUrl = (metaEnv?.VITE_SUPABASE_FUNCTIONS_URL as string | undefined)?.trim();

  const candidateUrls: string[] = [];
  if (configuredFunctionsUrl) {
    candidateUrls.push(`${configuredFunctionsUrl.replace(/\/$/, '')}/scan-prescription`);
  }
  const isLocalDev =
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
  if (isLocalDev) {
    candidateUrls.push('http://localhost:54321/functions/v1/scan-prescription');
  }

  const payload = {
    patientId: patientId.trim(),
    imageBase64: base64,
    mimeType,
    imageUrl: options?.imageUrl || (image instanceof File ? image.name : 'uploaded-prescription.jpg'),
    useMock: options?.useMock,
  };

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          return json as PrescriptionScanResult;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        return {
          error: errJson.error || `Prescription scanner request failed with HTTP ${res.status}.`,
          code: errJson.code || 'SCAN_REQUEST_FAILED',
        };
      }
    } catch (err: any) {
      console.warn(`[Prescription Scanner] Candidate endpoint ${url} unreachable:`, err?.message);
    }
  }

  // 6. Supabase client invoke fallback
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('scan-prescription', {
        body: payload,
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!error && data && data.data) {
        return data as PrescriptionScanResult;
      }
      if (error) {
        return {
          error: error.message || 'Prescription scan failed via Supabase invoke.',
          code: 'SCAN_INVOKE_FAILED',
        };
      }
    } catch (err: any) {
      console.warn('[Prescription Edge Function Proxy] Supabase invoke failed:', err?.message);
    }
  }

  // Do NOT silently fall back to client text parsing or fake successful scan
  return {
    error: 'AI Prescription Scanner service is currently unreachable. Please ensure the backend server is running and retry.',
    code: 'SERVICE_UNREACHABLE',
  };
}

const demoService: DataService = {
  mode: 'demo',

  async fetchPatients() {
    return [...mutableDemoPatients];
  },

  async fetchPatient(patientId) {
    return mutableDemoPatients.find((p) => p.id === patientId) ?? null;
  },

  async fetchPatientSummaries() {
    return mutableDemoPatients.map((patient) => {
      const schedules = mutableDemoSchedules[patient.id] ?? [];
      const updates = mutableDemoHealthUpdates[patient.id] ?? [];
      const gaps = mutableDemoCareGaps[patient.id] ?? [];
      const followUps = mutableDemoFollowUps[patient.id] ?? [];
      const draft = mutableDemoPrescriptionDrafts[patient.id];

      const taken = schedules.filter((s) => s.status === 'taken').length;
      const missed = schedules.filter((s) => s.status === 'missed' || s.status === 'cannot_take').length;
      const pending = schedules.filter((s) => s.status === 'pending' || s.status === 'snoozed').length;

      const triageResult = calculatePatientTriageScore(patient, updates, schedules, followUps, gaps);
      const latestUpdate = updates[0] ?? null;
      const pendingRxCount = draft && !draft.confirmed ? 1 : 0;

      return {
        patient,
        dosesToday: {
          taken,
          missed,
          pending,
          total: schedules.length,
        },
        adherence7Day: schedules.length > 0 ? Math.round((taken / schedules.length) * 100) : 100,
        latestUpdate,
        openGaps: gaps.filter((g) => g.status === 'open').length,
        gapReasons: triageResult.reasons.length > 0 ? triageResult.reasons : gaps.map((g) => g.evidence),
        lastUpdateAt: latestUpdate?.submittedAt ?? new Date().toISOString(),
        priority: triageResult.priority,
        triageScore: triageResult.score,
        criticalSafetyOverride: triageResult.criticalSafetyOverride,
        criticalAlertMessage: triageResult.criticalAlertMessage,
        scoreFactors: triageResult.factors,
        pendingRxCount,
        dataWarnings: triageResult.dataWarnings,
        overdueFollowUpsCount: followUps.filter((f) => f.status === 'pending' && (Date.now() - new Date(f.askedAt).getTime()) > 86400000).length,
        overdueTasksCount: patient.id === 'p1' ? 1 : 0,
      };
    });
  },

  async fetchMedicationSchedules(patientId) {
    return mutableDemoSchedules[patientId] ?? [];
  },

  async fetchCareGaps(patientId) {
    return mutableDemoCareGaps[patientId] ?? [];
  },

  async createCareGap(gap) {
    const newGap: CareGap = {
      ...gap,
      id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    if (!mutableDemoCareGaps[gap.patientId]) {
      mutableDemoCareGaps[gap.patientId] = [];
    }
    mutableDemoCareGaps[gap.patientId].unshift(newGap);
    notifyDemoListeners();
    return { data: newGap };
  },

  async fetchPrescriptionDraft(patientId) {
    return mutableDemoPrescriptionDrafts[patientId] ?? null;
  },

  async fetchFollowUps(patientId) {
    return mutableDemoFollowUps[patientId] ?? [];
  },

  async fetchHealthUpdates(patientId) {
    return mutableDemoHealthUpdates[patientId] ?? [];
  },

  async fetchAdherenceLogs(patientId) {
    return mutableDemoAdherenceLogs[patientId] ?? [];
  },

  async fetchCaregiverAccess(patientId) {
    return mutableDemoCaregiverAccess[patientId] ?? demoCaregiverAccess;
  },

  async fetchFamilyView(patientId) {
    const caregiverAccess = mutableDemoCaregiverAccess[patientId] ?? demoCaregiverAccess;
    const patient = mutableDemoPatients.find((p) => p.id === patientId);
    const schedules = mutableDemoSchedules[patientId] ?? [];
    const updates = mutableDemoHealthUpdates[patientId] ?? [];

    const isAuthorized = caregiverAccess.authorized;

    // If caregiver access is revoked, return strictly redacted view
    if (!isAuthorized) {
      return {
        patientName: patient?.name ?? demoFamilyView.patientName,
        headlineKey: 'family_headline',
        dosesToday: { taken: 0, total: 0 },
        nextDoseTime: null,
        healthUpdateStatus: 'Consent Revoked',
        missedDose: false,
        caregiverAccess: {
          ...caregiverAccess,
          contactNumber: null,
        },
      };
    }

    const takenDoses = schedules.filter((s) => s.status === 'taken').length;
    const hasMissed = schedules.some((s) => s.status === 'missed' || s.status === 'cannot_take');
    const nextDose = schedules.find((s) => s.status === 'pending' || s.status === 'snoozed')?.scheduledTime ?? null;

    return {
      patientName: patient?.name ?? demoFamilyView.patientName,
      headlineKey: 'family_headline',
      dosesToday: { taken: takenDoses, total: schedules.length || 3 },
      nextDoseTime: nextDose,
      healthUpdateStatus: updates[0]
        ? updates[0].state === 'good'
          ? 'Feeling well'
          : updates[0].state === 'ok'
          ? 'Recovering steadily'
          : 'Reported symptoms'
        : 'Submitted',
      missedDose: hasMissed,
      caregiverAccess,
    };
  },

  async savePatientIntake(profile) {
    const newId = `p-${Date.now()}`;
    const newPatient: PatientProfile = {
      id: newId,
      name: profile.name || 'New Patient',
      age: profile.age || 40,
      gender: profile.gender || 'other',
      phone: profile.phone || '',
      symptoms: profile.symptoms || '',
      allergies: profile.allergies || 'None',
      currentMeds: profile.currentMeds || '',
      language: profile.language || 'hi',
    };
    mutableDemoPatients.unshift(newPatient);
    mutableDemoSchedules[newId] = [];
    mutableDemoCareGaps[newId] = [];
    mutableDemoHealthUpdates[newId] = [];
    notifyDemoListeners();
    return { data: newPatient };
  },

  async uploadPrescriptionImage(_patientId, file) {
    try {
      const url = URL.createObjectURL(file);
      return { url };
    } catch {
      return { url: 'https://images.pexels.com/photos/139398/brainstorming-meeting-patients-diagnosis-139398.jpeg' };
    }
  },

  async scanPrescription(patientId, image, options) {
    const result = await invokeScanPrescriptionEndpoint(patientId, image, options);
    if ('data' in result) {
      mutableDemoPrescriptionDrafts[patientId] = result.data;
      notifyDemoListeners();
    }
    return result;
  },

  async savePrescriptionDraft(patientId, imageUrl, fields) {
    const draft: PrescriptionDraft = {
      id: `rx-${Date.now()}`,
      patientId,
      imageUrl,
      uploadedAt: new Date().toISOString(),
      fields,
      confirmed: false,
    };
    mutableDemoPrescriptionDrafts[patientId] = draft;
    notifyDemoListeners();
    return { data: draft };
  },

  async confirmCarePlan(patientId, fields) {
    const validationError = validatePrescriptionConfirmation(fields);
    if (validationError) {
      return { error: validationError };
    }

    const existingDraft = mutableDemoPrescriptionDrafts[patientId];
    if (existingDraft) {
      existingDraft.confirmed = true;
      existingDraft.confirmedAt = new Date().toISOString();
      existingDraft.confirmedBy = 'Dr. Anita Desai, MD';
      existingDraft.fields = fields.map((f) => ({ ...f, status: 'confirmed' }));
    }

    // Activate medication schedule from confirmed fields
    const medName = fields.find((f) => f.key === 'medicine')?.value ?? 'Prescribed Medicine';
    const dosage = fields.find((f) => f.key === 'dosage')?.value ?? 'Standard Dose';
    const instructions = fields.find((f) => f.key === 'instructions')?.value ?? 'As directed';

    if (!mutableDemoSchedules[patientId] || mutableDemoSchedules[patientId].length === 0) {
      mutableDemoSchedules[patientId] = [
        {
          id: `s-${Date.now()}`,
          medicineId: `m-${Date.now()}`,
          medicineName: medName,
          dosage,
          scheduledTime: '08:00',
          status: 'pending',
          instructions,
        },
      ];
    }

    notifyDemoListeners();
    return { ok: true };
  },

  async recordAdherence(scheduleId, status, reason, notes) {
    for (const pid of Object.keys(mutableDemoSchedules)) {
      const target = mutableDemoSchedules[pid]?.find((s) => s.id === scheduleId);
      if (target) {
        target.status = status;
        if (status === 'snoozed') {
          target.snoozedUntil = calculateSnoozeTimestamp(10);
        } else {
          target.snoozedUntil = null;
        }
        target.reason = reason || null;

        if (!mutableDemoAdherenceLogs[pid]) mutableDemoAdherenceLogs[pid] = [];
        mutableDemoAdherenceLogs[pid].push({
          id: `adh-${Date.now()}`,
          scheduleId,
          medicineName: target.medicineName,
          scheduledTime: target.scheduledTime,
          status,
          recordedAt: new Date().toISOString(),
          reason: reason || null,
          notes: notes || null,
        });
        break;
      }
    }
    notifyDemoListeners();
    return { ok: true };
  },

  async submitHealthUpdate(patientId, state, description, source = 'patient') {
    const update: HealthUpdate = {
      id: `h-${Date.now()}`,
      patientId,
      state,
      symptomDescription: description,
      submittedAt: new Date().toISOString(),
      source,
    };
    if (!mutableDemoHealthUpdates[patientId]) {
      mutableDemoHealthUpdates[patientId] = [];
    }
    mutableDemoHealthUpdates[patientId].unshift(update);
    notifyDemoListeners();
    return { data: update };
  },

  async updateCareGapStatus(gapId, status) {
    for (const pid of Object.keys(mutableDemoCareGaps)) {
      const gap = mutableDemoCareGaps[pid]?.find((g) => g.id === gapId);
      if (gap) {
        gap.status = status;
        break;
      }
    }
    notifyDemoListeners();
    return { ok: true };
  },

  async updateFollowUp(followUpId, answer) {
    for (const pid of Object.keys(mutableDemoFollowUps)) {
      const f = mutableDemoFollowUps[pid]?.find((item) => item.id === followUpId);
      if (f) {
        f.answer = answer;
        f.answeredAt = new Date().toISOString();
        f.status = 'answered';
        break;
      }
    }
    notifyDemoListeners();
    return { ok: true };
  },

  async updateCaregiverAccess(patientId, authorized) {
    if (!mutableDemoCaregiverAccess[patientId]) {
      mutableDemoCaregiverAccess[patientId] = { ...demoCaregiverAccess, patientId };
    }
    mutableDemoCaregiverAccess[patientId].authorized = authorized;
    notifyDemoListeners();
    return { ok: true };
  },

  subscribeToLiveUpdates(onUpdate: () => void): () => void {
    demoListeners.add(onUpdate);
    return () => {
      demoListeners.delete(onUpdate);
    };
  },

  async fetchMedicalReports(patientId) {
    return mutableDemoMedicalReports[patientId] ?? [];
  },

  async getReportSummary(reportId, patientId, options) {
    const reports = await this.fetchMedicalReports(patientId);
    const report = reports.find((r) => r.id === reportId);
    if (!report) return null;

    if (options?.preferAI) {
      return invokeAIReportSummary(report);
    }

    return summarizeMedicalReport(report);
  },
};

const productionService: DataService = {
  mode: 'production',

  async fetchPatients() {
    if (!supabase) throw new Error('Supabase client is not configured');
    const { data, error } = await supabase.from('patients').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      age: row.age,
      gender: row.gender,
      phone: row.phone,
      symptoms: row.symptoms ?? '',
      allergies: row.allergies ?? 'None',
      currentMeds: row.current_meds ?? '',
      language: row.language ?? 'hi',
    })) as PatientProfile[];
  },

  async fetchPatient(patientId) {
    if (!supabase) throw new Error('Supabase client is not configured');
    const { data, error } = await supabase.from('patients').select('*').eq('id', patientId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      age: data.age,
      gender: data.gender,
      phone: data.phone,
      symptoms: data.symptoms ?? '',
      allergies: data.allergies ?? 'None',
      currentMeds: data.current_meds ?? '',
      language: data.language ?? 'hi',
    } as PatientProfile;
  },

  async fetchPatientSummaries() {
    if (!supabase) throw new Error('Supabase client is not configured');

    // 1. Fetch patients
    const { data: patientRows, error: pError } = await supabase.from('patients').select('*');
    if (pError) throw pError;

    const patients = (patientRows ?? []) as any[];

    // 2. Fetch associated records to compute live heuristic scores and dose metrics
    const summaries: PatientSummary[] = [];

    for (const p of patients) {
      const patientProfile: PatientProfile = {
        id: p.id,
        name: p.name,
        age: p.age,
        gender: p.gender,
        phone: p.phone,
        symptoms: p.symptoms ?? '',
        allergies: p.allergies ?? 'None',
        currentMeds: p.current_meds ?? '',
        language: p.language ?? 'hi',
      };

      const [schedulesRes, updatesRes, gapsRes, followUpsRes, rxRes] = await Promise.all([
        supabase.from('medication_schedules').select('*').eq('patient_id', p.id),
        supabase.from('health_updates').select('*').eq('patient_id', p.id).order('submitted_at', { ascending: false }),
        supabase.from('care_gaps').select('*').eq('patient_id', p.id).order('created_at', { ascending: false }),
        supabase.from('follow_ups').select('*').eq('patient_id', p.id).order('asked_at', { ascending: false }),
        supabase.from('prescriptions').select('id, confirmed').eq('patient_id', p.id).eq('confirmed', false),
      ]);

      const schedules: MedicationSchedule[] = (schedulesRes.data ?? []).map((s: any) => ({
        id: s.id,
        medicineId: s.care_plan_id ?? s.id,
        medicineName: s.medicine_name,
        dosage: s.dosage,
        scheduledTime: s.scheduled_time,
        status: s.status,
        instructions: s.instructions ?? '',
        patientId: s.patient_id,
      }));

      const updates: HealthUpdate[] = (updatesRes.data ?? []).map((u: any) => ({
        id: u.id,
        patientId: u.patient_id,
        state: u.state,
        symptomDescription: u.symptom_description ?? '',
        submittedAt: u.submitted_at,
        source: u.source ?? 'patient',
      }));

      const careGaps: CareGap[] = (gapsRes.data ?? []).map((g: any) => ({
        id: g.id,
        patientId: g.patient_id,
        type: g.type,
        evidence: g.evidence,
        timestamp: g.created_at,
        missingInfo: g.missing_info,
        followupQuestion: g.followup_question,
        status: g.status,
      }));

      const followUps: FollowUp[] = (followUpsRes.data ?? []).map((f: any) => ({
        id: f.id,
        patientId: f.patient_id,
        question: f.question,
        askedAt: f.asked_at,
        answeredAt: f.answered_at,
        answer: f.answer,
        status: f.status,
      }));

      const pendingRxCount = rxRes.data?.length ?? 0;
      const taken = schedules.filter((s) => s.status === 'taken').length;
      const missed = schedules.filter((s) => s.status === 'missed' || s.status === 'cannot_take').length;
      const pending = schedules.filter((s) => s.status === 'pending' || s.status === 'snoozed').length;

      const triageResult = calculatePatientTriageScore(patientProfile, updates, schedules, followUps, careGaps);
      const latestUpdate = updates[0] ?? null;

      summaries.push({
        patient: patientProfile,
        dosesToday: {
          taken,
          missed,
          pending,
          total: schedules.length,
        },
        adherence7Day: schedules.length > 0 ? Math.round((taken / schedules.length) * 100) : 100,
        latestUpdate,
        openGaps: careGaps.filter((g) => g.status === 'open').length,
        gapReasons: triageResult.reasons.length > 0 ? triageResult.reasons : careGaps.map((g) => g.evidence),
        lastUpdateAt: latestUpdate?.submittedAt ?? p.created_at,
        priority: triageResult.priority,
        triageScore: triageResult.score,
        criticalSafetyOverride: triageResult.criticalSafetyOverride,
        criticalAlertMessage: triageResult.criticalAlertMessage,
        scoreFactors: triageResult.factors,
        pendingRxCount,
        dataWarnings: triageResult.dataWarnings,
        overdueFollowUpsCount: followUps.filter((f) => f.status === 'pending' && (Date.now() - new Date(f.askedAt).getTime()) > 86400000).length,
        overdueTasksCount: 0,
      });
    }

    return summaries;
  },

  async fetchMedicationSchedules(patientId) {
    if (!supabase) throw new Error('Supabase client is not configured');
    const { data, error } = await supabase
      .from('medication_schedules')
      .select('*')
      .eq('patient_id', patientId)
      .order('scheduled_time', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      medicineId: row.care_plan_id ?? row.id,
      medicineName: row.medicine_name,
      dosage: row.dosage,
      scheduledTime: row.scheduled_time,
      status: row.status as DoseStatus,
      instructions: row.instructions ?? '',
      patientId: row.patient_id,
    })) as MedicationSchedule[];
  },

  async fetchCareGaps(patientId) {
    if (!supabase) throw new Error('Supabase client is not configured');
    const { data, error } = await supabase
      .from('care_gaps')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      type: row.type,
      evidence: row.evidence,
      timestamp: row.created_at,
      missingInfo: row.missing_info,
      followupQuestion: row.followup_question,
      status: row.status,
    })) as CareGap[];
  },

  async createCareGap(gap) {
    if (!supabase) return { error: 'Supabase client is not configured' };
    const { data, error } = await supabase
      .from('care_gaps')
      .insert({
        patient_id: gap.patientId,
        type: gap.type,
        evidence: gap.evidence,
        missing_info: gap.missingInfo,
        followup_question: gap.followupQuestion,
        status: gap.status ?? 'open',
      })
      .select()
      .single();
    if (error) return { error: error.message };
    return {
      data: {
        id: data.id,
        patientId: data.patient_id,
        type: data.type,
        evidence: data.evidence,
        timestamp: data.created_at,
        missingInfo: data.missing_info,
        followupQuestion: data.followup_question,
        status: data.status,
      },
    };
  },

  async fetchPrescriptionDraft(patientId) {
    if (!supabase) throw new Error('Supabase client is not configured');
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const parsedFields: PrescriptionField[] =
      typeof data.fields === 'string' ? JSON.parse(data.fields) : (data.fields ?? []);

    return {
      id: data.id,
      patientId: data.patient_id,
      imageUrl: data.image_url,
      uploadedAt: data.created_at,
      fields: parsedFields,
      confirmed: data.confirmed,
    };
  },

  async fetchFollowUps(patientId) {
    if (!supabase) throw new Error('Supabase client is not configured');
    const { data, error } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('patient_id', patientId)
      .order('asked_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      question: row.question,
      askedAt: row.asked_at,
      answeredAt: row.answered_at,
      answer: row.answer,
      status: row.status,
    })) as FollowUp[];
  },

  async fetchHealthUpdates(patientId) {
    if (!supabase) throw new Error('Supabase client is not configured');
    const { data, error } = await supabase
      .from('health_updates')
      .select('*')
      .eq('patient_id', patientId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      state: row.state as HealthState,
      symptomDescription: row.symptom_description ?? '',
      submittedAt: row.submitted_at,
      source: row.source ?? 'patient',
    })) as HealthUpdate[];
  },

  async fetchAdherenceLogs(patientId) {
    if (!supabase) throw new Error('Supabase client is not configured');
    const { data, error } = await supabase
      .from('adherence_logs')
      .select('*')
      .eq('patient_id', patientId)
      .order('recorded_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      scheduleId: row.schedule_id,
      medicineName: row.medicine_name,
      scheduledTime: row.scheduled_time,
      status: row.status as DoseStatus,
      recordedAt: row.recorded_at,
      notes: row.notes,
    })) as AdherenceLog[];
  },

  async fetchFamilyView(patientId) {
    if (!supabase) throw new Error('Supabase client is not configured');

    // 1. Check caregiver consent first — strictly preserve privacy
    const { data: consent, error: consentError } = await supabase
      .from('caregiver_consent')
      .select('*')
      .eq('patient_id', patientId)
      .maybeSingle();

    if (consentError) {
      console.error('Error reading caregiver consent:', consentError);
    }

    const isAuthorized = Boolean(consent?.authorized);

    // 2. Query patient identity
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('name')
      .eq('id', patientId)
      .maybeSingle();

    if (patientError || !patient) {
      return null;
    }

    const caregiverAccess: CaregiverAccess = {
      patientId,
      caregiverName: consent?.caregiver_name ?? 'Family Caregiver',
      authorized: isAuthorized,
      contactNumber: isAuthorized ? (consent?.contact_number ?? null) : null,
      relationship: consent?.relationship ?? 'Family',
    };

    // If caregiver access is revoked, return strictly redacted view
    if (!isAuthorized) {
      return {
        patientName: patient.name,
        headlineKey: 'family_headline',
        dosesToday: { taken: 0, total: 0 },
        nextDoseTime: null,
        healthUpdateStatus: 'Consent Revoked',
        missedDose: false,
        caregiverAccess,
      };
    }

    // 3. Authorized summary only: aggregate doses today & latest high-level health state
    const { data: schedules } = await supabase
      .from('medication_schedules')
      .select('*')
      .eq('patient_id', patientId);

    const schedList = (schedules ?? []) as any[];
    const takenCount = schedList.filter((s) => s.status === 'taken').length;
    const hasMissed = schedList.some((s) => s.status === 'missed' || s.status === 'cannot_take');
    const nextDose = schedList.find((s) => s.status === 'pending' || s.status === 'snoozed')?.scheduled_time ?? null;

    const { data: updates } = await supabase
      .from('health_updates')
      .select('state, submitted_at')
      .eq('patient_id', patientId)
      .order('submitted_at', { ascending: false })
      .limit(1);

    const latest = updates?.[0];
    const healthStatus = latest
      ? latest.state === 'good'
        ? 'Feeling well'
        : latest.state === 'ok'
        ? 'Recovering steadily'
        : 'Reported symptoms'
      : 'Submitted';

    return {
      patientName: patient.name,
      headlineKey: 'family_headline',
      dosesToday: { taken: takenCount, total: schedList.length },
      nextDoseTime: nextDose,
      healthUpdateStatus: healthStatus,
      missedDose: hasMissed,
      caregiverAccess,
    };
  },

  async fetchCaregiverAccess(patientId) {
    if (!supabase) throw new Error('Supabase client is not configured');
    const { data, error } = await supabase
      .from('caregiver_consent')
      .select('*')
      .eq('patient_id', patientId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      patientId: data.patient_id,
      caregiverName: data.caregiver_name,
      authorized: data.authorized,
      contactNumber: data.contact_number,
      relationship: data.relationship,
    };
  },

  async savePatientIntake(profile) {
    if (!supabase) return { error: 'Supabase client is not configured' };
    const { data, error } = await supabase
      .from('patients')
      .insert({
        name: profile.name || 'New Patient',
        age: profile.age || 40,
        gender: profile.gender || 'other',
        phone: profile.phone || '',
        symptoms: profile.symptoms || '',
        allergies: profile.allergies || 'None',
        current_meds: profile.currentMeds || '',
        language: profile.language || 'hi',
      })
      .select()
      .single();

    if (error) return { error: error.message };

    return {
      data: {
        id: data.id,
        name: data.name,
        age: data.age,
        gender: data.gender,
        phone: data.phone,
        symptoms: data.symptoms ?? '',
        allergies: data.allergies ?? 'None',
        currentMeds: data.current_meds ?? '',
        language: data.language ?? 'hi',
      },
    };
  },

  async uploadPrescriptionImage(patientId, file) {
    if (!supabase) return { error: 'Supabase client is not configured' };
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${patientId}/${Date.now()}-${cleanName}`;

    // Upload to private 'prescriptions' storage bucket
    const { error: uploadError } = await supabase.storage
      .from('prescriptions')
      .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });

    if (uploadError) return { error: uploadError.message };

    // Generate short-lived signed URL (3600 seconds = 1 hour)
    const { data: urlData, error: signedUrlError } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl(path, 3600);

    if (signedUrlError || !urlData) {
      return { error: signedUrlError?.message || 'Failed to generate secure signed URL for prescription' };
    }

    return { url: urlData.signedUrl, path };
  },

  async scanPrescription(patientId, image, options) {
    const result = await invokeScanPrescriptionEndpoint(patientId, image, options);
    if ('data' in result && supabase) {
      try {
        await supabase.from('prescriptions').insert({
          patient_id: patientId,
          image_url: result.data.imageUrl || 'uploaded-prescription.jpg',
          fields: JSON.stringify(result.data.fields),
          confirmed: false,
        });
      } catch (err) {
        console.warn('[Prescription Database Sync] Could not persist draft:', err);
      }
    }
    return result;
  },

  async savePrescriptionDraft(patientId, imageUrl, fields) {
    if (!supabase) return { error: 'Supabase client is not configured' };
    const { data, error } = await supabase
      .from('prescriptions')
      .insert({
        patient_id: patientId,
        image_url: imageUrl,
        fields: JSON.stringify(fields),
        confirmed: false,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    return {
      data: {
        id: data.id,
        patientId: data.patient_id,
        imageUrl: data.image_url,
        uploadedAt: data.created_at,
        fields,
        confirmed: false,
      },
    };
  },

  async confirmCarePlan(patientId, fields, doctorNotes) {
    if (!supabase) return { error: 'Supabase client is not configured' };

    // Safety check: unresolved critical fields block confirmation
    const validationError = validatePrescriptionConfirmation(fields);
    if (validationError) {
      return { error: validationError };
    }

    // 1. Confirm prescription draft
    const { error: rxError } = await supabase
      .from('prescriptions')
      .update({
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        fields: JSON.stringify(fields),
        doctor_notes: doctorNotes ?? null,
      })
      .eq('patient_id', patientId)
      .eq('confirmed', false);

    if (rxError) return { error: rxError.message };

    // 2. Create or activate care plan
    const { data: carePlan, error: cpError } = await supabase
      .from('care_plans')
      .insert({
        patient_id: patientId,
        status: 'active',
        notes: doctorNotes ?? 'Doctor verified care plan',
      })
      .select()
      .single();

    if (cpError) {
      console.warn('Care plan record creation notice:', cpError.message);
    }

    // 3. Create medication schedule from confirmed medicine fields
    const medName = fields.find((f) => f.key === 'medicine')?.value;
    const dosage = fields.find((f) => f.key === 'dosage')?.value;
    const instructions = fields.find((f) => f.key === 'instructions')?.value;

    if (medName && dosage) {
      await supabase.from('medication_schedules').insert({
        patient_id: patientId,
        care_plan_id: carePlan?.id ?? null,
        medicine_name: medName,
        dosage,
        scheduled_time: '08:00',
        status: 'pending',
        instructions: instructions ?? 'As directed',
      });
    }

    return { ok: true };
  },

  async recordAdherence(scheduleId, status, reason, notes) {
    if (!supabase) return { error: 'Supabase client is not configured' };

    // Lookup schedule to enrich adherence log with patient_id, medicine_name, and scheduled_time
    const { data: sched } = await supabase
      .from('medication_schedules')
      .select('patient_id, medicine_name, scheduled_time')
      .eq('id', scheduleId)
      .maybeSingle();

    // Insert adherence log entry
    const noteText = [reason, notes].filter(Boolean).join(' - ') || null;

    const { error: logError } = await supabase.from('adherence_logs').insert({
      schedule_id: scheduleId,
      patient_id: sched?.patient_id,
      medicine_name: sched?.medicine_name ?? 'Prescribed Medicine',
      scheduled_time: sched?.scheduled_time ?? '08:00',
      status,
      reason: reason || null,
      notes: noteText,
      recorded_at: new Date().toISOString(),
    });

    if (logError) return { error: logError.message };

    // Update schedule current status without altering prescribed scheduled_time
    const updatePayload: Record<string, any> = { status };
    if (reason) {
      updatePayload.reason = reason;
    }
    if (status === 'snoozed') {
      updatePayload.snoozed_until = calculateSnoozeTimestamp(10);
    } else {
      updatePayload.snoozed_until = null;
    }

    const { error: schedError } = await supabase
      .from('medication_schedules')
      .update(updatePayload)
      .eq('id', scheduleId);

    if (schedError) return { error: schedError.message };

    return { ok: true };
  },

  async submitHealthUpdate(patientId, state, description, source = 'patient') {
    if (!supabase) return { error: 'Supabase client is not configured' };
    const { data, error } = await supabase
      .from('health_updates')
      .insert({
        patient_id: patientId,
        state,
        symptom_description: description,
        submitted_at: new Date().toISOString(),
        source,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    return {
      data: {
        id: data.id,
        patientId: data.patient_id,
        state: data.state as HealthState,
        symptomDescription: data.symptom_description ?? '',
        submittedAt: data.submitted_at,
        source: data.source as 'patient' | 'doctor',
      },
    };
  },

  async updateCareGapStatus(gapId, status) {
    if (!supabase) return { error: 'Supabase client is not configured' };
    const { error } = await supabase
      .from('care_gaps')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', gapId);

    if (error) return { error: error.message };
    return { ok: true };
  },

  async updateFollowUp(followUpId, answer) {
    if (!supabase) return { error: 'Supabase client is not configured' };
    const { error } = await supabase
      .from('follow_ups')
      .update({ answer, answered_at: new Date().toISOString(), status: 'answered' })
      .eq('id', followUpId);

    if (error) return { error: error.message };
    return { ok: true };
  },

  async updateCaregiverAccess(patientId, authorized) {
    if (!supabase) return { error: 'Supabase client is not configured' };
    const { error } = await supabase
      .from('caregiver_consent')
      .update({
        authorized,
        revoked_at: authorized ? null : new Date().toISOString(),
        authorized_at: authorized ? new Date().toISOString() : undefined,
      })
      .eq('patient_id', patientId);

    if (error) return { error: error.message };
    return { ok: true };
  },

  subscribeToLiveUpdates(onUpdate: () => void): () => void {
    const client = supabase;
    if (!client) return () => {};

    const channel = client
      .channel('pulsebridge-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medication_schedules' }, () => onUpdate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'health_updates' }, () => onUpdate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'care_gaps' }, () => onUpdate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, () => onUpdate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'adherence_logs' }, () => onUpdate())
      .subscribe((status, err) => {
        if (err || status === 'CHANNEL_ERROR') {
          console.warn('[PulseBridge Realtime] Live channel notice:', status, err?.message);
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  },

  async fetchMedicalReports(patientId) {
    return demoService.fetchMedicalReports(patientId);
  },

  async getReportSummary(reportId, patientId, options) {
    const reports = await this.fetchMedicalReports(patientId);
    const report = reports.find((r) => r.id === reportId);
    if (!report) return null;

    if (options?.preferAI) {
      return invokeAIReportSummary(report);
    }

    return summarizeMedicalReport(report);
  },
};

export const dataService: DataService = isDemoMode ? demoService : productionService;
