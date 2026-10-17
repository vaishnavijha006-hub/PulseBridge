import { useState, useMemo } from 'react';
import { Search, AlertTriangle, FileCheck, ChevronLeft, Clock, TrendingUp, Activity, ShieldAlert, MessageSquare, Pill } from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { CursorGlow } from '@/components/CursorGlow';
import { PatientStatusCard } from '@/components/PatientStatusCard';
import { PrescriptionReview } from '@/components/PrescriptionReview';
import { CareGapCard } from '@/components/CareGapCard';
import { StatusBadge } from '@/components/StatusBadge';
import { DemoBanner, DemoBadge } from '@/components/DemoBanner';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import type { PatientSummary, CareGap, PrescriptionDraft, FollowUp } from '@/types';


interface DoctorDashboardProps {
  summaries: PatientSummary[];
  careGaps: Record<string, CareGap[]>;
  prescriptionDrafts: Record<string, PrescriptionDraft>;
  followUps: Record<string, FollowUp[]>;
  onConfirmCarePlan: (patientId: string, fields: any[]) => void;
  onCareGapAction: (gapId: string, action: 'reviewed' | 'followup_planned') => void;
  onBack: () => void;
}

type Filter = 'all' | 'urgent' | 'needs_attention' | 'on_track';

export function DoctorDashboard({
  summaries,
  careGaps,
  prescriptionDrafts,
  followUps,
  onConfirmCarePlan,
  onCareGapAction,
  onBack,
}: DoctorDashboardProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const allGaps = useMemo(() =>
    Object.values(careGaps).flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [careGaps]);

  const totalOpenGaps = allGaps.filter(g => g.status === 'open').length;
  const pendingRxCount = Object.values(prescriptionDrafts).filter(d => !d.confirmed).length;

  const filteredSummaries = useMemo(() => {
    return summaries
      .filter(s => filter === 'all' || s.priority === filter)
      .filter(s => !search || s.patient.name.toLowerCase().includes(search.toLowerCase()));
  }, [summaries, filter, search]);

  if (selectedPatient) {
    const summary = summaries.find(s => s.patient.id === selectedPatient);
    if (!summary) return null;

    return (
      <PatientDetail
        summary={summary}
        gaps={careGaps[selectedPatient] ?? []}
        draft={prescriptionDrafts[selectedPatient]}
        followUps={followUps[selectedPatient] ?? []}
        onConfirmCarePlan={(fields) => onConfirmCarePlan(selectedPatient, fields)}
        onCareGapAction={onCareGapAction}
        onBack={() => setSelectedPatient(null)}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-navy-800 overflow-hidden dark-surface">
      <CursorGlow />

      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[300px] rounded-full bg-teal-500/8 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-navy-600/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="flex w-9 h-9 items-center justify-center rounded-lg text-navy-200 hover:bg-navy-700 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <PulseBridgeLogo variant="dark" size="md" />
              <div className="hidden lg:block">
                <DemoBanner variant="dark" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <DemoBadge variant="dark" />
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-lg bg-navy-700 border border-navy-600 px-3 py-1.5">

                <span className="text-xs font-medium text-navy-200">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg bg-danger-500/10 border border-danger-500/20 px-3 py-1.5">
                  <AlertTriangle className="w-4 h-4 text-danger-400" />
                  <span className="text-sm font-bold text-danger-400">{totalOpenGaps}</span>
                  <span className="text-xs text-danger-300 hidden sm:inline">{t('doctor_caregaps')}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5">
                  <FileCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">{pendingRxCount}</span>
                  <span className="text-xs text-amber-300 hidden sm:inline">{t('doctor_pending_rx')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Title bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">{t('doctor_overview')}</h1>
          <div className="flex items-center gap-3 flex-1 sm:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('doctor_search')}
                className="w-full rounded-lg border border-navy-600 bg-navy-700 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-navy-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')} label={t('doctor_filter_all')} count={summaries.length} />
          <FilterTab active={filter === 'urgent'} onClick={() => setFilter('urgent')} label={t('doctor_filter_urgent')} count={summaries.filter(s => s.priority === 'urgent').length} color="danger" />
          <FilterTab active={filter === 'needs_attention'} onClick={() => setFilter('needs_attention')} label={t('doctor_filter_attention')} count={summaries.filter(s => s.priority === 'needs_attention').length} color="amber" />
          <FilterTab active={filter === 'on_track'} onClick={() => setFilter('on_track')} label={t('doctor_filter_ontime')} count={summaries.filter(s => s.priority === 'on_track').length} color="success" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient cards */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-navy-200 uppercase tracking-wide">Patients ({filteredSummaries.length})</h2>
            {filteredSummaries.length === 0 ? (
              <div className="rounded-2xl border border-navy-600 bg-navy-700/30 p-8 text-center text-navy-400">
                {t('empty_no_data')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredSummaries.map((s) => (
                  <PatientStatusCard key={s.patient.id} summary={s} onClick={() => setSelectedPatient(s.patient.id)} />
                ))}
              </div>
            )}
          </div>

          {/* CareGap Radar sidebar */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-teal-400 uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {t('doctor_caregap_radar')}
            </h2>
            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
              {allGaps.length === 0 ? (
                <div className="rounded-xl border border-navy-600 bg-navy-700/30 p-6 text-center text-navy-400 text-sm">
                  No care gaps detected.
                </div>
              ) : (
                allGaps.map((gap) => (
                  <CareGapCard
                    key={gap.id}
                    gap={gap}
                    onReview={() => setSelectedPatient(gap.patientId)}
                    onPlanFollowUp={(id) => onCareGapAction(id, 'followup_planned')}
                    onMarkReviewed={(id) => onCareGapAction(id, 'reviewed')}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterTab({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color?: 'danger' | 'amber' | 'success' }) {
  const colorClasses = {
    danger: 'text-danger-400 border-danger-500/30 bg-danger-500/10',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    success: 'text-success-400 border-success-500/30 bg-success-500/10',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all whitespace-nowrap',
        active
          ? color ? colorClasses[color] : 'text-teal-400 border-teal-500/30 bg-teal-500/10'
          : 'text-navy-300 border-navy-600 bg-navy-700/30 hover:bg-navy-700',
      )}
    >
      {label}
      <span className={cn('text-xs font-bold', active ? '' : 'text-navy-400')}>{count}</span>
    </button>
  );
}

function PatientDetail({
  summary,
  gaps,
  draft,
  followUps,
  onConfirmCarePlan,
  onCareGapAction,
  onBack,
}: {
  summary: PatientSummary;
  gaps: CareGap[];
  draft?: PrescriptionDraft;
  followUps: FollowUp[];
  onConfirmCarePlan: (fields: any[]) => void;
  onCareGapAction: (gapId: string, action: 'reviewed' | 'followup_planned') => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'rx' | 'gaps'>('overview');

  return (
    <div className="relative min-h-screen bg-navy-800 overflow-hidden dark-surface">
      <CursorGlow />

      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[300px] rounded-full bg-teal-500/8 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-navy-600/50 backdrop-blur-sm sticky top-0">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-navy-200 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">{t('doctor_overview')}</span>
              </button>
              <div className="h-6 w-px bg-navy-600 hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">{summary.patient.name}</span>
                <StatusBadge
                  status={summary.priority === 'urgent' ? 'urgent' : summary.priority === 'needs_attention' ? 'attention' : 'on_track'}
                  label={summary.priority === 'urgent' ? t('doctor_priority_urgent') : summary.priority === 'needs_attention' ? t('doctor_priority_attention') : t('doctor_priority_ontime')}
                />
              </div>
            </div>
            <PulseBridgeLogo variant="dark" size="sm" showTagline={false} />
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Tab bar */}
        <div className="flex items-center gap-2 border-b border-navy-600">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" />
          {draft && <TabButton active={activeTab === 'rx'} onClick={() => setActiveTab('rx')} label={t('doctor_rx_verify')} badge={draft.confirmed ? undefined : '!'} />}
          <TabButton active={activeTab === 'gaps'} onClick={() => setActiveTab('gaps')} label={t('doctor_caregap_radar')} badge={gaps.filter(g => g.status === 'open').length || undefined} />
        </div>

        {activeTab === 'overview' && <OverviewTab summary={summary} followUps={followUps} />}
        {activeTab === 'rx' && draft && <PrescriptionReview draft={draft} onConfirm={onConfirmCarePlan} />}
        {activeTab === 'gaps' && (
          <div className="flex flex-col gap-3">
            {gaps.length === 0 ? (
              <div className="rounded-xl border border-navy-600 bg-navy-700/30 p-6 text-center text-navy-400">
                No care gaps for this patient.
              </div>
            ) : (
              gaps.map(gap => (
                <CareGapCard
                  key={gap.id}
                  gap={gap}
                  onReview={() => {}}
                  onPlanFollowUp={(id) => onCareGapAction(id, 'followup_planned')}
                  onMarkReviewed={(id) => onCareGapAction(id, 'reviewed')}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, badge }: { active: boolean; onClick: () => void; label: string; badge?: string | number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
        active ? 'text-teal-400 border-teal-400' : 'text-navy-300 border-transparent hover:text-navy-100',
      )}
    >
      {label}
      {badge && (
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-danger-500 text-white text-[10px] font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

function OverviewTab({ summary, followUps }: { summary: PatientSummary; followUps: FollowUp[] }) {
  const { t } = useLanguage();
  const { patient, dosesToday, adherence7Day, latestUpdate, triageScore, criticalSafetyOverride, criticalAlertMessage, scoreFactors } = summary;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Critical Safety Override banner */}
      {criticalSafetyOverride && (
        <div className="lg:col-span-2 rounded-2xl border border-danger-500 bg-danger-500/15 p-4 flex items-start gap-3 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <AlertTriangle className="w-5 h-5 text-danger-400 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-danger-200 uppercase tracking-wide">
              Critical Safety Override (Emergency Pathway Triggered)
            </span>
            <p className="text-sm text-danger-300">
              {criticalAlertMessage || 'Patient reported possible emergency symptoms. Direct medical review required regardless of numerical triage score.'}
            </p>
          </div>
        </div>
      )}

      {/* Patient info */}
      <div className="rounded-2xl border border-navy-600 bg-navy-700/50 p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-navy-200 uppercase tracking-wide">Patient Information</h3>
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Name" value={patient.name} />
          <InfoRow label="Age" value={`${patient.age} yrs`} />
          <InfoRow label="Gender" value={patient.gender} />
          <InfoRow label="Phone" value={patient.phone} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-navy-300 uppercase">Allergies</span>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-danger-400" />
            <span className="text-sm text-white">{patient.allergies || 'None reported'}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-navy-300 uppercase">Current Symptoms</span>
          <div className="flex items-start gap-2">
            <Activity className="w-4 h-4 text-amber-400 mt-0.5" />
            <span className="text-sm text-white">{patient.symptoms || 'None reported'}</span>
          </div>
        </div>
      </div>

      {/* Adherence stats & Triage Score */}
      <div className="rounded-2xl border border-navy-600 bg-navy-700/50 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-200 uppercase tracking-wide">Recovery & Triage</h3>
          {typeof triageScore === 'number' && (
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-extrabold border',
                triageScore >= 80
                  ? 'bg-danger-500/20 text-danger-300 border-danger-500/40'
                  : triageScore >= 50
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-teal-500/20 text-teal-300 border-teal-500/40',
              )}
            >
              Triage Score: {triageScore}/100
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatBox icon={<Pill className="w-5 h-5" />} label={t('doctor_doses_today')} value={`${dosesToday.taken}/${dosesToday.total} (${dosesToday.missed} missed)`} color="teal" />
          <StatBox icon={<TrendingUp className="w-5 h-5" />} label={t('doctor_adherence')} value={`${adherence7Day}%`} color={adherence7Day >= 80 ? 'success' : 'amber'} />
          <StatBox icon={<AlertTriangle className="w-5 h-5" />} label={t('doctor_open_gaps')} value={String(summary.openGaps)} color={summary.openGaps > 0 ? 'danger' : 'success'} />
          <StatBox icon={<Clock className="w-5 h-5" />} label={t('doctor_last_update')} value={formatTimeAgo(summary.lastUpdateAt)} color="navy" />
        </div>

        {scoreFactors && scoreFactors.length > 0 && (
          <div className="border-t border-navy-600/50 pt-3 flex flex-col gap-2">
            <span className="text-xs font-semibold text-amber-400 uppercase">Triage Heuristic Factors</span>
            <div className="flex flex-col gap-1.5">
              {scoreFactors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-navy-200">
                  <span className="text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 flex-shrink-0">
                    +{f.points}
                  </span>
                  <div>
                    <span>{f.reason}</span>
                    {f.evidence && <span className="text-navy-400 block text-[11px] italic">Evidence: {f.evidence}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-navy-400 italic pt-1 border-t border-navy-700">
          * Queue-sorting heuristic only; not a diagnostic or medical risk prediction. Low score does not guarantee patient safety.
        </p>
      </div>

      {/* Latest health update */}
      {latestUpdate && (
        <div className="rounded-2xl border border-navy-600 bg-navy-700/50 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-navy-200 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            {t('doctor_detail_timeline')}
          </h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3 rounded-xl bg-navy-800/50 p-4 border border-navy-600/30">
              <div className={cn(
                'flex w-8 h-8 items-center justify-center rounded-full flex-shrink-0',
                latestUpdate.state === 'good' ? 'bg-success-500/20' : latestUpdate.state === 'ok' ? 'bg-amber-500/20' : 'bg-danger-500/20',
              )}>
                <span className="text-sm">{latestUpdate.state === 'good' ? '😊' : latestUpdate.state === 'ok' ? '😐' : '😟'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-navy-300">{t('doctor_patient_reported')}</span>
                <p className="text-sm text-white">"{latestUpdate.symptomDescription}"</p>
                <span className="text-xs text-navy-400">{formatTimeAgo(latestUpdate.submittedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up history */}
      {followUps.length > 0 && (
        <div className="rounded-2xl border border-navy-600 bg-navy-700/50 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-navy-200 uppercase tracking-wide mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            {t('doctor_detail_followups')}
          </h3>
          <div className="flex flex-col gap-2">
            {followUps.map((f) => (
              <div key={f.id} className="flex items-start gap-3 rounded-xl bg-navy-800/50 p-3 border border-navy-600/30">
                <div className="flex w-8 h-8 items-center justify-center rounded-full bg-teal-500/10 flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-teal-400" />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <p className="text-sm text-white">{f.question}</p>
                  {f.answer ? (
                    <p className="text-sm text-teal-300">→ {f.answer}</p>
                  ) : (
                    <StatusBadge status="open" label="Pending" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-navy-300 uppercase">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}

function StatBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: 'teal' | 'success' | 'amber' | 'danger' | 'navy' }) {
  const colorMap = {
    teal: 'text-teal-400 bg-teal-500/10',
    success: 'text-success-400 bg-success-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    danger: 'text-danger-400 bg-danger-500/10',
    navy: 'text-navy-200 bg-navy-600/30',
  };

  return (
    <div className="rounded-xl bg-navy-800/50 border border-navy-600/30 p-4 flex flex-col gap-2">
      <div className={cn('flex w-9 h-9 items-center justify-center rounded-lg', colorMap[color])}>
        {icon}
      </div>
      <span className="text-xs font-medium text-navy-300">{label}</span>
      <span className="text-lg font-bold text-white">{value}</span>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
