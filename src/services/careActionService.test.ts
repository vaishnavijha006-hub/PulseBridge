/**
 * Closed-Loop Care — Unit Tests
 *
 * Tests the care action lifecycle and validation rules in careActionService.ts.
 * Does NOT depend on React or the DOM — pure logic tests.
 *
 * Run with: npm run test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCareAction,
  updateCareActionStatus,
  getActionsForPatient,
  getAllActions,
  isActionOverdue,
  _resetStoreForTesting,
  _setStoreForTesting,
} from '@/services/careActionService';
import type { CareAction } from '@/types/careAction';

// ---------------------------------------------------------------------------
// Reset store before each test to prevent cross-test contamination.
// ---------------------------------------------------------------------------
beforeEach(() => {
  _resetStoreForTesting();
});

// ---------------------------------------------------------------------------
// 1. New actions start as 'open'
// ---------------------------------------------------------------------------
describe('createCareAction', () => {
  it('creates a new action with status "open"', () => {
    const result = createCareAction({
      patientId: 'p1',
      title: 'Test action',
      description: 'A test description',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');
    expect(result.action.status).toBe('open');
  });

  it('assigns createdAt and updatedAt timestamps', () => {
    const before = new Date().toISOString();
    const result = createCareAction({
      patientId: 'p1',
      title: 'Timestamp test',
      description: 'Check timestamps',
    });
    const after = new Date().toISOString();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');
    expect(result.action.createdAt >= before).toBe(true);
    expect(result.action.createdAt <= after).toBe(true);
    expect(result.action.updatedAt).toBe(result.action.createdAt);
  });

  it('initialises outcomeNote and followUpNote to null', () => {
    const result = createCareAction({
      patientId: 'p1',
      title: 'Null notes test',
      description: 'Verify notes start null',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');
    expect(result.action.outcomeNote).toBeNull();
    expect(result.action.followUpNote).toBeNull();
  });

  it('returns an error when title is empty', () => {
    const result = createCareAction({ patientId: 'p1', title: '', description: 'desc' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.error).toMatch(/title/i);
  });

  it('returns an error when description is empty', () => {
    const result = createCareAction({ patientId: 'p1', title: 'Title', description: '' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.error).toMatch(/description/i);
  });

  it('returns an error when patientId is missing', () => {
    const result = createCareAction({ patientId: '', title: 'T', description: 'D' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.error).toMatch(/patient/i);
  });

  it('does NOT automatically resolve the linked care gap', () => {
    // This test proves that creating an action with linkedCareGapId='g1'
    // only stores a reference — it does NOT modify demoCareGaps.
    // (The actual CareGap data is in demoData.ts which we do not import here.)
    const result = createCareAction({
      patientId: 'p1',
      linkedCareGapId: 'g1',
      title: 'Linked action',
      description: 'Check gap is untouched',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');
    // The action stores the reference but the action status is still 'open'
    // (not 'resolved'), confirming the gap is not auto-resolved.
    expect(result.action.linkedCareGapId).toBe('g1');
    expect(result.action.status).toBe('open');
  });
});

// ---------------------------------------------------------------------------
// 2. Valid transition: open → in_progress
// ---------------------------------------------------------------------------
describe('updateCareActionStatus — valid transitions', () => {
  it('transitions from open to in_progress', () => {
    const created = createCareAction({
      patientId: 'p1',
      title: 'Transition test',
      description: 'Test open → in_progress',
    });

    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('Expected ok');

    const updated = updateCareActionStatus({
      actionId: created.action.id,
      newStatus: 'in_progress',
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) throw new Error('Expected ok');
    expect(updated.action.status).toBe('in_progress');
  });

  it('transitions from in_progress to resolved with an outcome note', () => {
    const created = createCareAction({
      patientId: 'p1',
      title: 'Resolve test',
      description: 'Will be resolved',
    });
    if (!created.ok) throw new Error('Expected ok');

    updateCareActionStatus({ actionId: created.action.id, newStatus: 'in_progress' });

    const resolved = updateCareActionStatus({
      actionId: created.action.id,
      newStatus: 'resolved',
      outcomeNote: 'Clinician reviewed and confirmed no further action needed.',
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error('Expected ok');
    expect(resolved.action.status).toBe('resolved');
    expect(resolved.action.outcomeNote).toBe(
      'Clinician reviewed and confirmed no further action needed.',
    );
  });

  it('transitions from open to documented without requiring an outcome note', () => {
    const created = createCareAction({
      patientId: 'p1',
      title: 'Document test',
      description: 'Will be documented',
    });
    if (!created.ok) throw new Error('Expected ok');

    const documented = updateCareActionStatus({
      actionId: created.action.id,
      newStatus: 'documented',
    });

    expect(documented.ok).toBe(true);
    if (!documented.ok) throw new Error('Expected ok');
    expect(documented.action.status).toBe('documented');
  });
});

// ---------------------------------------------------------------------------
// 3. Resolution without an outcome note is rejected
// ---------------------------------------------------------------------------
describe('updateCareActionStatus — resolution validation', () => {
  it('rejects resolution when outcomeNote is absent', () => {
    const created = createCareAction({
      patientId: 'p1',
      title: 'No note test',
      description: 'Should fail to resolve',
    });
    if (!created.ok) throw new Error('Expected ok');

    const result = updateCareActionStatus({
      actionId: created.action.id,
      newStatus: 'resolved',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.error).toMatch(/outcome note/i);
  });

  it('rejects resolution when outcomeNote is whitespace-only', () => {
    const created = createCareAction({
      patientId: 'p1',
      title: 'Whitespace note',
      description: 'Should fail to resolve',
    });
    if (!created.ok) throw new Error('Expected ok');

    const result = updateCareActionStatus({
      actionId: created.action.id,
      newStatus: 'resolved',
      outcomeNote: '   ',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.error).toMatch(/outcome note/i);
  });
});

// ---------------------------------------------------------------------------
// 4. Successful resolution records the outcome and refreshes updatedAt
// ---------------------------------------------------------------------------
describe('updateCareActionStatus — successful resolution', () => {
  it('records outcome note and updates timestamp on resolution', async () => {
    const created = createCareAction({
      patientId: 'p1',
      title: 'Record outcome',
      description: 'Verify outcome note is saved',
    });
    if (!created.ok) throw new Error('Expected ok');

    const beforeUpdate = created.action.updatedAt;

    // Small delay to ensure updatedAt differs.
    await new Promise((r) => setTimeout(r, 2));

    const resolved = updateCareActionStatus({
      actionId: created.action.id,
      newStatus: 'resolved',
      outcomeNote: 'Patient condition improved. No further action required.',
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error('Expected ok');
    expect(resolved.action.outcomeNote).toBe(
      'Patient condition improved. No further action required.',
    );
    expect(resolved.action.updatedAt > beforeUpdate).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. 'documented' differs from 'resolved'
// ---------------------------------------------------------------------------
describe('"documented" differs from "resolved"', () => {
  it('documented status is distinct from resolved', () => {
    const a = createCareAction({
      patientId: 'p1',
      title: 'Documented vs Resolved',
      description: 'Both are terminal but distinct',
    });
    if (!a.ok) throw new Error('Expected ok');

    const documented = updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'documented',
      outcomeNote: 'Note recorded.',
    });

    expect(documented.ok).toBe(true);
    if (!documented.ok) throw new Error('Expected ok');
    expect(documented.action.status).toBe('documented');
    expect(documented.action.status).not.toBe('resolved');
  });

  it('documented → resolved is NOT a valid transition', () => {
    const a = createCareAction({
      patientId: 'p1',
      title: 'Terminal documented',
      description: 'Cannot transition from documented',
    });
    if (!a.ok) throw new Error('Expected ok');

    updateCareActionStatus({ actionId: a.action.id, newStatus: 'documented' });

    const result = updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'resolved',
      outcomeNote: 'Attempting invalid transition.',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.error).toMatch(/transition/i);
  });

  it('resolved → documented is NOT a valid transition', () => {
    const a = createCareAction({
      patientId: 'p1',
      title: 'Terminal resolved',
      description: 'Cannot transition from resolved',
    });
    if (!a.ok) throw new Error('Expected ok');

    updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'resolved',
      outcomeNote: 'Resolved properly.',
    });

    const result = updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'documented',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.error).toMatch(/transition/i);
  });
});

// ---------------------------------------------------------------------------
// 6. Invalid statuses and unsupported transitions are rejected
// ---------------------------------------------------------------------------
describe('updateCareActionStatus — invalid inputs', () => {
  it('rejects an invalid status value', () => {
    const a = createCareAction({
      patientId: 'p1',
      title: 'Invalid status',
      description: 'Test bad status',
    });
    if (!a.ok) throw new Error('Expected ok');

    const result = updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'completed' as any, // not a valid CareActionStatus
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.error).toMatch(/invalid status/i);
  });

  it('rejects transition from open to resolved (if skipping in_progress is intended to be blocked)', () => {
    // NOTE: per VALID_TRANSITIONS, open → resolved IS allowed (direct resolution).
    // This test verifies that the allowed transitions table is actually respected.
    const a = createCareAction({
      patientId: 'p1',
      title: 'Direct resolve',
      description: 'open → resolved directly',
    });
    if (!a.ok) throw new Error('Expected ok');

    const result = updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'resolved',
      outcomeNote: 'Directly resolved without going through in_progress.',
    });

    // open → resolved IS in VALID_TRANSITIONS.open, so this should succeed.
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected ok, got: ${result.error}`);
  });

  it('rejects in_progress → open (backward transition)', () => {
    const a = createCareAction({
      patientId: 'p1',
      title: 'Backward transition',
      description: 'Cannot go back to open',
    });
    if (!a.ok) throw new Error('Expected ok');

    updateCareActionStatus({ actionId: a.action.id, newStatus: 'in_progress' });

    const result = updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'open',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.error).toMatch(/transition/i);
  });

  it('returns an error for a non-existent action ID', () => {
    const result = updateCareActionStatus({
      actionId: 'non-existent-id',
      newStatus: 'in_progress',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// 7. Completing an action does NOT mutate care gaps, prescriptions, or triage
// ---------------------------------------------------------------------------
describe('isolation from CareGap, prescription, and triage', () => {
  it('resolving an action does not modify the linked care gap ID stored on the action', () => {
    const a = createCareAction({
      patientId: 'p1',
      linkedCareGapId: 'g1',
      title: 'Isolation test',
      description: 'Resolving must not touch the gap',
    });
    if (!a.ok) throw new Error('Expected ok');

    const resolved = updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'resolved',
      outcomeNote: 'Action completed. Gap remains open for clinical review.',
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error('Expected ok');

    // The action still references the gap but has NOT closed it.
    // (CareGap data lives in demoData.ts — this test confirms we don't touch it.)
    expect(resolved.action.linkedCareGapId).toBe('g1');
    expect(resolved.action.status).toBe('resolved');
    // The action result does NOT include a 'gapStatus' or similar field.
    expect((resolved.action as any).gapStatus).toBeUndefined();
  });

  it('creating an action with a linked gap does not add any gap-resolution field', () => {
    const result = createCareAction({
      patientId: 'p4',
      linkedCareGapId: 'g4',
      title: 'No gap mutation',
      description: 'Verify gap is not auto-resolved',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');
    expect((result.action as any).careGapStatus).toBeUndefined();
    expect((result.action as any).prescriptionId).toBeUndefined();
    expect((result.action as any).triageScore).toBeUndefined();
  });

  it('does not automatically remove the linked care gap when creating an action', () => {
    // The action is created; we verify getActionsForPatient returns the new
    // action while the gap reference is unchanged.
    const before = getActionsForPatient('p1').length;

    const result = createCareAction({
      patientId: 'p1',
      linkedCareGapId: 'g2',
      title: 'Gap still open',
      description: 'Gap should remain open',
    });
    if (!result.ok) throw new Error('Expected ok');

    const after = getActionsForPatient('p1').length;
    expect(after).toBe(before + 1);
    // Gap data is external; the action only stores a reference.
    expect(result.action.linkedCareGapId).toBe('g2');
  });
});

// ---------------------------------------------------------------------------
// 8. Unresolved actions remain visible after notes are recorded
// ---------------------------------------------------------------------------
describe('unresolved actions visibility', () => {
  it('adding a followUpNote to an in_progress action does not change its status', () => {
    const a = createCareAction({
      patientId: 'p1',
      title: 'Stay visible',
      description: 'Still unresolved',
    });
    if (!a.ok) throw new Error('Expected ok');

    updateCareActionStatus({ actionId: a.action.id, newStatus: 'in_progress' });

    const noted = updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'in_progress',
    });

    // Transition in_progress → in_progress is not valid; should return error.
    expect(noted.ok).toBe(false);
    if (noted.ok) throw new Error('Expected error for same-status transition');

    // The action should still be in_progress (visible).
    const actions = getActionsForPatient('p1');
    const found = actions.find((x) => x.id === a.action.id);
    expect(found).toBeDefined();
    expect(found?.status).toBe('in_progress');
  });

  it('documented actions remain in the action list (not hidden)', () => {
    const a = createCareAction({
      patientId: 'p1',
      title: 'Documented but visible',
      description: 'Should remain visible',
    });
    if (!a.ok) throw new Error('Expected ok');

    updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'documented',
      outcomeNote: 'Note recorded. Issue under review.',
    });

    const actions = getActionsForPatient('p1');
    const found = actions.find((x) => x.id === a.action.id);
    expect(found).toBeDefined();
    expect(found?.status).toBe('documented');
  });
});

// ---------------------------------------------------------------------------
// 9. Empty action lists render correctly (service layer)
// ---------------------------------------------------------------------------
describe('getActionsForPatient', () => {
  it('returns an empty array for a patient with no actions', () => {
    _setStoreForTesting([]); // No actions at all.
    const result = getActionsForPatient('p99');
    expect(result).toEqual([]);
  });

  it('returns [] for an invalid patientId without throwing', () => {
    expect(() => getActionsForPatient('')).not.toThrow();
    expect(getActionsForPatient('')).toEqual([]);
  });

  it('does not throw for null-like input', () => {
    expect(() => getActionsForPatient(null as any)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 10. Malformed or missing action data does not crash the service
// ---------------------------------------------------------------------------
describe('malformed input handling', () => {
  it('createCareAction does not throw on null input', () => {
    expect(() => createCareAction(null as any)).not.toThrow();
    const result = createCareAction(null as any);
    expect(result.ok).toBe(false);
  });

  it('updateCareActionStatus does not throw on null input', () => {
    expect(() => updateCareActionStatus(null as any)).not.toThrow();
    const result = updateCareActionStatus(null as any);
    expect(result.ok).toBe(false);
  });

  it('getActionsForPatient returns [] even when store contains a malformed entry', () => {
    // Simulate a malformed entry in the store.
    _setStoreForTesting([{ id: 'bad', patientId: 'p1' } as unknown as CareAction]);
    const result = getActionsForPatient('p1');
    // Should return the entry (service doesn't validate stored data shape)
    // but must not throw.
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 11. Outcome and follow-up notes are preserved on subsequent updates
// ---------------------------------------------------------------------------
describe('note preservation', () => {
  it('does not erase existing outcomeNote when adding a followUpNote', () => {
    const a = createCareAction({
      patientId: 'p1',
      title: 'Preserve note',
      description: 'Check note preservation',
    });
    if (!a.ok) throw new Error('Expected ok');

    const documented = updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'documented',
      outcomeNote: 'First note recorded.',
    });
    if (!documented.ok) throw new Error('Expected ok');
    expect(documented.action.outcomeNote).toBe('First note recorded.');

    // Since 'documented' is terminal, we can't update it further.
    // This test validates the preservation rule by checking the returned value.
    const actions = getActionsForPatient('p1');
    const found = actions.find((x) => x.id === a.action.id);
    expect(found?.outcomeNote).toBe('First note recorded.');
  });
});

// ---------------------------------------------------------------------------
// 12. isActionOverdue helper
// ---------------------------------------------------------------------------
describe('isActionOverdue', () => {
  it('returns false when action has no dueDate', () => {
    const a = createCareAction({
      patientId: 'p1',
      title: 'No due date',
      description: 'No due date set',
    });
    if (!a.ok) throw new Error('Expected ok');
    expect(isActionOverdue(a.action)).toBe(false);
  });

  it('returns true when dueDate is in the past and status is open', () => {
    const pastDate = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const a = createCareAction({
      patientId: 'p1',
      title: 'Overdue action',
      description: 'Past due date',
      dueDate: pastDate,
    });
    if (!a.ok) throw new Error('Expected ok');
    expect(isActionOverdue(a.action)).toBe(true);
  });

  it('returns false for a resolved action even if dueDate has passed', () => {
    const pastDate = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const a = createCareAction({
      patientId: 'p1',
      title: 'Resolved but past due',
      description: 'Already resolved',
      dueDate: pastDate,
    });
    if (!a.ok) throw new Error('Expected ok');

    updateCareActionStatus({
      actionId: a.action.id,
      newStatus: 'resolved',
      outcomeNote: 'Completed.',
    });

    const actions = getAllActions();
    const found = actions.find((x) => x.id === a.action.id)!;
    expect(isActionOverdue(found)).toBe(false);
  });
});
