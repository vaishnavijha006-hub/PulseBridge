/**
 * Closed-Loop Care Action Tracking — Domain Types
 * PulseBridge AI Phase 4
 */

export type CareActionStatus = 'open' | 'in_progress' | 'resolved' | 'documented';

export type CareActionPriority = 'urgent' | 'high' | 'routine';

export type CareActionRole =
  | 'doctor'
  | 'nurse'
  | 'care_coordinator'
  | 'caregiver'
  | 'pharmacist'
  | 'other';

export interface CareAction {
  id: string;
  patientId: string;
  careGapId?: string | null;
  title: string;
  description: string;
  assignedRole?: CareActionRole;
  assignedTo?: string;
  priority?: CareActionPriority;
  status: CareActionStatus;
  dueDate?: string | null;
  outcomeNote?: string | null;
  documentedDecision?: string | null;
  followUpNote?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  documentedAt?: string | null;
}

export interface CreateCareActionInput {
  patientId: string;
  careGapId?: string | null;
  title: string;
  description: string;
  assignedRole?: CareActionRole;
  assignedTo?: string;
  priority?: CareActionPriority;
  dueDate?: string | null;
  status?: CareActionStatus; // If provided, validated or defaulted to 'open'
}

export interface TransitionCareActionInput {
  targetStatus: CareActionStatus;
  outcomeNote?: string | null;
  documentedDecision?: string | null;
  followUpNote?: string | null;
  reopenJustification?: string | null;
}

export interface UpdateCareActionInput {
  title?: string;
  description?: string;
  assignedRole?: CareActionRole;
  assignedTo?: string;
  priority?: CareActionPriority;
  dueDate?: string | null;
  followUpNote?: string | null;
}

export type CareActionResult<T = CareAction> =
  | { success: true; data: T }
  | { success: false; error: string };
