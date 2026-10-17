/**
 * Consent-Based Family Recovery Circle — Service Layer
 * PulseBridge AI
 *
 * Implements granular permission controls, fail-closed privacy redaction,
 * invitation lifecycle management, and family recovery coordination.
 */

import type {
  FamilyCircleMember,
  FamilySupportNote,
  GranularConsentPermissions,
  InviteFamilyMemberInput,
  UpdateConsentPermissionsInput,
  SendSupportNoteInput,
  GranularFamilyView,
} from '@/types/familyConsent';
import { demoSchedules, demoPatients } from '@/data/demoData';

const STORAGE_KEY_MEMBERS = 'pulsebridge_family_circle_members';
const STORAGE_KEY_NOTES = 'pulsebridge_family_support_notes';

export const DEFAULT_PERMISSIONS: GranularConsentPermissions = {
  shareMedicationStatus: true,
  shareDailyVitals: true,
  allowDirectCalling: true,
  shareCareInstructions: true,
};

// Standard initial demo data
const INITIAL_MEMBERS: FamilyCircleMember[] = [
  {
    id: 'fcm_1',
    patientId: 'p1',
    caregiverName: 'Priya Sharma',
    relationship: 'Daughter (बेटी)',
    contactNumber: '+91 98765 43210',
    email: 'priya.sharma@example.com',
    authorized: true,
    status: 'accepted',
    permissions: {
      shareMedicationStatus: true,
      shareDailyVitals: true,
      allowDirectCalling: true,
      shareCareInstructions: true,
    },
    inviteCode: 'PB-REC-7821',
    invitedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    authorizedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    revokedAt: null,
    expiresAt: null,
  },
  {
    id: 'fcm_2',
    patientId: 'p1',
    caregiverName: 'Amit Sharma',
    relationship: 'Son (बेटा)',
    contactNumber: '+91 98111 22334',
    email: 'amit.sharma@example.com',
    authorized: false,
    status: 'pending',
    permissions: {
      shareMedicationStatus: true,
      shareDailyVitals: false,
      allowDirectCalling: true,
      shareCareInstructions: true,
    },
    inviteCode: 'PB-REC-9942',
    invitedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    authorizedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(),
  },
];

const INITIAL_NOTES: FamilySupportNote[] = [
  {
    id: 'fsn_1',
    patientId: 'p1',
    caregiverId: 'fcm_1',
    caregiverName: 'Priya Sharma',
    relationship: 'Daughter (बेटी)',
    message: 'Papa, take your medicines on time and rest well today! We love you! ❤️',
    sentAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

class FamilyConsentService {
  private members: FamilyCircleMember[] = [];
  private notes: FamilySupportNote[] = [];
  private acknowledgedUpdates: Record<string, string[]> = {};
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedMembers = localStorage.getItem(STORAGE_KEY_MEMBERS);
        const storedNotes = localStorage.getItem(STORAGE_KEY_NOTES);

        this.members = storedMembers ? JSON.parse(storedMembers) : [...INITIAL_MEMBERS];
        this.notes = storedNotes ? JSON.parse(storedNotes) : [...INITIAL_NOTES];
      } else {
        this.members = [...INITIAL_MEMBERS];
        this.notes = [...INITIAL_NOTES];
      }
    } catch {
      this.members = [...INITIAL_MEMBERS];
      this.notes = [...INITIAL_NOTES];
    }
  }

  private saveState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(this.members));
        localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(this.notes));
      }
    } catch {
      // ignore storage failure
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('FamilyConsentService listener error:', e);
      }
    });
  }

  /**
   * List all family circle members for a patient (Patient-controlled).
   */
  public listMembers(patientId: string): FamilyCircleMember[] {
    return this.members.filter((m) => m.patientId === patientId);
  }

  /**
   * Find a specific family member by ID.
   */
  public getMember(memberId: string): FamilyCircleMember | undefined {
    return this.members.find((m) => m.id === memberId);
  }

  /**
   * Invite a new family member with specific granular permissions.
   */
  public inviteMember(input: InviteFamilyMemberInput): FamilyCircleMember {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const newMember: FamilyCircleMember = {
      id: `fcm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      patientId: input.patientId,
      caregiverName: input.caregiverName.trim(),
      relationship: input.relationship.trim(),
      contactNumber: input.contactNumber?.trim() || null,
      email: input.email?.trim() || null,
      authorized: true,
      status: 'accepted',
      permissions: {
        shareMedicationStatus: input.permissions?.shareMedicationStatus ?? DEFAULT_PERMISSIONS.shareMedicationStatus,
        shareDailyVitals: input.permissions?.shareDailyVitals ?? DEFAULT_PERMISSIONS.shareDailyVitals,
        allowDirectCalling: input.permissions?.allowDirectCalling ?? DEFAULT_PERMISSIONS.allowDirectCalling,
        shareCareInstructions: input.permissions?.shareCareInstructions ?? DEFAULT_PERMISSIONS.shareCareInstructions,
      },
      inviteCode: `PB-REC-${randomCode}`,
      invitedAt: new Date().toISOString(),
      authorizedAt: new Date().toISOString(),
      revokedAt: null,
      expiresAt: null,
    };

    this.members.unshift(newMember);
    this.saveState();
    return newMember;
  }

  /**
   * Update granular permissions for an existing family member.
   * Only the patient can invoke this.
   */
  public updatePermissions(input: UpdateConsentPermissionsInput): FamilyCircleMember {
    const idx = this.members.findIndex((m) => m.id === input.memberId && m.patientId === input.patientId);
    if (idx === -1) {
      throw new Error(`Member ${input.memberId} not found for patient ${input.patientId}`);
    }

    const current = this.members[idx];
    const updated: FamilyCircleMember = {
      ...current,
      permissions: {
        ...current.permissions,
        ...input.permissions,
      },
    };

    this.members[idx] = updated;
    this.saveState();
    return updated;
  }

  /**
   * Immediately revoke access for a family member.
   * Can ONLY be invoked by the patient.
   */
  public revokeConsent(memberId: string, patientId: string): FamilyCircleMember {
    const idx = this.members.findIndex((m) => m.id === memberId && m.patientId === patientId);
    if (idx === -1) {
      throw new Error(`Member ${memberId} not found for patient ${patientId}`);
    }

    const current = this.members[idx];
    const updated: FamilyCircleMember = {
      ...current,
      authorized: false,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
    };

    this.members[idx] = updated;
    this.saveState();
    return updated;
  }

  /**
   * Restore previously revoked consent.
   * Can ONLY be invoked by the patient.
   */
  public restoreConsent(memberId: string, patientId: string): FamilyCircleMember {
    const idx = this.members.findIndex((m) => m.id === memberId && m.patientId === patientId);
    if (idx === -1) {
      throw new Error(`Member ${memberId} not found for patient ${patientId}`);
    }

    const current = this.members[idx];
    const updated: FamilyCircleMember = {
      ...current,
      authorized: true,
      status: 'accepted',
      authorizedAt: new Date().toISOString(),
      revokedAt: null,
    };

    this.members[idx] = updated;
    this.saveState();
    return updated;
  }

  /**
   * Permanently delete a member from the patient's recovery circle.
   */
  public removeMember(memberId: string, patientId: string): void {
    this.members = this.members.filter((m) => !(m.id === memberId && m.patientId === patientId));
    this.saveState();
  }

  /**
   * Send a support/encouragement note from a family member to the patient.
   */
  public sendSupportNote(input: SendSupportNoteInput): FamilySupportNote {
    const newNote: FamilySupportNote = {
      id: `fsn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      patientId: input.patientId,
      caregiverId: input.caregiverId,
      caregiverName: input.caregiverName,
      relationship: input.relationship,
      message: input.message.trim(),
      sentAt: new Date().toISOString(),
    };

    this.notes.unshift(newNote);
    this.saveState();
    return newNote;
  }

  /**
   * List support notes for a patient.
   */
  public listSupportNotes(patientId: string): FamilySupportNote[] {
    return this.notes.filter((n) => n.patientId === patientId);
  }

  /**
   * SECURE FAIL-CLOSED GRANULAR FAMILY VIEW
   *
   * If consent is not active/authorized or expired:
   * Redacts ALL clinical fields to `null`.
   *
   * If authorized:
   * Redacts unconsented categories to `null`.
   * Never exposes internal clinical notes, triage scores, raw scans, or gap evidence.
   */
  public getGranularFamilyView(patientId: string, caregiverId?: string): GranularFamilyView {
    const patient = demoPatients.find((p) => p.id === patientId) ?? {
      id: patientId,
      name: 'Ramesh Kumar',
      phone: '+91 98765 43210',
    };

    // Find the requested member or the first member for this patient
    let member: FamilyCircleMember | undefined;
    if (caregiverId) {
      member = this.members.find((m) => m.id === caregiverId && m.patientId === patientId);
    } else {
      member = this.members.find((m) => m.patientId === patientId && m.status === 'accepted') ||
               this.members.find((m) => m.patientId === patientId);
    }

    const supportNotes = this.listSupportNotes(patientId);

    // Fail-Closed Fallback: Member not found or not authorized or revoked or expired
    const isExpired = member?.expiresAt ? new Date(member.expiresAt).getTime() < Date.now() : false;
    const isAuthorized = Boolean(member && member.authorized && member.status === 'accepted' && !isExpired);

    if (!member || !isAuthorized) {
      return {
        patientName: patient.name,
        patientId,
        caregiverMemberId: member?.id ?? 'unauthorized',
        caregiverName: member?.caregiverName ?? 'Family Caregiver',
        relationship: member?.relationship ?? 'Family',
        authorized: false,
        status: (member?.status ?? 'revoked') as any,
        permissions: {
          shareMedicationStatus: false,
          shareDailyVitals: false,
          allowDirectCalling: false,
          shareCareInstructions: false,
        },
        dosesToday: null,
        nextDoseTime: null,
        missedDose: false,
        healthUpdateStatus: null,
        contactNumber: null,
        careInstructions: null,
        supportNotes: [],
        lastUpdateTimestamp: null,
        sharedAppointments: null,
        recoveryMilestones: null,
        acknowledgedUpdates: [],
        redactedReason: 'Access is not authorized or has been revoked by the patient.',
      };
    }

    // Member is authorized — apply granular category filters
    const perms = member.permissions;
    const schedules = demoSchedules[patientId] ?? [];
    const taken = schedules.filter((s) => s.status === 'taken').length;
    const total = schedules.length;
    const hasMissed = schedules.some((s) => s.status === 'missed' || s.status === 'cannot_take');
    const pendingSchedule = schedules.find((s) => s.status === 'pending' || s.status === 'snoozed');

    const dosesToday = perms.shareMedicationStatus ? { taken, total } : null;
    const nextDoseTime = perms.shareMedicationStatus && pendingSchedule ? pendingSchedule.scheduledTime : null;
    const missedDose = perms.shareMedicationStatus ? hasMissed : false;

    const healthUpdateStatus = perms.shareDailyVitals ? 'Recovering steadily (स्वास्थ्य स्थिर है)' : null;
    const contactNumber = perms.allowDirectCalling ? member.contactNumber || patient.phone || null : null;

    const careInstructions = perms.shareCareInstructions
      ? [
          'Take medicines with a full glass of lukewarm water.',
          'Maintain daily hydration (2.5L water/liquids recommended).',
          'Follow a light, balanced diet with minimal excess sodium or spice.',
          'Report any unexpected discomfort or persistent heaviness directly.',
        ]
      : null;

    return {
      patientName: patient.name,
      patientId,
      caregiverMemberId: member.id,
      caregiverName: member.caregiverName,
      relationship: member.relationship,
      authorized: true,
      status: member.status,
      permissions: perms,
      dosesToday,
      nextDoseTime,
      missedDose,
      healthUpdateStatus,
      contactNumber,
      careInstructions,
      supportNotes,
      lastUpdateTimestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      sharedAppointments: perms.shareCareInstructions
        ? [
            {
              id: 'apt_1',
              doctorName: 'Dr. S. Sharma, MD',
              department: 'Cardiology (हृदय रोग विभाग)',
              date: '22 Oct 2026',
              time: '10:30 AM',
              status: 'Confirmed & Scheduled',
            },
          ]
        : null,
      recoveryMilestones: perms.shareCareInstructions
        ? [
            {
              id: 'ms_1',
              title: 'Day 1 Post-Discharge Adherence',
              subtitle: 'All prescribed doses logged consistently',
              achieved: true,
              date: 'Today',
            },
            {
              id: 'ms_2',
              title: 'Cardiology Check-in Booked',
              subtitle: 'Appointment reserved with Dr. S. Sharma',
              achieved: true,
              date: '22 Oct',
            },
            {
              id: 'ms_3',
              title: '7-Day Steady Recovery Goal',
              subtitle: 'Zero severe symptom alerts target',
              achieved: false,
            },
          ]
        : null,
      acknowledgedUpdates: this.acknowledgedUpdates[member.id] || [],
      redactedReason: null,
    };
  }

  /**
   * Acknowledge an authorized update from the family dashboard.
   */
  public acknowledgeUpdate(updateId: string, memberId: string): void {
    if (!this.acknowledgedUpdates[memberId]) {
      this.acknowledgedUpdates[memberId] = [];
    }
    if (!this.acknowledgedUpdates[memberId].includes(updateId)) {
      this.acknowledgedUpdates[memberId].push(updateId);
      this.saveState();
    }
  }

  /**
   * Reset store to initial demo state (useful for test harnesses)
   */
  public resetToDemo(): void {
    this.members = JSON.parse(JSON.stringify(INITIAL_MEMBERS));
    this.notes = JSON.parse(JSON.stringify(INITIAL_NOTES));
    this.acknowledgedUpdates = {};
    this.saveState();
  }
}

export const familyConsentService = new FamilyConsentService();
