import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  FileCheck2,
  Calendar,
  User,
  Plus,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  X,
  Filter,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  careActionService,
  isActionOverdue,
  isActionUnresolved,
} from '@/services/careActionService';
import type {
  CareAction,
  CareActionStatus,
  CareActionPriority,
  CareActionRole,
  CreateCareActionInput,
} from '@/types/careAction';
import type { CareGap } from '@/types';

interface ClosedLoopCareViewProps {
  patientId: string;
  patientName?: string;
  careGaps?: CareGap[];
  className?: string;
}

type FilterTab = 'all' | 'open' | 'in_progress' | 'documented' | 'resolved' | 'overdue';

export function ClosedLoopCareView({
  patientId,
  patientName = 'Patient',
  careGaps = [],
  className,
}: ClosedLoopCareViewProps) {
  // Reactive actions state from careActionService
  const [actions, setActions] = useState<CareAction[]>(() =>
    careActionService.getByPatient(patientId)
  );

  const [filter, setFilter] = useState<FilterTab>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Resolution modal state
  const [resolvingAction, setResolvingAction] = useState<CareAction | null>(null);
  const [outcomeNote, setOutcomeNote] = useState('');
  const [resolutionFollowUp, setResolutionFollowUp] = useState('');
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  // Documentation modal state (recording decision without resolving)
  const [documentingAction, setDocumentingAction] = useState<CareAction | null>(null);
  const [documentedDecision, setDocumentedDecision] = useState('');
  const [documentFollowUp, setDocumentFollowUp] = useState('');
  const [documentError, setDocumentError] = useState<string | null>(null);

  // Re-open modal state
  const [reopeningAction, setReopeningAction] = useState<CareAction | null>(null);
  const [reopenJustification, setReopenJustification] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  // New action form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCareGapId, setNewCareGapId] = useState<string>('');
  const [newPriority, setNewPriority] = useState<CareActionPriority>('routine');
  const [newRole, setNewRole] = useState<CareActionRole>('doctor');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Subscribe to changes in the careAction store
  useEffect(() => {
    setActions(careActionService.getByPatient(patientId));
    const unsubscribe = careActionService.subscribe(() => {
      setActions(careActionService.getByPatient(patientId));
    });
    return unsubscribe;
  }, [patientId]);

  // Metric counts
  const counts = useMemo(() => {
    const total = actions.length;
    const open = actions.filter((a) => a.status === 'open').length;
    const inProgress = actions.filter((a) => a.status === 'in_progress').length;
    const documented = actions.filter((a) => a.status === 'documented').length;
    const resolved = actions.filter((a) => a.status === 'resolved').length;
    const overdue = actions.filter((a) => isActionOverdue(a)).length;
    const unresolved = actions.filter(isActionUnresolved).length;
    return { total, open, inProgress, documented, resolved, overdue, unresolved };
  }, [actions]);

  // Filtered action list
  const filteredActions = useMemo(() => {
    switch (filter) {
      case 'open':
        return actions.filter((a) => a.status === 'open');
      case 'in_progress':
        return actions.filter((a) => a.status === 'in_progress');
      case 'documented':
        return actions.filter((a) => a.status === 'documented');
      case 'resolved':
        return actions.filter((a) => a.status === 'resolved');
      case 'overdue':
        return actions.filter((a) => isActionOverdue(a));
      default:
        return actions;
    }
  }, [actions, filter]);

  // Map care gap IDs to gap objects for quick lookup
  const careGapsMap = useMemo(() => {
    const map = new Map<string, CareGap>();
    careGaps.forEach((g) => map.set(g.id, g));
    return map;
  }, [careGaps]);

  // Handlers
  const handleStartAction = (actionId: string) => {
    const res = careActionService.transition(actionId, { targetStatus: 'in_progress' });
    if (!res.success) {
      alert(res.error);
    }
  };

  const handleOpenResolve = (action: CareAction) => {
    setResolvingAction(action);
    setOutcomeNote('');
    setResolutionFollowUp('');
    setResolutionError(null);
  };

  const handleConfirmResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingAction) return;

    if (!outcomeNote.trim()) {
      setResolutionError('A non-empty outcome note is strictly required to resolve a care action.');
      return;
    }

    const res = careActionService.transition(resolvingAction.id, {
      targetStatus: 'resolved',
      outcomeNote: outcomeNote.trim(),
      followUpNote: resolutionFollowUp.trim() || null,
    });

    if (res.success) {
      setResolvingAction(null);
    } else {
      setResolutionError(res.error);
    }
  };

  const handleOpenDocument = (action: CareAction) => {
    setDocumentingAction(action);
    setDocumentedDecision('');
    setDocumentFollowUp('');
    setDocumentError(null);
  };

  const handleConfirmDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentingAction) return;

    if (!documentedDecision.trim()) {
      setDocumentError('A documented outcome or clinical decision note is required.');
      return;
    }

    const res = careActionService.transition(documentingAction.id, {
      targetStatus: 'documented',
      documentedDecision: documentedDecision.trim(),
      followUpNote: documentFollowUp.trim() || null,
    });

    if (res.success) {
      setDocumentingAction(null);
    } else {
      setDocumentError(res.error);
    }
  };

  const handleOpenReopen = (action: CareAction) => {
    setReopeningAction(action);
    setReopenJustification('');
    setReopenError(null);
  };

  const handleConfirmReopen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopeningAction) return;

    if (!reopenJustification.trim()) {
      setReopenError('An explicit clinical justification is required to re-open a resolved action.');
      return;
    }

    const res = careActionService.transition(reopeningAction.id, {
      targetStatus: 'in_progress',
      reopenJustification: reopenJustification.trim(),
    });

    if (res.success) {
      setReopeningAction(null);
    } else {
      setReopenError(res.error);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const input: CreateCareActionInput = {
      patientId,
      careGapId: newCareGapId || null,
      title: newTitle.trim(),
      description: newDescription.trim(),
      priority: newPriority,
      assignedRole: newRole,
      assignedTo: newAssignedTo.trim() || undefined,
      dueDate: newDueDate || null,
    };

    const res = careActionService.create(input);
    if (res.success) {
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewCareGapId('');
      setNewPriority('routine');
      setNewRole('doctor');
      setNewAssignedTo('');
      setNewDueDate('');
    } else {
      setCreateError(res.error);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Header & Metric Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Closed-Loop Care Actions</h2>
            <span className="rounded-md bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 text-[11px] font-semibold text-teal-300">
              Active Tracking
            </span>
          </div>
          <p className="text-xs text-navy-300 mt-1">
            Track care team follow-through from gap identification to verified outcome or documented clinical decision for {patientName}.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-500 hover:bg-teal-400 px-3.5 py-2 text-xs font-semibold text-navy-950 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Care Action</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard label="Unresolved Active" value={counts.unresolved} color="amber" />
        <MetricCard label="In Progress" value={counts.inProgress} color="blue" />
        <MetricCard label="Documented Decisions" value={counts.documented} color="purple" />
        <MetricCard label="Resolved (Closed Loop)" value={counts.resolved} color="success" />
        <MetricCard
          label="Overdue Follow-ups"
          value={counts.overdue}
          color={counts.overdue > 0 ? 'danger' : 'navy'}
          highlight={counts.overdue > 0}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-navy-600/70 pb-2 overflow-x-auto">
        <FilterButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="All Actions"
          count={counts.total}
        />
        <FilterButton
          active={filter === 'open'}
          onClick={() => setFilter('open')}
          label="Open Queue"
          count={counts.open}
        />
        <FilterButton
          active={filter === 'in_progress'}
          onClick={() => setFilter('in_progress')}
          label="In Progress"
          count={counts.inProgress}
        />
        <FilterButton
          active={filter === 'documented'}
          onClick={() => setFilter('documented')}
          label="Documented"
          count={counts.documented}
        />
        <FilterButton
          active={filter === 'resolved'}
          onClick={() => setFilter('resolved')}
          label="Resolved"
          count={counts.resolved}
        />
        {counts.overdue > 0 && (
          <FilterButton
            active={filter === 'overdue'}
            onClick={() => setFilter('overdue')}
            label="Overdue"
            count={counts.overdue}
            danger
          />
        )}
      </div>

      {/* Action Cards List */}
      <div className="flex flex-col gap-3">
        {filteredActions.length === 0 ? (
          <div className="rounded-xl border border-navy-600 bg-navy-700/30 p-8 text-center text-navy-400">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-30 text-navy-300" />
            <p className="text-sm font-semibold text-white">No Care Actions Found</p>
            <p className="text-xs text-navy-400 mt-1">
              There are no actions registered matching the current filter.
            </p>
          </div>
        ) : (
          filteredActions.map((action) => {
            const linkedGap = action.careGapId ? careGapsMap.get(action.careGapId) : null;
            const overdue = isActionOverdue(action);

            return (
              <ActionCard
                key={action.id}
                action={action}
                linkedGap={linkedGap}
                isOverdue={overdue}
                onStart={() => handleStartAction(action.id)}
                onResolve={() => handleOpenResolve(action)}
                onDocument={() => handleOpenDocument(action)}
                onReopen={() => handleOpenReopen(action)}
              />
            );
          })
        )}
      </div>

      {/* CREATE ACTION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-navy-600 bg-navy-800 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-400" />
                Create Closed-Loop Care Action
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-navy-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-300">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy-200 mb-1">
                  Action Title <span className="text-danger-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Urgent Cardiology Teleconsult Requisition"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-200 mb-1">
                  Description & Clinical Context <span className="text-danger-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Clinical instructions, target evaluation, or specific coordination task..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 outline-none resize-none"
                />
              </div>

              {careGaps.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-navy-200 mb-1">
                    Link to CareGap (Optional)
                  </label>
                  <select
                    value={newCareGapId}
                    onChange={(e) => setNewCareGapId(e.target.value)}
                    className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white focus:border-teal-400 outline-none"
                  >
                    <option value="">None (Independent Care Action)</option>
                    {careGaps.map((g) => (
                      <option key={g.id} value={g.id}>
                        [{g.type}] {g.evidence.slice(0, 50)}...
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy-200 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as CareActionPriority)}
                    className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white focus:border-teal-400 outline-none"
                  >
                    <option value="routine">Routine</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-200 mb-1">Assigned Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as CareActionRole)}
                    className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white focus:border-teal-400 outline-none"
                  >
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="care_coordinator">Care Coordinator</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="caregiver">Caregiver</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy-200 mb-1">
                    Assignee Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Dr. Anita Desai"
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-200 mb-1">
                    Target Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white focus:border-teal-400 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-navy-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-navy-600 px-4 py-2 text-xs font-medium text-navy-300 hover:bg-navy-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-500 hover:bg-teal-400 px-4 py-2 text-xs font-bold text-navy-950 transition-colors shadow-sm"
                >
                  Initialize Action (Open)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE ACTION MODAL (STRICT OUTCOME REQUIRED) */}
      {resolvingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-teal-500/40 bg-navy-800 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <h3 className="text-base font-bold text-teal-400 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-400" />
                Resolve Care Action (Close Loop)
              </h3>
              <button
                onClick={() => setResolvingAction(null)}
                className="text-navy-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-lg bg-navy-900/60 border border-navy-700 p-3 text-xs text-navy-300">
              <span className="font-semibold text-white block mb-0.5">{resolvingAction.title}</span>
              <p>{resolvingAction.description}</p>
            </div>

            {resolutionError && (
              <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-300">
                {resolutionError}
              </div>
            )}

            <form onSubmit={handleConfirmResolve} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Recorded Clinical Outcome & Resolution Note <span className="text-danger-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Document specific resolution (e.g., patient teleconsult completed, dose adjusted to 500mg with food, symptom resolved)..."
                  value={outcomeNote}
                  onChange={(e) => setOutcomeNote(e.target.value)}
                  className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 outline-none resize-none"
                />
                <span className="text-[11px] text-navy-400 mt-1 block">
                  Rule 3: A non-empty outcome note is strictly mandatory to close the loop on this action.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-200 mb-1">
                  Follow-up Observation / Advisory (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Re-check adherence log at Day 7"
                  value={resolutionFollowUp}
                  onChange={(e) => setResolutionFollowUp(e.target.value)}
                  className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-navy-700">
                <button
                  type="button"
                  onClick={() => setResolvingAction(null)}
                  className="rounded-lg border border-navy-600 px-4 py-2 text-xs font-medium text-navy-300 hover:bg-navy-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-500 hover:bg-teal-400 px-4 py-2 text-xs font-bold text-navy-950 transition-colors shadow-sm"
                >
                  Confirm & Resolve Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT CLINICAL DECISION MODAL (DOES NOT IMPLY RESOLUTION) */}
      {documentingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-purple-500/40 bg-navy-800 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <h3 className="text-base font-bold text-purple-300 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-purple-400" />
                Record Clinical Decision (Documented)
              </h3>
              <button
                onClick={() => setDocumentingAction(null)}
                className="text-navy-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Prominent Clinical Disclaimer */}
            <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-3 text-xs text-purple-200">
              <span className="font-bold block mb-0.5">Clinical Note on Documented Status:</span>
              Recording a clinical decision or exception documents why an action was deferred or modified (e.g., patient refusal, specialist deferral). It does <span className="font-bold underline">not</span> imply clinical resolution and the patient condition remains under care team surveillance.
            </div>

            {documentError && (
              <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-300">
                {documentError}
              </div>
            )}

            <form onSubmit={handleConfirmDocument} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Documented Decision / Justification Note <span className="text-danger-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Record rationale (e.g., patient has well-tolerated therapy for 2 years without reaction; decided to continue under surveillance rather than discontinue)..."
                  value={documentedDecision}
                  onChange={(e) => setDocumentedDecision(e.target.value)}
                  className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-200 mb-1">
                  Surveillance / Follow-up Instruction (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Instruct caregiver to report rash immediately"
                  value={documentFollowUp}
                  onChange={(e) => setDocumentFollowUp(e.target.value)}
                  className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-navy-700">
                <button
                  type="button"
                  onClick={() => setDocumentingAction(null)}
                  className="rounded-lg border border-navy-600 px-4 py-2 text-xs font-medium text-navy-300 hover:bg-navy-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white transition-colors shadow-sm"
                >
                  Save Documented Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RE-OPEN ACTION MODAL */}
      {reopeningAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-navy-800 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                Re-open Resolved Action
              </h3>
              <button
                onClick={() => setReopeningAction(null)}
                className="text-navy-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reopenError && (
              <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-300">
                {reopenError}
              </div>
            )}

            <form onSubmit={handleConfirmReopen} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Clinical Justification for Reopening <span className="text-danger-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State reason for reopening (e.g., patient recurrence, medication intolerance resurfaced, new lab findings)..."
                  value={reopenJustification}
                  onChange={(e) => setReopenJustification(e.target.value)}
                  className="w-full rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-navy-700">
                <button
                  type="button"
                  onClick={() => setReopeningAction(null)}
                  className="rounded-lg border border-navy-600 px-4 py-2 text-xs font-medium text-navy-300 hover:bg-navy-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-navy-950 transition-colors shadow-sm"
                >
                  Confirm Re-opening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  color,
  highlight = false,
}: {
  label: string;
  value: number;
  color: 'amber' | 'blue' | 'purple' | 'success' | 'danger' | 'navy';
  highlight?: boolean;
}) {
  const colorMap = {
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    blue: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    success: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    danger: 'text-danger-400 bg-danger-500/15 border-danger-500/30',
    navy: 'text-navy-300 bg-navy-700/40 border-navy-600/30',
  };

  return (
    <div
      className={cn(
        'rounded-xl border p-3 flex flex-col justify-between transition-all',
        colorMap[color],
        highlight && 'animate-pulse'
      )}
    >
      <span className="text-[11px] font-semibold text-navy-300 uppercase tracking-wider">{label}</span>
      <span className="text-xl font-extrabold mt-1 text-white">{value}</span>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
  danger = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
        active
          ? danger
            ? 'bg-danger-500/15 border-danger-500/40 text-danger-300'
            : 'bg-teal-500/10 border-teal-500/40 text-teal-300 font-semibold'
          : 'bg-navy-800/40 border-navy-700 text-navy-300 hover:bg-navy-700'
      )}
    >
      {label}
      <span
        className={cn(
          'text-[10px] font-bold px-1.5 py-0.2 rounded-full',
          active
            ? danger
              ? 'bg-danger-500 text-white'
              : 'bg-teal-500 text-navy-950'
            : 'bg-navy-700 text-navy-400'
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ActionCard({
  action,
  linkedGap,
  isOverdue,
  onStart,
  onResolve,
  onDocument,
  onReopen,
}: {
  action: CareAction;
  linkedGap?: CareGap | null;
  isOverdue: boolean;
  onStart: () => void;
  onResolve: () => void;
  onDocument: () => void;
  onReopen: () => void;
}) {
  const statusConfig = {
    open: {
      label: 'Open Queue',
      color: 'bg-navy-700 text-navy-200 border-navy-600',
      icon: <Clock className="w-3.5 h-3.5 text-navy-300" />,
    },
    in_progress: {
      label: 'In Progress',
      color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      icon: <PlayCircle className="w-3.5 h-3.5 text-amber-400" />,
    },
    documented: {
      label: 'Clinical Decision Documented',
      color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      icon: <FileCheck2 className="w-3.5 h-3.5 text-purple-400" />,
    },
    resolved: {
      label: 'Resolved & Closed',
      color: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />,
    },
  }[action.status];

  const priorityBadge = {
    urgent: 'border-danger-500/40 text-danger-300 bg-danger-500/10',
    high: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    routine: 'border-sky-500/40 text-sky-300 bg-sky-500/10',
  }[action.priority || 'routine'];

  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-3.5 transition-all bg-navy-800/80',
        action.status === 'resolved'
          ? 'border-navy-700 opacity-90'
          : isOverdue
          ? 'border-danger-500/50 bg-danger-500/5'
          : action.status === 'documented'
          ? 'border-purple-500/30 bg-purple-500/5'
          : 'border-navy-600/80'
      )}
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold',
              statusConfig.color
            )}
          >
            {statusConfig.icon}
            {statusConfig.label}
          </span>

          <span
            className={cn(
              'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              priorityBadge
            )}
          >
            {action.priority || 'routine'}
          </span>

          {isOverdue && (
            <span className="inline-flex items-center gap-1 rounded-md border border-danger-500/50 bg-danger-500/20 px-2 py-0.5 text-[10px] font-extrabold text-danger-300 uppercase tracking-wider animate-pulse">
              <AlertTriangle className="w-3 h-3 text-danger-400" />
              Overdue
            </span>
          )}
        </div>

        {/* Due date & role info */}
        <div className="flex items-center gap-3 text-xs text-navy-300">
          {action.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-navy-400" />
              <span>Due: {new Date(action.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-navy-400" />
            <span className="capitalize">{action.assignedTo || action.assignedRole || 'Care Team'}</span>
          </div>
        </div>
      </div>

      {/* Title & Description */}
      <div>
        <h4 className="text-sm font-bold text-white mb-1">{action.title}</h4>
        <p className="text-xs text-navy-200 leading-relaxed">{action.description}</p>
      </div>

      {/* Linked CareGap Context Pill (if applicable) */}
      {linkedGap && (
        <div className="rounded-lg bg-navy-900/70 border border-navy-700/80 p-2.5 flex items-start gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-amber-300 uppercase text-[10px] tracking-wide">
              Linked CareGap ({linkedGap.type.replace(/_/g, ' ')})
            </span>
            <span className="text-navy-300">{linkedGap.evidence}</span>
          </div>
        </div>
      )}

      {/* RESOLVED OUTCOME CALLOUT */}
      {action.status === 'resolved' && action.outcomeNote && (
        <div className="rounded-lg bg-teal-500/10 border border-teal-500/30 p-3 flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between text-teal-300 font-semibold">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              Verified Closed-Loop Resolution
            </span>
            {action.resolvedAt && (
              <span className="text-[10px] text-teal-400/80">
                {new Date(action.resolvedAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <p className="text-navy-100 font-medium leading-relaxed">{action.outcomeNote}</p>
          {action.followUpNote && (
            <p className="text-[11px] text-navy-400 italic mt-0.5">Follow-up: {action.followUpNote}</p>
          )}
        </div>
      )}

      {/* DOCUMENTED DECISION CALLOUT */}
      {action.status === 'documented' && action.documentedDecision && (
        <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-3 flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between text-purple-300 font-semibold">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <FileCheck2 className="w-3.5 h-3.5 text-purple-400" />
              Documented Clinical Decision (Surveillance Ongoing)
            </span>
            {action.documentedAt && (
              <span className="text-[10px] text-purple-400/80">
                {new Date(action.documentedAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <p className="text-navy-100 font-medium leading-relaxed">{action.documentedDecision}</p>
          {action.followUpNote && (
            <p className="text-[11px] text-purple-300/80 italic mt-0.5">Advisory: {action.followUpNote}</p>
          )}
        </div>
      )}

      {/* Action Controls / Transitions */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-navy-700/60">
        {action.status === 'open' && (
          <button
            onClick={onStart}
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 bg-navy-700 px-3 py-1.5 text-xs font-semibold text-navy-100 hover:text-white hover:bg-navy-600 transition-colors"
          >
            <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Start Action</span>
          </button>
        )}

        {(action.status === 'open' || action.status === 'in_progress' || action.status === 'documented') && (
          <button
            onClick={onDocument}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-colors"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Document Decision</span>
          </button>
        )}

        {(action.status === 'open' || action.status === 'in_progress' || action.status === 'documented') && (
          <button
            onClick={onResolve}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 px-3 py-1.5 text-xs font-bold text-navy-950 transition-colors shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Resolve with Outcome</span>
          </button>
        )}

        {action.status === 'resolved' && (
          <button
            onClick={onReopen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 bg-navy-700/40 px-3 py-1.5 text-xs font-medium text-navy-300 hover:text-white hover:bg-navy-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Re-open Action</span>
          </button>
        )}
      </div>
    </div>
  );
}
