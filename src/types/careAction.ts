/**
 * Closed-Loop Care — Action Types
 *
 * Defines the CareAction domain model and its lifecycle.
 * This module is isolated from existing CareGap, Prescription, and
 * Patient Triage types. Actions may reference a CareGap by ID but
 * do NOT mutate gaps, prescriptions, or triage scores.
 */

/** The four valid statuses of a care action. */
export type CareActionStatus = 'open' | 'in_progress' | 'resolved' | 'documented';

/**
 * A care action tracks a specific clinical task that was identified
 * (often from a CareGap) and needs to be acted upon and closed out.
 *
 * Lifecycle:
 *   open → in_progress → resolved
 *   open → in_progress → documented
 *   open → documented
 *
 * Resolving an action requires a non-empty outcomeNote.
 * Documenting records a clinical note without claiming resolution.
 * Neither operation modifies the linked CareGap, prescription, or triage score.
 */
export interface CareAction {
  /** Unique identifier for this action. */
  id: string;

  /** ID of the patient this action concerns. */
  patientId: string;

  /**
   * Optional reference to the CareGap that prompted this action.
   * Linking does NOT resolve or modify the gap.
   */
  linkedCareGapId: string | null;

  /** Short title describing the required action. */
  title: string;

  /** Detailed description of what needs to be done. */
  description: string;

  /**
   * Person or role responsible for this action.
   * Free-text; matches existing project conventions (no user auth).
   */
  assignedTo: string | null;

  /** ISO 8601 timestamp when this action was created. */
  createdAt: string;

  /** ISO 8601 timestamp when this action was last updated. */
  updatedAt: string;

  /**
   * Optional ISO 8601 due date (date-only string, e.g. "2026-10-20").
   * Used to display overdue indicators.
   */
  dueDate: string | null;

  /** Current lifecycle status. Every new action starts as 'open'. */
  status: CareActionStatus;

  /**
   * Outcome or resolution note.
   * Required (non-empty) when transitioning to 'resolved'.
   * Optional when transitioning to 'documented'.
   * Never silently erased on subsequent updates.
   */
  outcomeNote: string | null;

  /**
   * Follow-up note for actions that are not fully resolved.
   * Visible for 'open', 'in_progress', and 'documented' statuses.
   * Never silently erased on subsequent updates.
   */
  followUpNote: string | null;
}

/** Input for creating a new CareAction. */
export interface CreateCareActionInput {
  patientId: string;
  linkedCareGapId?: string | null;
  title: string;
  description: string;
  assignedTo?: string | null;
  dueDate?: string | null;
}

/** Input for updating the status of a CareAction. */
export interface UpdateCareActionStatusInput {
  actionId: string;
  newStatus: CareActionStatus;
  /** Required when newStatus is 'resolved'. Must be non-empty. */
  outcomeNote?: string;
  /** Optional follow-up note for unresolved actions. */
  followUpNote?: string;
}

/** Result of a care action operation. */
export type CareActionResult =
  | { ok: true; action: CareAction }
  | { ok: false; error: string };

/**
 * Explicitly defined valid status transitions.
 * Any transition not listed here is rejected.
 */
export const VALID_TRANSITIONS: Record<CareActionStatus, CareActionStatus[]> = {
  open: ['in_progress', 'resolved', 'documented'],
  in_progress: ['resolved', 'documented'],
  resolved: [],       // Terminal — no further transitions.
  documented: [],     // Terminal — no further transitions.
};
