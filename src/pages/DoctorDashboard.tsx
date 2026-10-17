import { useState, useMemo } from 'react';
import {
  Search,
  AlertTriangle,
  FileCheck,
  ChevronLeft,
  Clock,
  TrendingUp,
  Activity,
  ShieldAlert,
  MessageSquare,
  Pill,
  Check,
  ArrowUpDown,
  RefreshCw,
  LayoutDashboard,
  User,
  Users,
  Radar,
  RotateCcw,
  FileText,
  ChevronRight,
  Menu,
  Stethoscope,
  X,
  Sparkles
} from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { CursorGlow } from '@/components/CursorGlow';
import { PatientStatusCard } from '@/components/PatientStatusCard';
import { PrescriptionReview } from '@/components/PrescriptionReview';
import { CareGapCard } from '@/components/CareGapCard';
import { StatusBadge } from '@/components/StatusBadge';
import { DemoBanner, DemoBadge } from '@/components/DemoBanner';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ClosedLoopCareView } from '@/components/ClosedLoopCareView';
import { ReportSummaryView } from '@/components/ReportSummaryView';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import type { PatientSummary, CareGap, PrescriptionDraft, FollowUp, MedicalReport } from '@/types';
import { demoMedicalReports } from '@/data/demoData';
import { careActionService } from '@/services/careActionService';

interface DoctorDashboardProps {
  summaries: PatientSummary[];
  careGaps: Record<string, CareGap[]>;
  prescriptionDrafts: Record<string, PrescriptionDraft>;
  followUps: Record<string, FollowUp[]>;
  reports?: Record<string, MedicalReport[]>;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onConfirmCarePlan: (patientId: string, fields: any[]) => void;
  onCareGapAction: (gapId: string, action: 'reviewed' | 'followup_planned') => void;
  onBack: () => void;
  onNavigateRole?: (role: 'patient' | 'admin' | 'family') => void;
}

type Filter = 'all' | 'urgent' | 'needs_attention' | 'on_track';
type SortOption = 'priority_desc' | 'priority_asc' | 'overdue_desc' | 'gaps_desc' | 'name_asc';
type GapFilterOption = 'all' | 'open' | 'resolved';
type DoctorNavTab = 'overview' | 'patients' | 'radar' | 'actions' | 'reports';

export function DoctorDashboard({
  summaries,
  careGaps,
  prescriptionDrafts,
  followUps,
  reports,
  isLoading,
  error,
  onRetry,
  onConfirmCarePlan,
  onCareGapAction,
  onBack,
  onNavigateRole,
}: DoctorDashboardProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('priority_desc');
  const [gapFilter, setGapFilter] = useState<GapFilterOption>('all');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<DoctorNavTab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalPatientId, setGlobalPatientId] = useState<string>('');

  const currentGlobalPatient = useMemo(() => {
    if (globalPatientId) {
      const found = summaries.find((s) => s.patient.id === globalPatientId);
      if (found) return found.patient;
    }
    return summaries[0]?.patient ?? {
      id: 'p1',
      name: 'Ravi Sharma',
      age: 62,
      gender: 'male' as const,
      phone: '9876543210',
      symptoms: 'Chest heaviness',
      allergies: 'Penicillin',
      currentMeds: 'Aspirin, Metformin',
      language: 'hi' as const,
    };
  }, [summaries, globalPatientId]);

  const allGaps = useMemo(
    () =>
      Object.values(careGaps)
        .flat()
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [careGaps]
  );

  const totalOpenGaps = allGaps.filter((g) => g.status === 'open').length;
  const totalResolvedGaps = allGaps.filter((g) => g.status !== 'open').length;
  const pendingRxCount = Object.values(prescriptionDrafts).filter((d) => !d.confirmed).length;
  const allActions = useMemo(() => careActionService.getAll(), []);
  const openActionsCount = allActions.filter((a) => a.status === 'open' || a.status === 'in_progress').length;

  // Emergency safety override patient detection
  const emergencyPatient = useMemo(
    () => summaries.find((s) => s.criticalSafetyOverride),
    [summaries]
  );

  const filteredGaps = useMemo(() => {
    if (gapFilter === 'open') return allGaps.filter(g => g.status === 'open');
    if (gapFilter === 'resolved') return allGaps.filter(g => g.status !== 'open');
    return allGaps;
  }, [allGaps, gapFilter]);

  const filteredSummaries = useMemo(() => {
    return summaries
      .filter((s) => filter === 'all' || s.priority === filter)
      .filter((s) => !search || s.patient.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'priority_desc') {
          // 1. Critical safety emergency override always first
          if (a.criticalSafetyOverride && !b.criticalSafetyOverride) return -1;
          if (!a.criticalSafetyOverride && b.criticalSafetyOverride) return 1;
          // 2. Triage score descending
          const scoreDiff = (b.triageScore ?? 0) - (a.triageScore ?? 0);
          if (scoreDiff !== 0) return scoreDiff;
          // 3. Open care gaps count descending
          return b.openGaps - a.openGaps;
        }
        if (sortBy === 'priority_asc') {
          const scoreDiff = (a.triageScore ?? 0) - (b.triageScore ?? 0);
          if (scoreDiff !== 0) return scoreDiff;
          return a.openGaps - b.openGaps;
        }
        if (sortBy === 'overdue_desc') {
          const aOverdue = (a.overdueFollowUpsCount ?? 0) + (a.overdueTasksCount ?? 0) + (a.openGaps ?? 0);
          const bOverdue = (b.overdueFollowUpsCount ?? 0) + (b.overdueTasksCount ?? 0) + (b.openGaps ?? 0);
          if (bOverdue !== aOverdue) return bOverdue - aOverdue;
          return (b.triageScore ?? 0) - (a.triageScore ?? 0);
        }
        if (sortBy === 'gaps_desc') {
          const gapDiff = b.openGaps - a.openGaps;
          if (gapDiff !== 0) return gapDiff;
          return (b.triageScore ?? 0) - (a.triageScore ?? 0);
        }
        if (sortBy === 'name_asc') {
          return a.patient.name.localeCompare(b.patient.name);
        }
        return 0;
      });
  }, [summaries, filter, search, sortBy]);

  // When patient is selected, display EHR Clinical Chart
  if (selectedPatient) {
    const summary = summaries.find((s) => s.patient.id === selectedPatient);
    if (!summary) return null;

    return (
      <PatientDetail
        summary={summary}
        gaps={careGaps[selectedPatient] ?? []}
        draft={prescriptionDrafts[selectedPatient]}
        followUps={followUps[selectedPatient] ?? []}
        reports={reports?.[selectedPatient] ?? demoMedicalReports[selectedPatient] ?? []}
        onConfirmCarePlan={(fields) => onConfirmCarePlan(selectedPatient, fields)}
        onCareGapAction={onCareGapAction}
        onBack={() => setSelectedPatient(null)}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[#080E1A] text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      <CursorGlow />

      {/* Top Clinical Command Bar */}
      <header className="border-b border-navy-600/70 bg-[#0B1424]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="lg:flex hidden w-8 h-8 items-center justify-center rounded-lg text-slate-300 hover:bg-navy-700 hover:text-white transition-colors"
                title="Toggle Sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 rounded-lg border border-navy-600 bg-navy-700/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-navy-600 hover:text-white transition-colors"
                title="Back to Landing Page"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t('back')}</span>
              </button>
              <div className="h-5 w-px bg-navy-600 hidden sm:block" />
              <PulseBridgeLogo variant="dark" size="sm" showTagline={false} />
              <div className="hidden md:flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
                <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
                <span>Clinical Command Center</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Doctor identity pill */}
              <div className="hidden md:flex items-center gap-2.5 rounded-xl border border-navy-600 bg-navy-700/60 px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-bold">
                  DS
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-white leading-tight">Dr. S. Sharma, MD</span>
                  <span className="text-[10px] text-teal-300 leading-tight">Cardiology Service</span>
                </div>
              </div>

              {/* Quick role navigation */}
              {onNavigateRole && (
                <div className="hidden lg:flex items-center gap-1.5 border-r border-navy-600 pr-3 mr-1">
                  <button
                    onClick={() => onNavigateRole('patient')}
                    className="px-2.5 py-1 text-xs rounded-md text-slate-300 hover:text-teal-300 hover:bg-navy-700/80 transition-colors"
                  >
                    {t('role_patient')}
                  </button>
                  <button
                    onClick={() => onNavigateRole('admin')}
                    className="px-2.5 py-1 text-xs rounded-md text-slate-300 hover:text-teal-300 hover:bg-navy-700/80 transition-colors"
                  >
                    {t('role_admin')}
                  </button>
                </div>
              )}

              <LanguageToggle variant="dark" />
            </div>
          </div>
        </div>
      </header>

      {/* High-Priority Emergency Safety Override Strip */}
      {emergencyPatient && (
        <div className="bg-gradient-to-r from-danger-600/20 via-danger-500/15 to-danger-600/20 border-b border-danger-500/40 px-4 py-2.5 shadow-lg">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-danger-200 text-xs sm:text-sm font-semibold">
              <span className="flex w-2.5 h-2.5 rounded-full bg-danger-400 animate-ping flex-shrink-0" />
              <AlertTriangle className="w-4 h-4 text-danger-400 flex-shrink-0" />
              <span>
                <span className="uppercase tracking-wider font-bold text-danger-300 mr-1.5">
                  [Emergency Protocol Triggered]:
                </span>
                Patient <strong className="text-white underline">{emergencyPatient.patient.name}</strong> ({emergencyPatient.patient.id}) reported critical symptom: "{emergencyPatient.criticalAlertMessage || emergencyPatient.latestUpdate?.symptomDescription || 'Chest Heaviness'}". Triage: 100/100.
              </span>
            </div>
            <button
              onClick={() => setSelectedPatient(emergencyPatient.patient.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-danger-500 hover:bg-danger-400 text-white font-bold text-xs px-3 py-1.5 transition-colors shadow-md flex-shrink-0 self-start sm:self-auto"
            >
              <span>Immediate Review</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Clinical Body with Collapsible Sidebar */}
      <div className="flex-1 flex w-full mx-auto max-w-7xl">
        {/* Left Clinical Sidebar */}
        <aside
          className={cn(
            'border-r border-navy-600/50 bg-[#0A111F]/80 backdrop-blur-sm transition-all duration-300 flex flex-col py-6 px-3 flex-shrink-0 hidden lg:flex',
            sidebarCollapsed ? 'w-18' : 'w-64'
          )}
        >
          <div className="flex flex-col gap-1.5">
            <SidebarItem
              icon={<LayoutDashboard className="w-4 h-4" />}
              label={t('doctor_nav_overview')}
              active={activeNav === 'overview'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveNav('overview')}
            />
            <SidebarItem
              icon={<Users className="w-4 h-4" />}
              label={t('doctor_nav_patients')}
              badge={filteredSummaries.length}
              active={activeNav === 'patients'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveNav('patients')}
            />
            <SidebarItem
              icon={<Radar className="w-4 h-4" />}
              label={t('doctor_nav_radar')}
              badge={totalOpenGaps}
              badgeColor="amber"
              active={activeNav === 'radar'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveNav('radar')}
            />
            <SidebarItem
              icon={<RotateCcw className="w-4 h-4" />}
              label={t('doctor_nav_actions')}
              badge={openActionsCount}
              badgeColor="teal"
              active={activeNav === 'actions'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveNav('actions')}
            />
            <SidebarItem
              icon={<FileText className="w-4 h-4" />}
              label={t('doctor_nav_reports')}
              active={activeNav === 'reports'}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveNav('reports')}
            />
          </div>

          <div className="mt-auto pt-6 border-t border-navy-700/60 flex flex-col gap-3">
            {!sidebarCollapsed && (
              <div className="rounded-xl border border-navy-600/40 bg-navy-800/40 p-3 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300 block mb-1">Clinical Safety Guarantee:</span>
                Emergency overrides & critical allergy alerts remain permanently active until certified by physician review.
              </div>
            )}
          </div>
        </aside>

        {/* Content Cockpit */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-x-hidden">
          {/* Error notification banner */}
          {error && (
            <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-danger-400 flex-shrink-0" />
                <span className="text-sm text-danger-200">{error}</span>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger-500/20 hover:bg-danger-500/30 text-danger-200 text-xs font-semibold transition-colors flex-shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Header Bar with View Title & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                {activeNav === 'overview' && t('doctor_nav_overview')}
                {activeNav === 'patients' && t('doctor_nav_patients')}
                {activeNav === 'radar' && t('doctor_nav_radar')}
                {activeNav === 'actions' && t('doctor_nav_actions')}
                {activeNav === 'reports' && t('doctor_nav_reports')}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Inpatient Cardiology Recovery Unit · Shift Active
              </p>
            </div>

            {/* Quick stats pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 rounded-lg bg-danger-500/10 border border-danger-500/30 px-2.5 py-1 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-danger-400" />
                <span className="font-bold text-danger-400">{totalOpenGaps}</span>
                <span className="text-slate-400 hidden sm:inline">{t('doctor_caregaps')}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-xs">
                <FileCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-amber-400">{pendingRxCount}</span>
                <span className="text-slate-400 hidden sm:inline">{t('doctor_pending_rx')}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 px-2.5 py-1 text-xs">
                <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-bold text-teal-400">{openActionsCount}</span>
                <span className="text-slate-400 hidden sm:inline">{t('doctor_actions_count')}</span>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          {(activeNav === 'overview' || activeNav === 'patients') && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 max-w-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('doctor_search')}
                    className="w-full rounded-xl border border-navy-600 bg-navy-800/80 pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none transition-colors"
                  />
                </div>
                {/* Queue Sort Select */}
                <div className="flex items-center gap-2 bg-navy-800/80 border border-navy-600 rounded-xl px-3 py-2 flex-shrink-0">
                  <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
                  <label htmlFor="doctor-sort-select" className="text-xs text-slate-300 sr-only">Sort queue:</label>
                  <select
                    id="doctor-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-transparent text-xs text-white outline-none cursor-pointer pr-1"
                  >
                    <option value="priority_desc" className="bg-navy-800 text-white">Priority (High to Low)</option>
                    <option value="priority_asc" className="bg-navy-800 text-white">Priority (Low to High)</option>
                    <option value="overdue_desc" className="bg-navy-800 text-white">Overdue Status First</option>
                    <option value="gaps_desc" className="bg-navy-800 text-white">Open Gaps (Most First)</option>
                    <option value="name_asc" className="bg-navy-800 text-white">Patient Name (A-Z)</option>
                  </select>
                </div>
              </div>

              {/* Priority Filter tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <FilterTab
                  active={filter === 'all'}
                  onClick={() => setFilter('all')}
                  label={t('doctor_filter_all')}
                  count={summaries.length}
                />
                <FilterTab
                  active={filter === 'urgent'}
                  onClick={() => setFilter('urgent')}
                  label={t('doctor_filter_urgent')}
                  count={summaries.filter((s) => s.priority === 'urgent').length}
                  color="danger"
                />
                <FilterTab
                  active={filter === 'needs_attention'}
                  onClick={() => setFilter('needs_attention')}
                  label={t('doctor_filter_attention')}
                  count={summaries.filter((s) => s.priority === 'needs_attention').length}
                  color="amber"
                />
                <FilterTab
                  active={filter === 'on_track'}
                  onClick={() => setFilter('on_track')}
                  label={t('doctor_filter_ontime')}
                  count={summaries.filter((s) => s.priority === 'on_track').length}
                  color="success"
                />
              </div>
            </div>
          )}

          {/* VIEW: OVERVIEW */}
          {activeNav === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              {/* Patient Cohort Column */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Assigned Patients ({filteredSummaries.length})
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    Sorted by: {sortBy === 'priority_desc' ? 'Priority (High → Low)' : sortBy === 'priority_asc' ? 'Priority (Low → High)' : sortBy === 'overdue_desc' ? 'Overdue Status' : sortBy === 'gaps_desc' ? 'Open Gaps' : 'Name'}
                  </span>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="rounded-2xl border border-navy-600/50 bg-navy-700/20 p-5 flex flex-col gap-4 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-navy-600/50" />
                          <div className="flex flex-col gap-1.5 flex-1">
                            <div className="w-24 h-4 bg-navy-600/50 rounded" />
                            <div className="w-16 h-3 bg-navy-600/30 rounded" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-14 bg-navy-800/40 rounded-lg" />
                          <div className="h-14 bg-navy-800/40 rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredSummaries.length === 0 ? (
                  <div className="rounded-2xl border border-navy-600 bg-navy-800/40 p-8 text-center text-slate-400">
                    {t('empty_no_data')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredSummaries.map((s) => (
                      <PatientStatusCard
                        key={s.patient.id}
                        summary={s}
                        onClick={() => setSelectedPatient(s.patient.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* CareGap Radar Sidebar Column */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    {t('doctor_caregap_radar')}
                  </h2>
                  <button
                    onClick={() => setActiveNav('radar')}
                    className="text-[11px] text-teal-300 hover:underline"
                  >
                    View All
                  </button>
                </div>

                <div className="flex flex-col gap-3 max-h-[640px] overflow-y-auto pr-1">
                  {allGaps.length === 0 ? (
                    <div className="rounded-xl border border-navy-600 bg-navy-800/40 p-6 text-center text-slate-400 text-xs">
                      No care gaps currently detected.
                    </div>
                  ) : (
                    allGaps.slice(0, 4).map((gap) => (
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
          )}

          {/* VIEW: PATIENTS DIRECTORY */}
          {activeNav === 'patients' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSummaries.map((s) => (
                  <PatientStatusCard
                    key={s.patient.id}
                    summary={s}
                    onClick={() => setSelectedPatient(s.patient.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* VIEW: CAREGAP RADAR */}
          {activeNav === 'radar' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-6 flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Radar className="w-5 h-5 text-teal-400" />
                    CareGap Radar — Active Clinical Gaps Stream
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Continuous surveillance of medication adherence gaps, post-discharge reported symptoms, and unconfirmed prescriptions.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allGaps.map((gap) => (
                    <CareGapCard
                      key={gap.id}
                      gap={gap}
                      onReview={() => setSelectedPatient(gap.patientId)}
                      onPlanFollowUp={(id) => onCareGapAction(id, 'followup_planned')}
                      onMarkReviewed={(id) => onCareGapAction(id, 'reviewed')}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: CLOSED-LOOP CARE ACTIONS */}
          {activeNav === 'actions' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              {summaries.length > 0 && (
                <div className="flex items-center gap-2 px-1">
                  <User className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-semibold text-slate-300">Selected Patient:</span>
                  <select
                    aria-label="Select patient for closed-loop care actions"
                    value={currentGlobalPatient.id}
                    onChange={(e) => setGlobalPatientId(e.target.value)}
                    className="bg-navy-800 border border-navy-600 text-white rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-teal-500"
                  >
                    {summaries.map((s) => (
                      <option key={s.patient.id} value={s.patient.id}>
                        {s.patient.name} ({s.patient.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-6">
                <ClosedLoopCareView
                  patientId={currentGlobalPatient.id}
                  patientName={currentGlobalPatient.name}
                  careGaps={careGaps[currentGlobalPatient.id] ?? allGaps}
                />
              </div>
            </div>
          )}

          {/* VIEW: DIAGNOSTIC LAB REPORTS & AI */}
          {activeNav === 'reports' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              {summaries.length > 0 && (
                <div className="flex items-center gap-2 px-1">
                  <User className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-semibold text-slate-300">Selected Patient:</span>
                  <select
                    aria-label="Select patient for diagnostic reports"
                    value={currentGlobalPatient.id}
                    onChange={(e) => setGlobalPatientId(e.target.value)}
                    className="bg-navy-800 border border-navy-600 text-white rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-teal-500"
                  >
                    {summaries.map((s) => (
                      <option key={s.patient.id} value={s.patient.id}>
                        {s.patient.name} ({s.patient.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-6">
                <ReportSummaryView
                  reports={reports?.[currentGlobalPatient.id] ?? demoMedicalReports[currentGlobalPatient.id] ?? []}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  badge,
  badgeColor = 'default',
  active,
  collapsed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: 'default' | 'amber' | 'teal';
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const badgeClasses = {
    default: 'bg-navy-600 text-slate-300',
    amber: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    teal: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold transition-all',
        active
          ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
          : 'text-slate-400 hover:text-slate-200 hover:bg-navy-700/50'
      )}
      title={collapsed ? label : undefined}
    >
      <div className={cn('flex-shrink-0', active ? 'text-teal-400' : 'text-slate-400')}>
        {icon}
      </div>
      {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
      {!collapsed && typeof badge === 'number' && badge > 0 && (
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0',
            badgeClasses[badgeColor]
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function FilterTab({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: 'danger' | 'amber' | 'success';
}) {
  const colorClasses = {
    danger: 'text-danger-400 border-danger-500/40 bg-danger-500/15',
    amber: 'text-amber-400 border-amber-500/40 bg-amber-500/15',
    success: 'text-success-400 border-success-500/40 bg-success-500/15',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap',
        active
          ? color
            ? colorClasses[color]
            : 'text-teal-300 border-teal-500/40 bg-teal-500/15'
          : 'text-slate-400 border-navy-600 bg-navy-800/40 hover:bg-navy-700/60'
      )}
    >
      <span>{label}</span>
      <span className={cn('text-[11px] font-bold', active ? 'text-white' : 'text-slate-500')}>
        {count}
      </span>
    </button>
  );
}

function PatientDetail({
  summary,
  gaps,
  draft,
  followUps,
  reports,
  onConfirmCarePlan,
  onCareGapAction,
  onBack,
}: {
  summary: PatientSummary;
  gaps: CareGap[];
  draft?: PrescriptionDraft;
  followUps: FollowUp[];
  reports: MedicalReport[];
  onConfirmCarePlan: (fields: any[]) => void;
  onCareGapAction: (gapId: string, action: 'reviewed' | 'followup_planned') => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'rx' | 'reports' | 'gaps' | 'actions'>('overview');

  return (
    <div className="relative min-h-screen bg-[#080E1A] text-slate-100 flex flex-col font-sans">
      <CursorGlow />

      {/* Header */}
      <header className="border-b border-navy-600/70 bg-[#0B1424]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 rounded-lg border border-navy-600 bg-navy-700/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-navy-600 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t('doctor_nav_overview')}</span>
              </button>
              <div className="h-6 w-px bg-navy-600 hidden sm:block" />
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-white">{summary.patient.name}</span>
                <StatusBadge
                  status={
                    summary.priority === 'urgent'
                      ? 'urgent'
                      : summary.priority === 'needs_attention'
                      ? 'attention'
                      : 'on_track'
                  }
                  label={
                    summary.priority === 'urgent'
                      ? t('doctor_priority_urgent')
                      : summary.priority === 'needs_attention'
                      ? t('doctor_priority_attention')
                      : t('doctor_priority_ontime')
                  }
                />
              </div>
            </div>
            <PulseBridgeLogo variant="dark" size="sm" showTagline={false} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Tab bar */}
        <div className="flex items-center gap-2 border-b border-navy-600 overflow-x-auto pb-px">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            label={t('doctor_tab_summary')}
          />
          {draft && (
            <TabButton
              active={activeTab === 'rx'}
              onClick={() => setActiveTab('rx')}
              label={t('doctor_tab_rx')}
              badge={draft.confirmed ? undefined : '!'}
            />
          )}
          <TabButton
            active={activeTab === 'reports'}
            onClick={() => setActiveTab('reports')}
            label={t('doctor_tab_reports')}
            badge={reports.length > 0 ? reports.length : undefined}
          />
          <TabButton
            active={activeTab === 'actions'}
            onClick={() => setActiveTab('actions')}
            label={t('doctor_tab_actions')}
          />
          <TabButton
            active={activeTab === 'gaps'}
            onClick={() => setActiveTab('gaps')}
            label={t('doctor_tab_gaps')}
            badge={gaps.filter((g) => g.status === 'open').length || undefined}
          />
        </div>

        {activeTab === 'overview' && <OverviewTab summary={summary} followUps={followUps} />}
        {activeTab === 'rx' && draft && (
          <PrescriptionReview
            draft={draft}
            patientAllergies={summary.patient.allergies}
            patientCurrentMeds={summary.patient.currentMeds}
            onConfirm={onConfirmCarePlan}
          />
        )}
        {activeTab === 'reports' && <ReportSummaryView reports={reports} />}
        {activeTab === 'actions' && (
          <ClosedLoopCareView
            patientId={summary.patient.id}
            patientName={summary.patient.name}
            careGaps={gaps}
          />
        )}
        {activeTab === 'gaps' && (
          <div className="flex flex-col gap-3">
            {gaps.length === 0 ? (
              <div className="rounded-xl border border-navy-600 bg-navy-800/40 p-6 text-center text-slate-400 text-sm">
                No care gaps identified for this patient.
              </div>
            ) : (
              gaps.map((gap) => (
                <CareGapCard
                  key={gap.id}
                  gap={gap}
                  onReview={() => onCareGapAction(gap.id, 'reviewed')}
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

function TabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string | number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
        active
          ? 'text-teal-400 border-teal-400 bg-navy-800/30'
          : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-navy-600'
      )}
    >
      <span>{label}</span>
      {badge && (
        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-danger-500 text-white text-[10px] font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

function OverviewTab({ summary, followUps }: { summary: PatientSummary; followUps: FollowUp[] }) {
  const { t } = useLanguage();
  const {
    patient,
    dosesToday,
    adherence7Day,
    latestUpdate,
    triageScore,
    criticalSafetyOverride,
    criticalAlertMessage,
    scoreFactors,
  } = summary;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
      {/* Critical Safety Override banner */}
      {criticalSafetyOverride && (
        <div className="lg:col-span-2 rounded-2xl border border-danger-500 bg-danger-500/15 p-5 flex items-start gap-3 shadow-[0_0_24px_rgba(239,68,68,0.2)]">
          <AlertTriangle className="w-5 h-5 text-danger-400 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-danger-200 uppercase tracking-wide">
              Critical Safety Override (Emergency Pathway Active)
            </span>
            <p className="text-sm text-danger-300">
              {criticalAlertMessage ||
                'Patient reported urgent emergency symptoms. Direct physician review required regardless of mathematical triage score.'}
            </p>
          </div>
        </div>
      )}

      {/* Patient info */}
      <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-5 flex flex-col gap-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Patient Demographics
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Name" value={patient.name} />
          <InfoRow label="Age" value={`${patient.age} yrs`} />
          <InfoRow label="Gender" value={patient.gender} />
          <InfoRow label="Phone" value={patient.phone} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Known Allergies</span>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-danger-400" />
            <span className="text-sm font-medium text-white">{patient.allergies || 'None reported'}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Reported Symptoms</span>
          <div className="flex items-start gap-2">
            <Activity className="w-4 h-4 text-amber-400 mt-0.5" />
            <span className="text-sm text-white">{patient.symptoms || 'None reported'}</span>
          </div>
        </div>

        {/* ABHA Integration & Verification Display */}
        <div className="border-t border-navy-600/50 pt-3 flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">
            Ayushman Bharat Health Account (ABHA)
          </span>
          {patient.abhaNumber || patient.abhaAddress ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-3">
                {patient.abhaNumber && (
                  <InfoRow label="ABHA Number" value={patient.abhaNumber} />
                )}
                {patient.abhaAddress && (
                  <InfoRow label="ABHA Address" value={patient.abhaAddress} />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[11px] font-bold border',
                    patient.abhaVerificationStatus === 'verified'
                      ? 'bg-success-500/20 text-success-300 border-success-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  )}
                >
                  {patient.abhaVerificationStatus === 'verified'
                    ? 'ABHA Verified'
                    : 'ABHA Unverified'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {patient.abhaVerificationStatus === 'verified'
                    ? 'Official ABDM Verification Confirmed'
                    : 'Official ABDM verification not configured'}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-500 italic">Not provided</span>
          )}
        </div>
      </div>

      {/* Adherence stats & Triage Score */}
      <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Recovery & Triage Analysis
          </h3>
          {typeof triageScore === 'number' && (
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-extrabold border',
                criticalSafetyOverride || triageScore >= 80
                  ? 'bg-danger-500/20 text-danger-300 border-danger-500/40'
                  : triageScore >= 50
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-teal-500/20 text-teal-300 border-teal-500/40'
              )}
            >
              {criticalSafetyOverride
                ? `Triage: ${triageScore}/100 (Emergency Override)`
                : `Triage: ${triageScore}/100`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            icon={<Pill className="w-4 h-4" />}
            label={t('doctor_doses_today')}
            value={`${dosesToday.taken}/${dosesToday.total} (${dosesToday.missed} missed)`}
            color="teal"
          />
          <StatBox
            icon={<TrendingUp className="w-4 h-4" />}
            label={t('doctor_adherence')}
            value={`${adherence7Day}%`}
            color={adherence7Day >= 80 ? 'success' : 'amber'}
          />
          <StatBox
            icon={<AlertTriangle className="w-4 h-4" />}
            label={t('doctor_open_gaps')}
            value={String(summary.openGaps)}
            color={summary.openGaps > 0 ? 'danger' : 'success'}
          />
          <StatBox
            icon={<Clock className="w-4 h-4" />}
            label={t('doctor_last_update')}
            value={formatTimeAgo(summary.lastUpdateAt)}
            color="navy"
          />
        </div>

        {scoreFactors && scoreFactors.length > 0 ? (
          <div className="border-t border-navy-600/50 pt-3 flex flex-col gap-2">
            <span className="text-[11px] font-bold text-amber-400 uppercase">
              Triage Contributing Factors
            </span>
            <div className="flex flex-col gap-1.5">
              {scoreFactors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 flex-shrink-0">
                    +{f.points}
                  </span>
                  <div>
                    <span>{f.reason}</span>
                    {f.evidence && (
                      <span className="text-slate-400 block text-[11px] italic">
                        Evidence: {f.evidence}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border-t border-navy-600/50 pt-3 flex items-center gap-2 text-xs text-teal-300 bg-teal-500/10 border border-teal-500/20 rounded-lg p-2.5">
            <Check className="w-4 h-4 flex-shrink-0 text-teal-400" />
            <span>Care regimen fully on track: No missed doses or clinical gaps.</span>
          </div>
        )}
      </div>

      {/* Latest health update */}
      {latestUpdate && (
        <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-5 lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            {t('doctor_detail_timeline')}
          </h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3 rounded-xl bg-navy-900/60 p-4 border border-navy-600/40">
              <div
                className={cn(
                  'flex w-8 h-8 items-center justify-center rounded-full flex-shrink-0 text-sm',
                  latestUpdate.state === 'good'
                    ? 'bg-success-500/20'
                    : latestUpdate.state === 'ok'
                    ? 'bg-amber-500/20'
                    : 'bg-danger-500/20'
                )}
              >
                <span>
                  {latestUpdate.state === 'good' ? '😊' : latestUpdate.state === 'ok' ? '😐' : '😟'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400">
                  {t('doctor_patient_reported')}
                </span>
                <p className="text-sm font-medium text-white">"{latestUpdate.symptomDescription}"</p>
                <span className="text-[11px] text-slate-400">
                  {formatTimeAgo(latestUpdate.submittedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up history */}
      {followUps.length > 0 && (
        <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-5 lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            {t('doctor_detail_followups')}
          </h3>
          <div className="flex flex-col gap-2">
            {followUps.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-3 rounded-xl bg-navy-900/60 p-3.5 border border-navy-600/40"
              >
                <div className="flex w-8 h-8 items-center justify-center rounded-full bg-teal-500/10 flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-teal-400" />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <p className="text-sm font-medium text-white">{f.question}</p>
                  {f.answer ? (
                    <p className="text-sm text-teal-300 font-medium">→ {f.answer}</p>
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
      <span className="text-[10px] font-semibold text-slate-400 uppercase">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'teal' | 'success' | 'amber' | 'danger' | 'navy';
}) {
  const colorMap = {
    teal: 'text-teal-400 bg-teal-500/10',
    success: 'text-success-400 bg-success-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    danger: 'text-danger-400 bg-danger-500/10',
    navy: 'text-slate-200 bg-navy-700/40',
  };

  return (
    <div className="rounded-xl bg-navy-900/60 border border-navy-600/40 p-3.5 flex flex-col gap-1.5">
      <div className={cn('flex w-8 h-8 items-center justify-center rounded-lg', colorMap[color])}>
        {icon}
      </div>
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-base font-bold text-white">{value}</span>
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
