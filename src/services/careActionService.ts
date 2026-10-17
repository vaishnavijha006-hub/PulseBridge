/**
 * Closed-Loop Care — Action Service
 *
 * In-memory service for creating and updating CareActions.
 * Enforces the action lifecycle, validates transitions, and guards
 * against invalid or missing data.
 *
 * IMPORTANT safety guarantees:
 * - Creating an action NEVER resolves or modifies the linked CareGap.
 * - Completing an action NEVER mutates prescriptions, triage scores,
 *   or patient records.
 * - Critical warnings and emergency overrides are unaffected by
 *   action status changes.
 * - Outcome and follow-up notes are never silently erased.
 * - Data persists only in this session's memory (in-memory demo).
 *   Changes are lost on page refresh.
 */

import type {
  CareAction,
  CareActionStatus,
  CreateCareActionInput,
  UpdateCareActionStatusInput,
  CareActionResult,
} from '@/types/careAction';
import { VALID_TRANSITIONS } from '@/types/careAction';

// ---------------------------------------------------------------------------
// In-memory store — intentionally separate from demoData.ts / dataService.ts
// ---------------------------------------------------------------------------

let actionStore: CareAction[] = [];

/** Seed the store with initial demo data (called once on module load). */
function seedDemoActions(): CareAction[] {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
  const tomorrow = new Date(now.getTime() + 86400000);
  const overdue = new Date(now.getTime() - 3 * 86400000);

  return [
    {
      id: 'ca-1',
      patientId: 'p1',
      linkedCareGapId: 'g1',
      title: 'Review chest heaviness symptom',
      description:
        'Patient Ravi Sharma reported chest heaviness. Clinician to review reported symptom, assess severity, and determine next steps. This is a clinical review task — it does not automatically resolve the linked care gap.',
      assignedTo: 'Dr. Meena',
      createdAt: yesterday.toISOString(),
      updatedAt: yesterday.toISOString(),
      dueDate: tomorrow.toISOString().slice(0, 10),
      status: 'open',
      outcomeNote: null,
      followUpNote: null,
    },
    {
      id: 'ca-2',
      patientId: 'p1',
      linkedCareGapId: 'g2',
      title: 'Counsel on missed Metformin doses',
      description:
        'Two missed doses of Metformin detected. Coordinate with patient to understand reasons and reinforce adherence.',
      assignedTo: 'Care Coordinator',
      createdAt: twoDaysAgo.toISOString(),
      updatedAt: yesterday.toISOString(),
      dueDate: now.toISOString().slice(0, 10),
      status: 'in_progress',
      outcomeNote: null,
      followUpNote: 'Patient contacted; follow-up call scheduled for tomorrow morning.',
    },
    {
      id: 'ca-3',
      patientId: 'p4',
      linkedCareGapId: 'g4',
      title: 'Obtain overdue blood sugar reading',
      description:
        'Blood sugar reading is overdue. Contact patient to record and review latest HbA1c or FBS result.',
      assignedTo: 'Nurse Priya',
      createdAt: twoDaysAgo.toISOString(),
      updatedAt: twoDaysAgo.toISOString(),
      dueDate: overdue.toISOString().slice(0, 10), // already overdue
      status: 'open',
      outcomeNote: null,
      followUpNote: null,
    },
    {
      id: 'ca-4',
      patientId: 'p2',
      linkedCareGapId: 'g3',
      title: 'Document knee pain severity',
      description:
        'Knee pain severity not captured. Ask patient to rate pain on a 1-10 scale and record the outcome.',
      assignedTo: null,
      createdAt: twoDaysAgo.toISOString(),
      updatedAt: now.toISOString(),
      dueDate: null,
      status: 'documented',
      outcomeNote:
        'Patient rated knee pain as 4/10. Mild swelling noted. Physiotherapy referral discussed. NOTE: The linked care gap remains open for further clinical review.',
      followUpNote: 'Await physiotherapy appointment confirmation.',
    },
  ];
}

actionStore = seedDemoActions();

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `ca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidStatus(value: unknown): value is CareActionStatus {
  return ['open', 'in_progress', 'resolved', 'documented'].includes(value as string);
}

function isValidTransition(from: CareActionStatus, to: CareActionStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all care actions for a given patient, sorted newest-first.
 * Never throws; returns [] on bad input.
 */
export function getActionsForPatient(patientId: string): CareAction[] {
  if (!patientId || typeof patientId !== 'string') return [];
  return [...actionStore]
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Returns all care actions across all patients, sorted newest-first.
 */
export function getAllActions(): CareAction[] {
  return [...actionStore].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Creates a new care action for a patient.
 *
 * - Status is always initialised to 'open'.
 * - Creating an action does NOT resolve or modify the linked CareGap.
 * - Returns an error result if required fields are missing or invalid.
 */
export function createCareAction(input: CreateCareActionInput): CareActionResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Invalid input: expected an object.' };
  }

  const title = (input.title ?? '').trim();
  const description = (input.description ?? '').trim();
  const patientId = (input.patientId ?? '').trim();

  if (!patientId) {
    return { ok: false, error: 'Patient ID is required.' };
  }
  if (!title) {
    return { ok: false, error: 'Action title is required.' };
  }
  if (!description) {
    return { ok: false, error: 'Action description is required.' };
  }

  const now = new Date().toISOString();
  const action: CareAction = {
    id: generateId(),
    patientId,
    linkedCareGapId: input.linkedCareGapId ?? null,
    title,
    description,
    assignedTo: input.assignedTo?.trim() || null,
    createdAt: now,
    updatedAt: now,
    dueDate: input.dueDate ?? null,
    status: 'open', // Always starts as 'open'
    outcomeNote: null,
    followUpNote: null,
  };

  actionStore = [...actionStore, action];
  return { ok: true, action };
}

/**
 * Updates the status of an existing care action.
 *
 * Validation rules:
 * - The action must exist.
 * - The new status must be a valid CareActionStatus.
 * - The transition must be listed in VALID_TRANSITIONS.
 * - 'resolved' requires a non-empty outcomeNote.
 * - Outcome and follow-up notes from previous updates are preserved
 *   unless explicitly overridden.
 * - updatedAt is refreshed on every successful update.
 *
 * Safety:
 * - Does NOT modify the linked CareGap, prescription, or triage score.
 * - Does NOT suppress critical warnings.
 */
export function updateCareActionStatus(
  input: UpdateCareActionStatusInput,
): CareActionResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Invalid input.' };
  }

  const { actionId, newStatus, outcomeNote, followUpNote } = input;

  if (!actionId) {
    return { ok: false, error: 'Action ID is required.' };
  }

  if (!isValidStatus(newStatus)) {
    return {
      ok: false,
      error: `Invalid status "${String(newStatus)}". Valid values are: open, in_progress, resolved, documented.`,
    };
  }

  const existing = actionStore.find((a) => a.id === actionId);
  if (!existing) {
    return { ok: false, error: `Action "${actionId}" not found.` };
  }

  if (!isValidTransition(existing.status, newStatus)) {
    return {
      ok: false,
      error: `Cannot transition from "${existing.status}" to "${newStatus}". Valid transitions from "${existing.status}": [${VALID_TRANSITIONS[existing.status].join(', ') || 'none'}].`,
    };
  }

  // Resolution requires a meaningful, non-empty outcome note.
  if (newStatus === 'resolved') {
    const note = (outcomeNote ?? '').trim();
    if (!note) {
      return {
        ok: false,
        error:
          'An outcome note is required to resolve an action. Provide a meaningful description of what was done.',
      };
    }
  }

  // Documented differs from resolved: outcome note is optional.
  // Follow-up note is preserved when not explicitly overridden.
  const updatedOutcomeNote =
    outcomeNote !== undefined && outcomeNote.trim() !== ''
      ? outcomeNote.trim()
      : existing.outcomeNote; // Preserve existing note — never erase.

  const updatedFollowUpNote =
    followUpNote !== undefined && followUpNote.trim() !== ''
      ? followUpNote.trim()
      : existing.followUpNote; // Preserve existing follow-up note.

  const updated: CareAction = {
    ...existing,
    status: newStatus,
    outcomeNote: updatedOutcomeNote,
    followUpNote: updatedFollowUpNote,
    updatedAt: new Date().toISOString(), // Always refresh timestamp.
  };

  actionStore = actionStore.map((a) => (a.id === actionId ? updated : a));
  return { ok: true, action: updated };
}

/**
 * Returns whether a care action is overdue.
 * An action is overdue if it has a dueDate in the past and is not
 * yet resolved or documented.
 *
 * Does NOT modify any data — purely a display helper.
 */
export function isActionOverdue(action: CareAction): boolean {
  if (!action.dueDate) return false;
  if (action.status === 'resolved' || action.status === 'documented') return false;
  return new Date(action.dueDate) < new Date(new Date().toDateString());
}

/**
 * Resets the in-memory store to demo seed data.
 * Used by tests — not exposed to production code paths.
 */
export function _resetStoreForTesting(): void {
  actionStore = seedDemoActions();
}

/**
 * Replaces the store with a given list.
 * Used by tests — not exposed to production code paths.
 */
export function _setStoreForTesting(actions: CareAction[]): void {
  actionStore = [...actions];
}
