/**
 * Closed-Loop Care Action Tracking — Service & Validation Engine
 * PulseBridge AI Phase 4
 *
 * Strict Clinical Safety & Business Rules:
 * 1. New actions start in 'open'.
 * 2. Valid status transitions are explicitly verified against a deterministic state machine.
 * 3. A 'resolved' action strictly requires a non-empty outcome note.
 * 4. A 'documented' action requires a non-empty clinical decision note and does NOT imply clinical resolution.
 * 5. Every mutation updates the 'updatedAt' timestamp.
 * 6. Useful, structured validation errors are returned for any malformed or invalid inputs.
 * 7. Actions are decoupled: Creating or completing an action NEVER mutates or deletes linked care gaps.
 * 8. Action completion NEVER independently alters patient triage scores, emergency overrides, prescriptions, or care plans.
 * 9. Unresolved actions ('open', 'in_progress', 'documented') remain visible in the active tracking queue.
 */

import type {
  CareAction,
  CareActionStatus,
  CreateCareActionInput,
  TransitionCareActionInput,
  UpdateCareActionInput,
  CareActionResult,
} from '@/types/careAction';
import { demoCareActions } from '@/data/demoCareActions';

/**
 * Valid transitions map.
 * Defines allowed destination statuses from each source status.
 */
export const ALLOWED_TRANSITIONS: Record<CareActionStatus, readonly CareActionStatus[]> = {
  open: ['in_progress', 'documented', 'resolved'],
  in_progress: ['resolved', 'documented', 'open'],
  documented: ['in_progress', 'resolved', 'open'],
  resolved: ['in_progress'], // Re-opening a resolved action requires clinical justification
};

/**
 * Validates a new action creation request.
 */
export function validateNewAction(
  input: Readonly<CreateCareActionInput>
): { valid: true; sanitized: CreateCareActionInput } | { valid: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Action payload cannot be empty or non-object.' };
  }

  const patientId = (input.patientId || '').trim();
  if (!patientId) {
    return { valid: false, error: 'Patient ID is required to create a care action.' };
  }

  const title = (input.title || '').trim();
  if (!title) {
    return { valid: false, error: 'Action title cannot be blank.' };
  }

  const description = (input.description || '').trim();
  if (!description) {
    return { valid: false, error: 'Action description cannot be blank.' };
  }

  // Validate optional dueDate if provided
  if (input.dueDate) {
    const d = new Date(input.dueDate);
    if (isNaN(d.getTime())) {
      return { valid: false, error: `Invalid due date format: "${input.dueDate}". Expected ISO date.` };
    }
  }

  return {
    valid: true,
    sanitized: {
      patientId,
      careGapId: input.careGapId ? input.careGapId.trim() : null,
      title,
      description,
      assignedRole: input.assignedRole || 'doctor',
      assignedTo: input.assignedTo ? input.assignedTo.trim() : undefined,
      priority: input.priority || 'routine',
      dueDate: input.dueDate || null,
      status: 'open', // Rule 1: Always starts in 'open'
    },
  };
}

/**
 * Validates a status transition against business rules.
 */
export function validateTransition(
  action: Readonly<CareAction>,
  transition: Readonly<TransitionCareActionInput>
): { valid: true } | { valid: false; error: string } {
  const { targetStatus, outcomeNote, documentedDecision, reopenJustification } = transition;

  // Unrecognized status
  if (!['open', 'in_progress', 'resolved', 'documented'].includes(targetStatus)) {
    return { valid: false, error: `Invalid target status: "${targetStatus}".` };
  }

  // Idempotent: transitioning to same status is allowed
  if (action.status === targetStatus) {
    return { valid: true };
  }

  // Check allowed transition graph
  const allowed = ALLOWED_TRANSITIONS[action.status] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      error: `Invalid transition from "${action.status}" to "${targetStatus}". Allowed destinations: [${allowed.join(', ')}].`,
    };
  }

  // Rule 3: 'resolved' strictly requires a non-empty outcome note
  if (targetStatus === 'resolved') {
    const note = (outcomeNote || '').trim();
    if (!note) {
      return {
        valid: false,
        error: 'A non-empty outcome note is strictly required to resolve a care action.',
      };
    }
  }

  // Rule 4: 'documented' requires a clear documented clinical decision
  if (targetStatus === 'documented') {
    const decision = (documentedDecision || outcomeNote || '').trim();
    if (!decision) {
      return {
        valid: false,
        error: 'A documented outcome/decision note is required when recording a clinical decision.',
      };
    }
  }

  // Re-opening a resolved action requires clinical justification
  if (action.status === 'resolved' && targetStatus === 'in_progress') {
    const reason = (reopenJustification || outcomeNote || '').trim();
    if (!reason) {
      return {
        valid: false,
        error: 'Re-opening a resolved care action requires an explicit clinical justification.',
      };
    }
  }

  return { valid: true };
}

/**
 * Checks whether an action is overdue as of a given timestamp.
 */
export function isActionOverdue(action: Readonly<CareAction>, asOf: Date = new Date()): boolean {
  if (action.status === 'resolved') return false;
  if (!action.dueDate) return false;
  const due = new Date(action.dueDate);
  return !isNaN(due.getTime()) && due.getTime() < asOf.getTime();
}

/**
 * Checks whether an action is unresolved (needs care team follow-up).
 * Note: 'documented' actions are UNRESOLVED because documenting a clinical note/decision
 * does NOT claim the underlying care action or medical condition was cured/resolved.
 */
export function isActionUnresolved(action: Readonly<CareAction>): boolean {
  return action.status !== 'resolved';
}

/**
 * In-Memory Reactive Store for Closed-Loop Care Actions
 */
class CareActionStore {
  private actions: Map<string, CareAction> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.reset(demoCareActions);
  }

  /**
   * Clears the store and re-seeds with demo actions.
   */
  public reset(seedActions: CareAction[] = []): void {
    this.actions.clear();
    for (const a of seedActions) {
      this.actions.set(a.id, { ...a });
    }
    this.notify();
  }

  /**
   * Subscribes to changes in the action store.
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.warn('Error in CareAction listener callback:', err);
      }
    });
  }

  /**
   * Retrieves all actions for a specific patient.
   */
  public getByPatient(patientId: string): CareAction[] {
    return Array.from(this.actions.values())
      .filter((a) => a.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Retrieves all actions across all patients.
   */
  public getAll(): CareAction[] {
    return Array.from(this.actions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Retrieves an action by ID.
   */
  public getById(id: string): CareAction | null {
    const action = this.actions.get(id);
    return action ? { ...action } : null;
  }

  /**
   * Retrieves unresolved actions for a patient.
   */
  public getUnresolved(patientId: string): CareAction[] {
    return this.getByPatient(patientId).filter(isActionUnresolved);
  }

  /**
   * Retrieves overdue actions for a patient.
   */
  public getOverdue(patientId: string, asOf: Date = new Date()): CareAction[] {
    return this.getByPatient(patientId).filter((a) => isActionOverdue(a, asOf));
  }

  /**
   * Creates a new care action. Enforces Rule 1 (status = 'open').
   */
  public create(input: CreateCareActionInput): CareActionResult<CareAction> {
    const validation = validateNewAction(input);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const { sanitized } = validation;
    const now = new Date().toISOString();
    const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const newAction: CareAction = {
      id,
      patientId: sanitized.patientId,
      careGapId: sanitized.careGapId || null,
      title: sanitized.title,
      description: sanitized.description,
      assignedRole: sanitized.assignedRole,
      assignedTo: sanitized.assignedTo,
      priority: sanitized.priority,
      status: 'open',
      dueDate: sanitized.dueDate || null,
      createdAt: now,
      updatedAt: now,
    };

    this.actions.set(id, newAction);
    this.notify();
    return { success: true, data: { ...newAction } };
  }

  /**
   * Transitions an action to a new status.
   */
  public transition(
    actionId: string,
    transition: TransitionCareActionInput
  ): CareActionResult<CareAction> {
    const existing = this.actions.get(actionId);
    if (!existing) {
      return { success: false, error: `Action with ID "${actionId}" not found.` };
    }

    const validation = validateTransition(existing, transition);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const now = new Date().toISOString();
    const updated: CareAction = {
      ...existing,
      status: transition.targetStatus,
      updatedAt: now,
    };

    if (transition.targetStatus === 'resolved') {
      updated.outcomeNote = transition.outcomeNote!.trim();
      updated.resolvedAt = now;
      if (transition.followUpNote) {
        updated.followUpNote = transition.followUpNote.trim();
      }
    } else if (transition.targetStatus === 'documented') {
      const decision = (transition.documentedDecision || transition.outcomeNote || '').trim();
      updated.documentedDecision = decision;
      updated.documentedAt = now;
      if (transition.followUpNote) {
        updated.followUpNote = transition.followUpNote.trim();
      }
    } else if (transition.targetStatus === 'in_progress' && existing.status === 'resolved') {
      // Reopening
      updated.resolvedAt = null;
      if (transition.reopenJustification) {
        updated.followUpNote = `[Reopened]: ${transition.reopenJustification.trim()}`;
      }
    }

    this.actions.set(actionId, updated);
    this.notify();
    return { success: true, data: { ...updated } };
  }

  /**
   * Updates general fields (title, description, priority, due date) on an existing action.
   */
  public update(actionId: string, input: UpdateCareActionInput): CareActionResult<CareAction> {
    const existing = this.actions.get(actionId);
    if (!existing) {
      return { success: false, error: `Action with ID "${actionId}" not found.` };
    }

    if (input.title !== undefined && !input.title.trim()) {
      return { success: false, error: 'Action title cannot be blank.' };
    }

    if (input.dueDate) {
      const d = new Date(input.dueDate);
      if (isNaN(d.getTime())) {
        return { success: false, error: `Invalid due date format: "${input.dueDate}".` };
      }
    }

    const now = new Date().toISOString();
    const updated: CareAction = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      assignedRole: input.assignedRole !== undefined ? input.assignedRole : existing.assignedRole,
      assignedTo: input.assignedTo !== undefined ? input.assignedTo.trim() : existing.assignedTo,
      priority: input.priority !== undefined ? input.priority : existing.priority,
      dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
      followUpNote:
        input.followUpNote !== undefined
          ? input.followUpNote
            ? input.followUpNote.trim()
            : null
          : existing.followUpNote,
      updatedAt: now,
    };

    this.actions.set(actionId, updated);
    this.notify();
    return { success: true, data: { ...updated } };
  }
}

export const careActionService = new CareActionStore();
