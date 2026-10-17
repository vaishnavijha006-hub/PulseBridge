/**
 * Closed-Loop Care — Action Tracker Component
 *
 * Displays care actions for a patient (or all patients), lets the doctor
 * create new actions, update their status, and record outcome/follow-up notes.
 *
 * IMPORTANT safety guarantees mirrored from careActionService:
 * - Creating or completing an action does NOT resolve or modify linked CareGaps.
 * - Critical emergency warnings are never hidden by action status.
 * - Unresolved and documented actions always remain visible.
 * - "Documented" and "Resolved" are clearly distinguished in the UI.
 * - Data persists only for the current browser session (in-memory demo).
 *
 * Integration note for other developers:
 *   Import this component and pass a patientId (or leave it undefined to show all
 *   actions across all patients). The component is self-contained and manages its
 *   own action state by calling careActionService directly.
 *
 *   Example:
 *     <CareActionTracker patientId="p1" patientName="Ravi Sharma" linkedCareGaps={gaps} />
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText,
  Plus,
  ChevronDown,
  ChevronUp,
  XCircle,
  RefreshCw,
  User,
  Calendar,
  Link2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { CareAction, CareActionStatus } from '@/types/careAction';
import type { CareGap } from '@/types';
import {
  createCareAction,
  updateCareActionStatus,
  getActionsForPatient,
  getAllActions,
  isActionOverdue,
} from '@/services/careActionService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CareActionTrackerProps {
  /** If provided, shows only actions for this patient. */
  patientId?: string;
  /** Display name used in headings and the create form. */
  patientName?: string;
  /**
   * Care gaps for the current patient — used to populate the
   * "Link to care gap" dropdown. Does NOT auto-resolve gaps.
   */
  linkedCareGaps?: CareGap[];
}

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------

type StatusConfig = {
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
  cardBorderClass: string;
};

const STATUS_CONFIG: Record<CareActionStatus, StatusConfig> = {
  open: {
    label: 'Open',
    icon: <AlertTriangle className="w-3 h-3" />,
    badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
    cardBorderClass: 'border-amber-500/30 bg-amber-500/5',
  },
  in_progress: {
    label: 'In Progress',
    icon: <RefreshCw className="w-3 h-3" />,
    badgeClass: 'bg-teal-100 text-teal-700 border border-teal-200',
    cardBorderClass: 'border-teal-500/30 bg-teal-500/5',
  },
  resolved: {
    label: 'Resolved',
    icon: <CheckCircle className="w-3 h-3" />,
    badgeClass: 'bg-success-100 text-success-700 border border-success-200',
    cardBorderClass: 'border-navy-600 bg-navy-700/20',
  },
  documented: {
    label: 'Documented',
    icon: <FileText className="w-3 h-3" />,
    badgeClass: 'bg-surface-muted text-navy-600 border border-surface-border',
    cardBorderClass: 'border-navy-600 bg-navy-700/20',
  },
};

// ---------------------------------------------------------------------------
// Subcomponent: Status Badge
// ---------------------------------------------------------------------------

function ActionStatusBadge({ status }: { status: CareActionStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        cfg.badgeClass,
      )}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: Due date indicator
// ---------------------------------------------------------------------------

function DueDateIndicator({ action }: { action: CareAction }) {
  if (!action.dueDate) return null;
  const overdue = isActionOverdue(action);
  const label = new Date(action.dueDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        overdue ? 'text-danger-400' : 'text-navy-400',
      )}
      aria-label={overdue ? `Overdue: due ${label}` : `Due ${label}`}
    >
      <Calendar className="w-3 h-3" />
      {overdue ? `Overdue · ${label}` : `Due ${label}`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: Overdue warning banner
// ---------------------------------------------------------------------------

function OverdueBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 px-4 py-2.5 text-sm font-medium text-danger-400"
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      {count === 1
        ? '1 action is overdue and requires attention.'
        : `${count} actions are overdue and require attention.`}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: Status Update Form
// ---------------------------------------------------------------------------

interface StatusUpdateFormProps {
  action: CareAction;
  onSuccess: (updated: CareAction) => void;
  onCancel: () => void;
}

function StatusUpdateForm({ action, onSuccess, onCancel }: StatusUpdateFormProps) {
  const [newStatus, setNewStatus] = useState<CareActionStatus | ''>('');
  const [outcomeNote, setOutcomeNote] = useState(action.outcomeNote ?? '');
  const [followUpNote, setFollowUpNote] = useState(action.followUpNote ?? '');
  const [error, setError] = useState<string | null>(null);

  // Determine which statuses are valid from the current one.
  const validNextStatuses: CareActionStatus[] = (() => {
    const transitions: Record<CareActionStatus, CareActionStatus[]> = {
      open: ['in_progress', 'resolved', 'documented'],
      in_progress: ['resolved', 'documented'],
      resolved: [],
      documented: [],
    };
    return transitions[action.status] ?? [];
  })();

  if (validNextStatuses.length === 0) {
    return (
      <p className="text-xs text-navy-400 italic py-2">
        This action has reached a terminal status and cannot be updated further.
      </p>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newStatus) {
      setError('Please select a new status.');
      return;
    }

    const result = updateCareActionStatus({
      actionId: action.id,
      newStatus,
      outcomeNote: outcomeNote || undefined,
      followUpNote: followUpNote || undefined,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSuccess(result.action);
  };

  const needsOutcomeNote = newStatus === 'resolved';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2 border-t border-navy-600/50">
      <p className="text-xs font-semibold text-navy-300 uppercase tracking-wide">Update Status</p>

      {/* Status selector */}
      <div className="flex flex-col gap-1">
        <label htmlFor={`status-select-${action.id}`} className="text-xs font-medium text-navy-300">
          New Status <span aria-hidden>*</span>
        </label>
        <select
          id={`status-select-${action.id}`}
          value={newStatus}
          onChange={(e) => { setNewStatus(e.target.value as CareActionStatus); setError(null); }}
          required
          className="rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
        >
          <option value="">— Select status —</option>
          {validNextStatuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s].label}
            </option>
          ))}
        </select>
      </div>

      {/* Outcome note */}
      <div className="flex flex-col gap-1">
        <label htmlFor={`outcome-${action.id}`} className="text-xs font-medium text-navy-300">
          Outcome / Resolution Note
          {needsOutcomeNote && (
            <span className="ml-1 text-danger-400 font-bold" aria-label="required">*</span>
          )}
        </label>
        {needsOutcomeNote && (
          <p className="text-xs text-amber-400">
            Required to resolve an action. Recording a note alone does not constitute proof of clinical completion.
          </p>
        )}
        {newStatus === 'documented' && (
          <p className="text-xs text-navy-400">
            "Documented" records a clinical note but does not mark the issue as resolved.
          </p>
        )}
        <textarea
          id={`outcome-${action.id}`}
          value={outcomeNote}
          onChange={(e) => setOutcomeNote(e.target.value)}
          required={needsOutcomeNote}
          placeholder={needsOutcomeNote ? 'Describe what was done to resolve this action…' : 'Optional: describe the clinical observation or note…'}
          rows={3}
          className="rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none resize-none"
        />
      </div>

      {/* Follow-up note (only for non-terminal targets) */}
      {(newStatus === 'in_progress' || newStatus === 'documented') && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`followup-${action.id}`} className="text-xs font-medium text-navy-300">
            Follow-up Note
          </label>
          <textarea
            id={`followup-${action.id}`}
            value={followUpNote}
            onChange={(e) => setFollowUpNote(e.target.value)}
            placeholder="Optional: note what still needs follow-up…"
            rows={2}
            className="rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none resize-none"
          />
        </div>
      )}

      {/* Validation error */}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger-400 flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}

      {/* Form controls */}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          Update Status
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-navy-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-navy-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: Action Card
// ---------------------------------------------------------------------------

interface ActionCardProps {
  action: CareAction;
  careGaps?: CareGap[];
  onUpdated: (updated: CareAction) => void;
}

function ActionCard({ action, careGaps, onUpdated }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const overdue = isActionOverdue(action);
  const cfg = STATUS_CONFIG[action.status];

  const linkedGap = careGaps?.find((g) => g.id === action.linkedCareGapId);

  return (
    <article
      aria-label={`Care action: ${action.title}`}
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-3 transition-all',
        cfg.cardBorderClass,
        overdue && 'ring-1 ring-danger-500/40',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ActionStatusBadge status={action.status} />
            {overdue && (
              <span
                role="alert"
                className="inline-flex items-center gap-1 rounded-full bg-danger-500/20 px-2 py-0.5 text-[10px] font-bold text-danger-400 border border-danger-500/30"
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                OVERDUE
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-white mt-0.5 break-words">{action.title}</h3>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse action details' : 'Expand action details'}
          className="flex-shrink-0 flex w-7 h-7 items-center justify-center rounded-lg text-navy-400 hover:text-white hover:bg-navy-700 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3">
        {action.assignedTo && (
          <span className="inline-flex items-center gap-1 text-xs text-navy-400">
            <User className="w-3 h-3" />
            {action.assignedTo}
          </span>
        )}
        <DueDateIndicator action={action} />
        {linkedGap && (
          <span className="inline-flex items-center gap-1 text-xs text-teal-400">
            <Link2 className="w-3 h-3" />
            Linked gap: {linkedGap.type.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <p className="text-sm text-navy-200 leading-relaxed">{action.description}</p>

          {/* Gap context — read-only reference, NOT a resolve control */}
          {linkedGap && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
                Linked Care Gap (reference only)
              </span>
              <p className="text-xs text-amber-300/90 leading-relaxed">{linkedGap.evidence}</p>
              <p className="text-[10px] text-navy-400">
                ⚠ Completing this action does not resolve the linked care gap.
              </p>
            </div>
          )}

          {/* Outcome note */}
          {action.outcomeNote && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-navy-300 uppercase tracking-wide">
                Outcome Note
              </span>
              <p className="text-sm text-navy-100 leading-relaxed">{action.outcomeNote}</p>
              {action.status === 'documented' && (
                <p className="text-[10px] text-navy-400 italic">
                  Note recorded. "Documented" status does not mean the issue is clinically resolved.
                </p>
              )}
            </div>
          )}

          {/* Follow-up note */}
          {action.followUpNote && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wide">
                Follow-up Note
              </span>
              <p className="text-sm text-teal-300/90 leading-relaxed">{action.followUpNote}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex flex-wrap gap-4 pt-1 border-t border-navy-600/30">
            <span className="text-[10px] text-navy-400">
              Created: {new Date(action.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[10px] text-navy-400">
              Updated: {new Date(action.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Status update form */}
          {!showUpdateForm && (action.status === 'open' || action.status === 'in_progress') && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowUpdateForm(true)}
                className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-teal-500/10"
              >
                Update Status
              </button>
            </div>
          )}

          {showUpdateForm && (
            <StatusUpdateForm
              action={action}
              onSuccess={(updated) => {
                setShowUpdateForm(false);
                onUpdated(updated);
              }}
              onCancel={() => setShowUpdateForm(false)}
            />
          )}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: Create Action Form
// ---------------------------------------------------------------------------

interface CreateActionFormProps {
  patientId: string;
  careGaps?: CareGap[];
  onCreated: (action: CareAction) => void;
  onCancel: () => void;
}

function CreateActionForm({ patientId, careGaps, onCreated, onCancel }: CreateActionFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [linkedCareGapId, setLinkedCareGapId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = createCareAction({
      patientId,
      title: title.trim(),
      description: description.trim(),
      assignedTo: assignedTo.trim() || null,
      linkedCareGapId: linkedCareGapId || null,
      dueDate: dueDate || null,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onCreated(result.action);
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Create new care action"
      className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4 flex flex-col gap-3"
    >
      <p className="text-sm font-bold text-teal-400">New Care Action</p>
      <p className="text-xs text-navy-400">
        Creating an action does not resolve any linked care gap. All existing warnings remain active.
      </p>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label htmlFor="new-action-title" className="text-xs font-medium text-navy-300">
          Title <span className="text-danger-400" aria-hidden>*</span>
        </label>
        <input
          id="new-action-title"
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(null); }}
          placeholder="Short, clear description of the required action"
          required
          maxLength={120}
          className="rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label htmlFor="new-action-desc" className="text-xs font-medium text-navy-300">
          Description <span className="text-danger-400" aria-hidden>*</span>
        </label>
        <textarea
          id="new-action-desc"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setError(null); }}
          placeholder="Detailed description of what needs to be done and why"
          required
          rows={3}
          className="rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none resize-none"
        />
      </div>

      {/* Assigned to */}
      <div className="flex flex-col gap-1">
        <label htmlFor="new-action-assigned" className="text-xs font-medium text-navy-300">
          Assign To
        </label>
        <input
          id="new-action-assigned"
          type="text"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          placeholder="e.g. Dr. Meena, Care Coordinator, Nurse Priya"
          className="rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
        />
      </div>

      {/* Link to care gap */}
      {careGaps && careGaps.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="new-action-gap" className="text-xs font-medium text-navy-300">
            Link to Care Gap (optional)
          </label>
          <p className="text-[10px] text-navy-400">
            This is a reference only. Selecting a gap does not resolve it.
          </p>
          <select
            id="new-action-gap"
            value={linkedCareGapId}
            onChange={(e) => setLinkedCareGapId(e.target.value)}
            className="rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
          >
            <option value="">— No linked gap —</option>
            {careGaps.map((g) => (
              <option key={g.id} value={g.id}>
                {g.type.replace(/_/g, ' ')} — {g.evidence.slice(0, 50)}…
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Due date */}
      <div className="flex flex-col gap-1">
        <label htmlFor="new-action-due" className="text-xs font-medium text-navy-300">
          Due Date (optional)
        </label>
        <input
          id="new-action-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-navy-600 bg-navy-700 px-3 py-2 text-sm text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none"
        />
      </div>

      {/* Validation error */}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger-400 flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}

      {/* Form controls */}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <Plus className="w-4 h-4" />
          Create Action
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-navy-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-navy-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component: CareActionTracker
// ---------------------------------------------------------------------------

export function CareActionTracker({ patientId, patientName, linkedCareGaps }: CareActionTrackerProps) {
  const [actions, setActions] = useState<CareAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<CareActionStatus | 'all'>('all');

  // Load initial actions.
  useEffect(() => {
    try {
      const data = patientId ? getActionsForPatient(patientId) : getAllActions();
      setActions(data);
    } catch (err) {
      // Service errors should not crash the component.
      console.error('[CareActionTracker] Failed to load actions:', err);
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const handleCreated = useCallback((action: CareAction) => {
    setActions((prev) => [action, ...prev]);
    setShowCreateForm(false);
  }, []);

  const handleUpdated = useCallback((updated: CareAction) => {
    setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }, []);

  const filteredActions = filterStatus === 'all'
    ? actions
    : actions.filter((a) => a.status === filterStatus);

  const overdueCount = actions.filter(
    (a) => a.status !== 'resolved' && a.status !== 'documented' && isActionOverdue(a),
  ).length;

  const effectivePatientId = patientId ?? '';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section
      aria-label="Closed-Loop Care: Action Tracker"
      className="flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-400" />
            Closed-Loop Care Actions
            {patientName && (
              <span className="text-navy-400 font-normal text-sm">— {patientName}</span>
            )}
          </h2>
          <p className="text-xs text-navy-400">
            Demo mode: changes persist for this session only and are lost on page refresh.
          </p>
        </div>
        {effectivePatientId && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <Plus className="w-4 h-4" />
            New Action
          </button>
        )}
      </div>

      {/* Overdue warning */}
      <OverdueBanner count={overdueCount} />

      {/* Create form */}
      {showCreateForm && effectivePatientId && (
        <CreateActionForm
          patientId={effectivePatientId}
          careGaps={linkedCareGaps}
          onCreated={handleCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter actions by status">
        {(['all', 'open', 'in_progress', 'resolved', 'documented'] as const).map((s) => {
          const count = s === 'all'
            ? actions.length
            : actions.filter((a) => a.status === s).length;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={filterStatus === s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
                filterStatus === s
                  ? 'text-teal-400 border-teal-500/30 bg-teal-500/10'
                  : 'text-navy-300 border-navy-600 bg-navy-700/30 hover:bg-navy-700',
              )}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
              <span className="font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Action list */}
      {loading ? (
        <div className="rounded-xl border border-navy-600 bg-navy-700/30 p-8 text-center text-navy-400 text-sm">
          Loading actions…
        </div>
      ) : filteredActions.length === 0 ? (
        <div className="rounded-xl border border-navy-600 bg-navy-700/30 p-8 text-center text-navy-400 text-sm" aria-live="polite">
          {filterStatus === 'all'
            ? 'No care actions have been created for this patient.'
            : `No ${STATUS_CONFIG[filterStatus as CareActionStatus]?.label ?? filterStatus} actions.`}
        </div>
      ) : (
        <div className="flex flex-col gap-3" role="list" aria-label="Care action list">
          {filteredActions.map((action) => (
            <div key={action.id} role="listitem">
              <ActionCard
                action={action}
                careGaps={linkedCareGaps}
                onUpdated={handleUpdated}
              />
            </div>
          ))}
        </div>
      )}

      {/* Safety note footer */}
      <div className="rounded-lg border border-navy-600/30 bg-navy-700/20 px-4 py-3 text-xs text-navy-400 leading-relaxed">
        <strong className="text-navy-300">Important:</strong> Care actions track clinical tasks.
        Completing or documenting an action does not automatically resolve a care gap, modify a
        prescription, or change the patient's triage score. Critical emergency warnings remain
        visible regardless of action status. A note alone is not proof of clinical completion.
      </div>
    </section>
  );
}
