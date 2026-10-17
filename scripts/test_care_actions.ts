/**
 * Automated Verification Suite for Closed-Loop Care Action Tracking
 * PulseBridge AI Phase 4
 *
 * Verifies all 12 criteria:
 * 1. New action creation.
 * 2. Default 'open' status.
 * 3. Valid 'open' -> 'in_progress' transition.
 * 4. Rejection of 'resolved' without an outcome note.
 * 5. Successful resolution with a valid outcome note.
 * 6. 'documented' remains distinguishable from 'resolved' (and remains unresolved).
 * 7. Invalid status transitions rejected with informative errors.
 * 8. Updated timestamp (updatedAt) refreshed after a status change.
 * 9. Linked care gaps remain unchanged when an action is completed.
 * 10. Patient triage scores and emergency overrides remain completely unchanged.
 * 11. Empty action list and query edge cases handled safely.
 * 12. Missing or malformed data handled defensively without throwing.
 */

import {
  careActionService,
  validateNewAction,
  validateTransition,
  isActionOverdue,
  isActionUnresolved,
} from '../src/services/careActionService';
import { calculatePatientTriageScore } from '../src/services/careGapRules';
import { demoPatients, demoHealthUpdates, demoSchedules, demoFollowUps, demoCareGaps } from '../src/data/demoData';
import type { CareAction, CreateCareActionInput } from '../src/types/careAction';
import type { CareGap } from '../src/types';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failedTests++;
  }
}

console.log('================================================================');
console.log('PULSEBRIDGE AI — CLOSED-LOOP CARE ACTION TRACKING TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1 & 2: New action creation and default 'open' status
// -----------------------------------------------------------------------------
console.log('TEST 1 & 2: New action creation and default "open" status');
{
  const input: CreateCareActionInput = {
    patientId: 'p1',
    careGapId: 'g1',
    title: 'Urgent Cardiology Teleconsult',
    description: 'Arrange priority review with on-call cardiologist.',
    priority: 'urgent',
    assignedRole: 'doctor',
    assignedTo: 'Dr. Anita Desai',
  };

  const res = careActionService.create(input);
  assert(res.success === true, 'Action successfully created');
  if (res.success) {
    assert(res.data.status === 'open', 'New action status strictly defaults to "open"');
    assert(res.data.patientId === 'p1', 'Patient ID preserved');
    assert(res.data.careGapId === 'g1', 'Linked care-gap ID preserved');
    assert(res.data.title === input.title, 'Title preserved');
    assert(res.data.priority === 'urgent', 'Priority preserved');
    assert(Boolean(res.data.createdAt), 'Creation timestamp initialized');
    assert(Boolean(res.data.updatedAt), 'Updated timestamp initialized');
  }
}

// -----------------------------------------------------------------------------
// Test 3: Valid 'open' -> 'in_progress' transition
// -----------------------------------------------------------------------------
console.log('\nTEST 3: Valid "open" -> "in_progress" transition');
{
  const createRes = careActionService.create({
    patientId: 'p1',
    title: 'Electrolyte Recheck',
    description: 'Draw baseline electrolytes.',
  });
  assert(createRes.success === true, 'Test action created');

  if (createRes.success) {
    const actionId = createRes.data.id;
    const transRes = careActionService.transition(actionId, { targetStatus: 'in_progress' });
    assert(transRes.success === true, 'Transition to in_progress succeeds');
    if (transRes.success) {
      assert(transRes.data.status === 'in_progress', 'Action status is now "in_progress"');
    }
  }
}

// -----------------------------------------------------------------------------
// Test 4: Rejection of 'resolved' without an outcome note
// -----------------------------------------------------------------------------
console.log('\nTEST 4: Rejection of "resolved" without an outcome note');
{
  const createRes = careActionService.create({
    patientId: 'p2',
    title: 'Knee Pain Follow-up',
    description: 'Call patient to check mobility.',
  });

  if (createRes.success) {
    const actionId = createRes.data.id;

    // 1. Omitted outcomeNote
    const resNoNote = careActionService.transition(actionId, { targetStatus: 'resolved' });
    assert(resNoNote.success === false, 'Rejects resolution without outcomeNote');
    if (!resNoNote.success) {
      assert(
        resNoNote.error.includes('outcome note is strictly required'),
        'Informative error returned for missing outcome note'
      );
    }

    // 2. Whitespace-only outcomeNote
    const resWhitespace = careActionService.transition(actionId, {
      targetStatus: 'resolved',
      outcomeNote: '    ',
    });
    assert(resWhitespace.success === false, 'Rejects resolution with whitespace outcomeNote');
  }
}

// -----------------------------------------------------------------------------
// Test 5: Successful resolution with a valid outcome note
// -----------------------------------------------------------------------------
console.log('\nTEST 5: Successful resolution with a valid outcome note');
{
  const createRes = careActionService.create({
    patientId: 'p2',
    title: 'Knee Pain Severity Assessment',
    description: 'Capture visual analogue pain score.',
  });

  if (createRes.success) {
    const actionId = createRes.data.id;
    const outcomeText = 'Patient contacted; reports 4/10 pain with exercise, relieved by rest. Advised hot fomentation.';

    const res = careActionService.transition(actionId, {
      targetStatus: 'resolved',
      outcomeNote: outcomeText,
      followUpNote: 'Re-evaluate in 2 weeks',
    });

    assert(res.success === true, 'Transition to resolved succeeds with valid outcome note');
    if (res.success) {
      assert(res.data.status === 'resolved', 'Status updated to resolved');
      assert(res.data.outcomeNote === outcomeText, 'Outcome note preserved');
      assert(Boolean(res.data.resolvedAt), 'resolvedAt timestamp recorded');
      assert(res.data.followUpNote === 'Re-evaluate in 2 weeks', 'Follow-up note recorded');
      assert(isActionUnresolved(res.data) === false, 'Resolved action is marked as resolved (not unresolved)');
    }
  }
}

// -----------------------------------------------------------------------------
// Test 6: 'documented' remains distinguishable from 'resolved'
// -----------------------------------------------------------------------------
console.log('\nTEST 6: "documented" remains distinguishable from "resolved"');
{
  const createRes = careActionService.create({
    patientId: 'p4',
    careGapId: 'g5',
    title: 'Glimepiride Allergy Review',
    description: 'Assess sulfa allergy cross-reactivity.',
  });

  if (createRes.success) {
    const actionId = createRes.data.id;
    const decisionText = 'Patient has tolerated drug for 18 months without reaction. Decision: Continue under monitoring.';

    const res = careActionService.transition(actionId, {
      targetStatus: 'documented',
      documentedDecision: decisionText,
    });

    assert(res.success === true, 'Transition to documented succeeds with decision note');
    if (res.success) {
      assert(res.data.status === 'documented', 'Status is "documented"');
      assert(res.data.documentedDecision === decisionText, 'Documented decision recorded');
      assert(Boolean(res.data.documentedAt), 'documentedAt timestamp recorded');
      assert(res.data.resolvedAt === undefined || res.data.resolvedAt === null, 'resolvedAt is null/undefined');
      // Crucial: A documented clinical decision does NOT claim clinical resolution
      assert(isActionUnresolved(res.data) === true, 'Documented action is correctly classified as UNRESOLVED for monitoring');
    }
  }
}

// -----------------------------------------------------------------------------
// Test 7: Invalid status transitions rejected
// -----------------------------------------------------------------------------
console.log('\nTEST 7: Invalid status transitions rejected with informative errors');
{
  // Test invalid status name
  const resInvalidStatus = validateTransition(
    { status: 'open' } as any,
    { targetStatus: 'invalid_status' as any }
  );
  assert(resInvalidStatus.valid === false, 'Rejects unrecognized status name');

  // Test invalid transition graph (resolved -> open without going through in_progress / justification)
  const resResolvedToOpen = validateTransition(
    { status: 'resolved' } as any,
    { targetStatus: 'open' }
  );
  assert(resResolvedToOpen.valid === false, 'Rejects direct transition from resolved to open');

  // Test reopening resolved without justification
  const resReopenNoJustification = validateTransition(
    { status: 'resolved' } as any,
    { targetStatus: 'in_progress', reopenJustification: '' }
  );
  assert(resReopenNoJustification.valid === false, 'Rejects reopening resolved action without clinical justification');
}

// -----------------------------------------------------------------------------
// Test 8: Updated timestamp after a status change
// -----------------------------------------------------------------------------
console.log('\nTEST 8: Updated timestamp after status change');
{
  const pastTime = new Date(Date.now() - 10000).toISOString();
  const testAction: CareAction = {
    id: 'act-time-test',
    patientId: 'p1',
    title: 'Timestamp Test Action',
    description: 'Testing updatedAt mutation.',
    status: 'open',
    createdAt: pastTime,
    updatedAt: pastTime,
  };

  careActionService.reset([testAction]);

  const updateRes = careActionService.transition('act-time-test', {
    targetStatus: 'in_progress',
  });

  assert(updateRes.success === true, 'Transition succeeded');
  if (updateRes.success) {
    const updatedTime = new Date(updateRes.data.updatedAt).getTime();
    const originalTime = new Date(pastTime).getTime();
    assert(updatedTime > originalTime, 'updatedAt was refreshed to current time');
  }
}

// -----------------------------------------------------------------------------
// Test 9: Linked care gaps remain unchanged when an action is completed
// -----------------------------------------------------------------------------
console.log('\nTEST 9: Linked care gaps remain unchanged when an action is completed');
{
  const p1Gaps = demoCareGaps['p1'];
  assert(Array.isArray(p1Gaps) && p1Gaps.length > 0, 'Demo care gaps for p1 exist');

  const targetGap = p1Gaps[0];
  const originalGapStatus = targetGap.status;
  const originalGapJSON = JSON.stringify(targetGap);

  // Create action linked to targetGap
  const actionRes = careActionService.create({
    patientId: 'p1',
    careGapId: targetGap.id,
    title: 'Resolution for Gap',
    description: 'Closing action loop.',
  });

  assert(actionRes.success === true, 'Action created linked to gap');
  if (actionRes.success) {
    // Resolve the action
    const resolveRes = careActionService.transition(actionRes.data.id, {
      targetStatus: 'resolved',
      outcomeNote: 'Action closed with positive outcome.',
    });
    assert(resolveRes.success === true, 'Action resolved');

    // Verify the care gap object was completely untouched
    assert(targetGap.status === originalGapStatus, 'Care gap status is completely unmutated');
    assert(JSON.stringify(targetGap) === originalGapJSON, 'Care gap data is deeply immutable');
  }
}

// -----------------------------------------------------------------------------
// Test 10: Patient triage scores and emergency overrides remain unchanged
// -----------------------------------------------------------------------------
console.log('\nTEST 10: Patient triage scores and emergency overrides remain unchanged');
{
  const p1 = demoPatients[0];
  const p1Updates = demoHealthUpdates['p1'] ?? [];
  const p1Schedules = demoSchedules['p1'] ?? [];
  const p1FollowUps = demoFollowUps['p1'] ?? [];

  const triageBefore = calculatePatientTriageScore(p1, p1Updates, p1Schedules, p1FollowUps);

  // Perform multiple care action operations
  const a1 = careActionService.create({
    patientId: 'p1',
    title: 'Emergency override check',
    description: 'Does not touch emergency status.',
  });
  if (a1.success) {
    careActionService.transition(a1.data.id, {
      targetStatus: 'resolved',
      outcomeNote: 'Clinical review confirmed.',
    });
  }

  const triageAfter = calculatePatientTriageScore(p1, p1Updates, p1Schedules, p1FollowUps);

  assert(triageBefore.score === triageAfter.score, 'Triage numerical score is identical');
  assert(triageBefore.priority === triageAfter.priority, 'Triage priority tier is identical');
  assert(
    triageBefore.criticalSafetyOverride === triageAfter.criticalSafetyOverride,
    'Critical safety override status is identical'
  );
}

// -----------------------------------------------------------------------------
// Test 11: Empty action list and query edge cases
// -----------------------------------------------------------------------------
console.log('\nTEST 11: Empty action list and query edge cases');
{
  // Unknown patient returns empty list
  const emptyList = careActionService.getByPatient('patient-does-not-exist');
  assert(Array.isArray(emptyList), 'Returns empty array for unknown patient');
  assert(emptyList.length === 0, 'Array length is 0');

  // Unknown ID returns null
  const nullAction = careActionService.getById('non-existent-action-id');
  assert(nullAction === null, 'Returns null for non-existent action ID');

  // Overdue calculation with no dueDate
  const noDueDateAction: CareAction = {
    id: 'a-no-due',
    patientId: 'p1',
    title: 'No due date',
    description: 'Testing overdue helper',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert(isActionOverdue(noDueDateAction) === false, 'Action without dueDate is not overdue');

  // Overdue calculation with past dueDate
  const overdueAction: CareAction = {
    ...noDueDateAction,
    dueDate: new Date(Date.now() - 3600000).toISOString(),
  };
  assert(isActionOverdue(overdueAction) === true, 'Action with past dueDate is overdue');

  // Resolved action with past dueDate is NOT overdue
  const resolvedOverdueAction: CareAction = {
    ...overdueAction,
    status: 'resolved',
  };
  assert(isActionOverdue(resolvedOverdueAction) === false, 'Resolved action is never classified as overdue');
}

// -----------------------------------------------------------------------------
// Test 12: Missing or malformed data handled defensively
// -----------------------------------------------------------------------------
console.log('\nTEST 12: Missing or malformed data handled defensively');
{
  const resNullNew = validateNewAction(null as any);
  assert(resNullNew.valid === false, 'validateNewAction handles null safely');

  const resEmptyObj = validateNewAction({} as any);
  assert(resEmptyObj.valid === false, 'validateNewAction handles empty object safely');

  const resNoTitle = validateNewAction({ patientId: 'p1', title: '', description: 'Desc' });
  assert(resNoTitle.valid === false, 'validateNewAction rejects blank title');

  const resNoDesc = validateNewAction({ patientId: 'p1', title: 'Title', description: '' });
  assert(resNoDesc.valid === false, 'validateNewAction rejects blank description');

  const resInvalidDate = validateNewAction({
    patientId: 'p1',
    title: 'Title',
    description: 'Desc',
    dueDate: 'invalid-date-string',
  });
  assert(resInvalidDate.valid === false, 'validateNewAction rejects malformed date string');
}

console.log('\n----------------------------------------------------------------');
console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed.`);
console.log('----------------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
