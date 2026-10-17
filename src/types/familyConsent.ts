/**
 * Consent-Based Family Recovery Circle — Domain Models & Permission Specifications
 * PulseBridge AI
 */

export interface GranularConsentPermissions {
  /** Permission to view basic patient profile name & relationship */
  shareProfile: boolean;
  /** Permission to view today's medication dose counts and completion status */
  shareMedicationStatus: boolean;
  /** Permission to view high-level daily health check-in status (e.g. Feeling well) */
  shareDailyVitals: boolean;
  /** Permission to view doctor-scheduled follow-up visits & consultations */
  shareAppointments: boolean;
  /** Permission to view doctor-approved discharge care guidelines & dietary tips */
  shareCareInstructions: boolean;
  /** Permission to view permitted care milestones & support actions */
  shareCareActions: boolean;
  /** Permission to view direct contact number to call the patient */
  allowDirectCalling: boolean;
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
  tokenHash?: string;
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

export interface FamilyInvitation {
  id: string;
  patientId: string;
  recipientEmail: string;
  caregiverName: string;
  relationship: string;
  tokenHash: string;
  status: FamilyConsentStatus;
  permissions: GranularConsentPermissions;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  acceptedByUserId?: string | null;
}

export type ConsentAuditAction =
  | 'invite_created'
  | 'invite_accepted'
  | 'invite_cancelled'
  | 'permission_granted'
  | 'permission_revoked'
  | 'member_revoked'
  | 'member_restored'
  | 'member_removed'
  | 'action_acknowledged'
  | 'access_denied_unauthorized';

export interface ConsentAuditLogEntry {
  id: string;
  patientId: string;
  caregiverId?: string | null;
  caregiverName?: string | null;
  action: ConsentAuditAction;
  category?: keyof GranularConsentPermissions | 'all';
  timestamp: string;
  details: string;
  actorRole: 'patient' | 'caregiver' | 'system';
}

export interface InviteFamilyMemberInput {
  patientId: string;
  caregiverName: string;
  relationship: string;
  contactNumber?: string;
  email?: string;
  permissions?: Partial<GranularConsentPermissions>;
}

export interface AcceptInvitationInput {
  token: string;
  recipientEmail: string;
  userId: string;
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

/**
 * Family-appropriate representation of a Closed-Loop Care Action.
 * Internal diagnostic deliberations and raw medical jargon are omitted or simplified.
 */
export interface FamilyCareActionUpdate {
  id: string;
  title: string;
  explanation: string;
  status: 'open' | 'in_progress' | 'resolved' | 'documented';
  statusLabel: string;
  priority?: 'urgent' | 'high' | 'routine';
  sourceRole: string;
  responsibleName?: string;
  timestamp: string;
  dueDate?: string | null;
  familyAcknowledged: boolean;
  acknowledgedAt?: string | null;
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
  /** Closed-loop care coordination actions explicitly permitted by patient consent */
  sharedCareActions: FamilyCareActionUpdate[] | null;
  /** IDs of recovery timeline updates acknowledged by this family member */
  acknowledgedUpdates: string[];
  redactedReason?: string | null;
}
