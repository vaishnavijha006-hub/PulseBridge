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
  getPatientSummaries,
} from '@/data/demoData';
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
} from '@/types';

export interface DataService {
  mode: 'demo' | 'production';
  fetchPatientSummaries(): Promise<PatientSummary[]>;
  fetchMedicationSchedules(patientId: string): Promise<MedicationSchedule[]>;
  fetchCareGaps(patientId: string): Promise<CareGap[]>;
  fetchPrescriptionDraft(patientId: string): Promise<PrescriptionDraft | null>;
  fetchFollowUps(patientId: string): Promise<FollowUp[]>;
  fetchHealthUpdates(patientId: string): Promise<HealthUpdate[]>;
  fetchFamilyView(patientId: string): Promise<FamilyView | null>;
  fetchCaregiverAccess(patientId: string): Promise<CaregiverAccess | null>;
  uploadPrescriptionImage(patientId: string, file: File): Promise<{ url: string } | { error: string }>;
  savePrescriptionDraft(patientId: string, imageUrl: string, fields: PrescriptionField[]): Promise<{ ok: true } | { error: string }>;
  confirmCarePlan(patientId: string, fields: PrescriptionField[]): Promise<{ ok: true } | { error: string }>;
  recordAdherence(scheduleId: string, status: DoseStatus): Promise<{ ok: true } | { error: string }>;
  submitHealthUpdate(patientId: string, state: HealthState, description: string): Promise<{ ok: true } | { error: string }>;
  updateCareGapStatus(gapId: string, status: 'open' | 'reviewed' | 'followup_planned'): Promise<{ ok: true } | { error: string }>;
  updateFollowUp(followUpId: string, answer: string): Promise<{ ok: true } | { error: string }>;
  updateCaregiverAccess(patientId: string, authorized: boolean): Promise<{ ok: true } | { error: string }>;
}

const demoService: DataService = {
  mode: 'demo',

  async fetchPatientSummaries() {
    return getPatientSummaries();
  },

  async fetchMedicationSchedules(patientId) {
    return demoSchedules[patientId] ?? [];
  },

  async fetchCareGaps(patientId) {
    return demoCareGaps[patientId] ?? [];
  },

  async fetchPrescriptionDraft(patientId) {
    return demoPrescriptionDrafts[patientId] ?? null;
  },

  async fetchFollowUps(patientId) {
    return demoFollowUps[patientId] ?? [];
  },

  async fetchHealthUpdates(patientId) {
    return demoHealthUpdates[patientId] ?? [];
  },

  async fetchFamilyView(_patientId) {
    return demoFamilyView;
  },

  async fetchCaregiverAccess(_patientId) {
    return demoCaregiverAccess;
  },

  async uploadPrescriptionImage(_patientId, _file) {
    return { error: 'Demo mode: image upload not persisted. Configure Supabase to enable.' };
  },

  async savePrescriptionDraft(_patientId, _imageUrl, _fields) {
    return { ok: true };
  },

  async confirmCarePlan(_patientId, _fields) {
    return { ok: true };
  },

  async recordAdherence(_scheduleId, _status) {
    return { ok: true };
  },

  async submitHealthUpdate(_patientId, _state, _description) {
    return { ok: true };
  },

  async updateCareGapStatus(_gapId, _status) {
    return { ok: true };
  },

  async updateFollowUp(_followUpId, _answer) {
    return { ok: true };
  },

  async updateCaregiverAccess(_patientId, _authorized) {
    return { ok: true };
  },
};

const productionService: DataService = {
  mode: 'production',

  async fetchPatientSummaries() {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('patient_summaries').select('*');
    if (error) throw error;
    return data as PatientSummary[];
  },

  async fetchMedicationSchedules(patientId) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('medication_schedules')
      .select('*')
      .eq('patient_id', patientId)
      .order('scheduled_time', { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as MedicationSchedule[];
  },

  async fetchCareGaps(patientId) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('care_gaps')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as CareGap[];
  },

  async fetchPrescriptionDraft(patientId) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', patientId)
      .eq('confirmed', false)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as PrescriptionDraft) ?? null;
  },

  async fetchFollowUps(patientId) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('patient_id', patientId)
      .order('asked_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as FollowUp[];
  },

  async fetchHealthUpdates(patientId) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('health_updates')
      .select('*')
      .eq('patient_id', patientId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as HealthUpdate[];
  },

  async fetchFamilyView(patientId) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('get_family_view', { p_patient_id: patientId });
    if (error) throw error;
    return (data as unknown as FamilyView) ?? null;
  },

  async fetchCaregiverAccess(patientId) {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('caregivers')
      .select('*')
      .eq('patient_id', patientId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as CaregiverAccess) ?? null;
  },

  async uploadPrescriptionImage(patientId, file) {
    if (!supabase) return { error: 'Supabase not configured' };
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${patientId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('prescriptions')
      .upload(path, file, { upsert: false });
    if (uploadError) return { error: uploadError.message };
    const { data: urlData } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl(path, 3600);
    if (!urlData) return { error: 'Failed to generate signed URL' };
    return { url: urlData.signedUrl };
  },

  async savePrescriptionDraft(patientId, imageUrl, fields) {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.from('prescriptions').insert({
      patient_id: patientId,
      image_url: imageUrl,
      fields: JSON.stringify(fields),
      confirmed: false,
    });
    if (error) return { error: error.message };
    return { ok: true };
  },

  async confirmCarePlan(patientId, fields) {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase
      .from('prescriptions')
      .update({ confirmed: true, fields: JSON.stringify(fields) })
      .eq('patient_id', patientId)
      .eq('confirmed', false);
    if (error) return { error: error.message };
    return { ok: true };
  },

  async recordAdherence(scheduleId, status) {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.from('adherence_logs').insert({
      schedule_id: scheduleId,
      status,
      recorded_at: new Date().toISOString(),
    });
    if (error) return { error: error.message };
    return { ok: true };
  },

  async submitHealthUpdate(patientId, state, description) {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.from('health_updates').insert({
      patient_id: patientId,
      state,
      symptom_description: description,
      submitted_at: new Date().toISOString(),
      source: 'patient',
    });
    if (error) return { error: error.message };
    return { ok: true };
  },

  async updateCareGapStatus(gapId, status) {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase
      .from('care_gaps')
      .update({ status })
      .eq('id', gapId);
    if (error) return { error: error.message };
    return { ok: true };
  },

  async updateFollowUp(followUpId, answer) {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase
      .from('follow_ups')
      .update({ answer, answered_at: new Date().toISOString(), status: 'answered' })
      .eq('id', followUpId);
    if (error) return { error: error.message };
    return { ok: true };
  },

  async updateCaregiverAccess(patientId, authorized) {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase
      .from('caregivers')
      .update({ authorized })
      .eq('patient_id', patientId);
    if (error) return { error: error.message };
    return { ok: true };
  },
};

export const dataService: DataService = isDemoMode ? demoService : productionService;
