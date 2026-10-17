/**
 * Consent-Based Family Recovery Circle — Domain Models & Permission Specifications
 * PulseBridge AI
 */

export interface GranularConsentPermissions {
  /** Permission to view today's medication dose counts and completion status */
  shareMedicationStatus: boolean;
  /** Permission to view high-level daily health check-in status (e.g. Feeling well) */
  shareDailyVitals: boolean;
  /** Permission to view direct contact number to call the patient */
  allowDirectCalling: boolean;
  /** Permission to view doctor-approved discharge care guidelines & dietary tips */
  shareCareInstructions: boolean;
}

export type FamilyConsentStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export interface FamilyCircleMember {
  id: string;
  patientId: string;
  caregiverName: string;
  relationship: string;
  contactNumber: string | null;
  email?: string | null;
  authorized: boolean;
  status: FamilyConsentStatus;
  permissions: GranularConsentPermissions;
  inviteCode: string;
  invitedAt: string;
  authorizedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
}

export interface FamilySupportNote {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  relationship: string;
  message: string;
  sentAt: string;
}

export interface InviteFamilyMemberInput {
  patientId: string;
  caregiverName: string;
  relationship: string;
  contactNumber?: string;
  email?: string;
  permissions?: Partial<GranularConsentPermissions>;
}

export interface UpdateConsentPermissionsInput {
  memberId: string;
  patientId: string;
  permissions: Partial<GranularConsentPermissions>;
}

export interface SendSupportNoteInput {
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  relationship: string;
  message: string;
}

export interface GranularFamilyView {
  patientName: string;
  patientId: string;
  caregiverMemberId: string;
  caregiverName: string;
  relationship: string;
  authorized: boolean;
  status: FamilyConsentStatus;
  permissions: GranularConsentPermissions;
  /** Only present if permissions.shareMedicationStatus is true and authorized */
  dosesToday: { taken: number; total: number } | null;
  /** Only present if permissions.shareMedicationStatus is true and authorized */
  nextDoseTime: string | null;
  /** Only present if permissions.shareMedicationStatus is true and authorized */
  missedDose: boolean;
  /** Only present if permissions.shareDailyVitals is true and authorized */
  healthUpdateStatus: string | null;
  /** Only present if permissions.allowDirectCalling is true and authorized */
  contactNumber: string | null;
  /** Only present if permissions.shareCareInstructions is true and authorized */
  careInstructions: string[] | null;
  /** Recent family encouragement messages */
  supportNotes: FamilySupportNote[];
  /** Latest recorded activity timestamp */
  lastUpdateTimestamp: string | null;
  /** Doctor-scheduled follow-up visits explicitly permitted by care instructions */
  sharedAppointments: {
    id: string;
    doctorName: string;
    department: string;
    date: string;
    time: string;
    status: string;
  }[] | null;
  /** High-level recovery achievements */
  recoveryMilestones: {
    id: string;
    title: string;
    subtitle: string;
    achieved: boolean;
    date?: string;
  }[] | null;
  /** IDs of recovery timeline updates acknowledged by this family member */
  acknowledgedUpdates: string[];
  redactedReason?: string | null;
}
