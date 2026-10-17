import { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  User,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
  RefreshCw,
  Cpu,
  ShieldCheck,
  History,
  GitCompare,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { dataService } from '@/services/dataService';
import { ReportComparisonView } from './ReportComparisonView';
import { LabTrendView } from './LabTrendView';
import type { MedicalReport, ReportSummary, SummaryEngineMode } from '@/types';

interface ReportSummaryViewProps {
  reports: MedicalReport[];
  className?: string;
}

export function ReportSummaryView({ reports, className }: ReportSummaryViewProps) {
  const [workflowMode, setWorkflowMode] = useState<'summary' | 'history' | 'compare' | 'trends'>('summary');
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id ?? '');
  const [selectedEngine, setSelectedEngine] = useState<'ai_assisted' | 'rule_based_mvp'>('ai_assisted');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const activeReport = useMemo(() => {
    return reports.find((r) => r.id === selectedReportId) ?? reports[0];
  }, [reports, selectedReportId]);

  useEffect(() => {
    let mounted = true;
    if (!activeReport) {
      setSummary(null);
      return;
    }

    async function loadSummary() {
      setLoading(true);
      try {
        const res = await dataService.getReportSummary(activeReport.id, activeReport.patientId, {
          preferAI: selectedEngine === 'ai_assisted',
        });
        if (mounted) {
          setSummary(res);
        }
      } catch (err) {
        console.warn('Failed to load summary:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      mounted = false;
    };
  }, [activeReport, selectedEngine, retryCount]);

  if (!activeReport || reports.length === 0) {
    return (
      <div className="rounded-2xl border border-navy-600 bg-navy-700/30 p-8 text-center text-navy-400">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-40 text-teal-400" />
        <p className="text-base font-semibold text-white">No Diagnostic Reports On File</p>
        <p className="text-sm text-navy-400 mt-1">
          No laboratory or diagnostic pathology reports have been registered for this patient profile.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* Workflow Navigation Bar: Summary | History | Compare | Trends */}
      <div className="flex items-center gap-2 border-b border-navy-600/70 pb-3 overflow-x-auto">
        <button
          onClick={() => setWorkflowMode('summary')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
            workflowMode === 'summary'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
              : 'text-navy-300 hover:text-white hover:bg-navy-800/60 border border-transparent'
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Report Summary</span>
        </button>

        <button
          onClick={() => setWorkflowMode('history')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
            workflowMode === 'history'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
              : 'text-navy-300 hover:text-white hover:bg-navy-800/60 border border-transparent'
          )}
        >
          <History className="w-3.5 h-3.5" />
          <span>Report History</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-navy-700 border border-navy-600 font-mono text-navy-200">
            {reports.length}
          </span>
        </button>

        <button
          onClick={() => setWorkflowMode('compare')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
            workflowMode === 'compare'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
              : 'text-navy-300 hover:text-white hover:bg-navy-800/60 border border-transparent'
          )}
        >
          <GitCompare className="w-3.5 h-3.5" />
          <span>Compare Reports</span>
          {reports.length >= 2 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 border border-purple-500/30 font-semibold text-purple-200">
              {reports.length} available
            </span>
          )}
        </button>

        <button
          onClick={() => setWorkflowMode('trends')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
            workflowMode === 'trends'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
              : 'text-navy-300 hover:text-white hover:bg-navy-800/60 border border-transparent'
          )}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Lab Trends</span>
        </button>
      </div>

      {/* 1. REPORT HISTORY WORKFLOW */}
      {workflowMode === 'history' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Patient Diagnostic Report History
              </h3>
              <p className="text-xs text-navy-300">
                Chronological pathology and laboratory reports registered on this patient profile ({reports.length} total)
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {[...reports]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((rep) => {
                const abnormalCount =
                  rep.structuredFindings?.filter((f) => f.isAbnormal === true).length ?? 0;
                const findingsCount = rep.structuredFindings?.length ?? 0;
                const isSelected = rep.id === selectedReportId;

                return (
                  <div
                    key={rep.id}
                    className={cn(
                      'rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all',
                      isSelected
                        ? 'border-teal-400 bg-navy-700/80 shadow-md'
                        : 'border-navy-600 bg-navy-800/60 hover:bg-navy-700/50'
                    )}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex w-10 h-10 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex-shrink-0 mt-0.5">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white">{rep.title}</h4>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-navy-700 text-teal-300 border border-navy-600">
                            {rep.reportType}
                          </span>
                          {abnormalCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-danger-500/20 text-danger-300 border border-danger-500/30">
                              {abnormalCount} Abnormal Result(s)
                            </span>
                          )}
                          <span className="text-[10px] text-navy-400">
                            ({findingsCount} discrete finding{findingsCount === 1 ? '' : 's'})
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-navy-300 flex-wrap">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-navy-400" />
                            Date: {rep.date}
                          </span>
                          {rep.facilityOrLab && (
                            <span className="flex items-center gap-1 text-navy-400">
                              <Building className="w-3.5 h-3.5" />
                              {rep.facilityOrLab}
                            </span>
                          )}
                          {rep.orderingDoctor && (
                            <span className="flex items-center gap-1 text-navy-400">
                              <User className="w-3.5 h-3.5" />
                              Ordering: {rep.orderingDoctor}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                      <button
                        onClick={() => {
                          setSelectedReportId(rep.id);
                          setWorkflowMode('summary');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-500/40 bg-teal-500/15 text-xs font-bold text-teal-300 hover:bg-teal-500/25 transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Summary</span>
                      </button>

                      {reports.length >= 2 && (
                        <button
                          onClick={() => {
                            setSelectedReportId(rep.id);
                            setWorkflowMode('compare');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-navy-600 bg-navy-700 text-xs font-semibold text-navy-200 hover:text-white hover:bg-navy-600 transition-all"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                          <span>Compare</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 2. REPORT COMPARISON WORKFLOW */}
      {workflowMode === 'compare' && (
        <ReportComparisonView
          reports={reports}
          initialReportAId={selectedReportId}
          onOpenReportSummary={(id) => {
            setSelectedReportId(id);
            setWorkflowMode('summary');
          }}
        />
      )}

      {/* 3. LAB TRENDS WORKFLOW */}
      {workflowMode === 'trends' && <LabTrendView reports={reports} />}

      {/* 4. CURRENT SUMMARY WORKFLOW */}
      {workflowMode === 'summary' && (
        <>
          {/* Top Header: Report Switcher & Engine Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-600/60 pb-3">
            {/* Report Selection Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-semibold text-navy-300 uppercase mr-1">Report:</span>
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap',
                    selectedReportId === r.id
                      ? 'border-teal-400 bg-teal-500/20 text-teal-300 shadow-sm'
                      : 'border-navy-600 bg-navy-800/40 text-navy-300 hover:bg-navy-700 hover:text-white'
                  )}
                >
                  {r.title}
                </button>
              ))}
            </div>

            {/* Engine Toggle (AI vs Rule-Based) */}
            <div className="flex items-center gap-1.5 rounded-lg bg-navy-900/80 border border-navy-700 p-1 self-start sm:self-auto">
              <button
                onClick={() => setSelectedEngine('ai_assisted')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                  selectedEngine === 'ai_assisted'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-navy-300 hover:text-white'
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI-Assisted Summary</span>
              </button>
              <button
                onClick={() => setSelectedEngine('rule_based_mvp')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                  selectedEngine === 'rule_based_mvp'
                    ? 'bg-navy-700 text-teal-300 border border-navy-600 shadow-sm'
                    : 'text-navy-300 hover:text-white'
                )}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Rule-Based MVP</span>
              </button>
            </div>
          </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="rounded-2xl border border-navy-600 bg-navy-800/80 p-8 flex flex-col items-center justify-center gap-3 animate-pulse">
          <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
          <p className="text-sm font-semibold text-white">
            {selectedEngine === 'ai_assisted'
              ? 'Invoking Secure Server-Side AI...'
              : 'Running Deterministic Clinical Parser...'}
          </p>
          <p className="text-xs text-navy-400">
            Validating ground truth against source document and enforcing literal value preservation...
          </p>
        </div>
      )}

      {/* Render Summary Content once loaded */}
      {!loading && summary && (
        <>
          {/* AI Unavailable Fallback Banner (if applicable) */}
          {summary.engineMode === 'ai_unavailable_fallback' && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    AI Service Unavailable — Displaying Verified Deterministic Fallback
                  </span>
                  <p className="text-xs text-navy-200">
                    {summary.aiMetadata?.failureReason ||
                      'Server-side AI model endpoint was unreachable. Clinical summary fell back safely to deterministic rule-based parsing with zero data loss.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-colors whitespace-nowrap self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry AI</span>
              </button>
            </div>
          )}

          {/* 1. Report Overview Card */}
          <div className="rounded-2xl border border-navy-600 bg-navy-700/50 p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-600/60 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex w-10 h-10 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{summary.reportOverview.title}</h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-navy-600 text-teal-300 border border-navy-500">
                      {summary.reportOverview.reportType}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-navy-300 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-navy-400" />
                      Date: {summary.reportOverview.date}
                    </span>
                    {summary.reportOverview.facility && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-navy-400" />
                        {summary.reportOverview.facility}
                      </span>
                    )}
                    {summary.reportOverview.orderingDoctor && (
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-navy-400" />
                        Ordering: {summary.reportOverview.orderingDoctor}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Engine Badge & Source Integrity Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Engine Mode Badge */}
                {summary.engineMode === 'ai_assisted' ? (
                  <span className="text-[10px] px-2.5 py-1 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-200 font-bold flex items-center gap-1.5 shadow-sm">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    AI-Assisted ({summary.aiMetadata?.modelName || 'AI Model'}{summary.aiMetadata?.latencyMs ? ` · ${summary.aiMetadata.latencyMs}ms` : ''})
                  </span>
                ) : summary.engineMode === 'ai_unavailable_fallback' ? (
                  <span className="text-[10px] px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Rule-Based Fallback
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-1 rounded-md bg-teal-500/10 border border-teal-500/30 text-teal-300 font-semibold flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    Rule-Based Extraction MVP
                  </span>
                )}

                {/* Grounding Badge if AI */}
                {summary.engineMode === 'ai_assisted' && summary.aiMetadata?.verifiedGrounded && (
                  <span className="text-[10px] px-2 py-1 rounded bg-teal-500/10 border border-teal-500/30 text-teal-300 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-teal-400" />
                    Verified Grounded
                  </span>
                )}

                {/* Source Integrity Badge */}
                {summary.reportOverview.sourceIntegrity === 'complete' ? (
                  <span className="text-[10px] px-2 py-1 rounded bg-success-500/10 border border-success-500/30 text-success-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Source Complete
                  </span>
                ) : summary.reportOverview.sourceIntegrity === 'unreadable' ? (
                  <span className="text-[10px] px-2 py-1 rounded bg-danger-500/10 border border-danger-500/30 text-danger-300 font-semibold flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    Contains Unreadable Sections
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Incomplete Source
                  </span>
                )}
              </div>
            </div>

            {/* 2. Abnormal Values / Flagged Findings (Prioritized at Top) */}
            {summary.abnormalValues.length > 0 && (
              <div className="rounded-xl border border-danger-500/50 bg-danger-500/10 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-danger-400 animate-pulse" />
                  <h4 className="text-sm font-bold text-danger-300 uppercase tracking-wide">
                    Abnormal / Flagged Values ({summary.abnormalValues.length})
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {summary.abnormalValues.map((ab, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-navy-800/90 border border-danger-500/30 p-3 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{ab.name}</span>
                        <span className="text-xs font-extrabold text-danger-400 bg-danger-500/20 px-2 py-0.5 rounded">
                          {ab.value} {ab.unit || ''}
                        </span>
                      </div>
                      <div className="text-xs text-navy-300 flex items-center gap-2">
                        <span className="font-semibold text-navy-400">Reference:</span>
                        <span>{ab.referenceRange}</span>
                      </div>
                      <p className="text-xs text-danger-300/90 italic">{ab.interpretation}</p>
                      <div className="text-[10px] text-navy-400 bg-navy-900/60 p-1.5 rounded border border-navy-700/60 truncate">
                        Evidence: {ab.sourceEvidence}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Key Findings (Tabular Discrete Observations) */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-bold text-navy-200 uppercase tracking-wider">
                Key Findings ({summary.keyFindings.length})
              </h4>
              <div className="overflow-x-auto rounded-xl border border-navy-600/70">
                <table className="w-full text-left text-xs">
                  <thead className="bg-navy-800/80 text-navy-300 uppercase font-semibold border-b border-navy-600/70">
                    <tr>
                      <th className="py-2.5 px-3">Test / Parameter</th>
                      <th className="py-2.5 px-3">Observed Value</th>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3">Reference Interval</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/60 text-navy-100">
                    {summary.keyFindings.map((f, idx) => (
                      <tr key={idx} className="hover:bg-navy-700/30 transition-colors">
                        <td className="py-2 px-3 font-semibold text-white">{f.name}</td>
                        <td className="py-2 px-3 font-mono font-bold text-teal-300">{f.value}</td>
                        <td className="py-2 px-3 text-navy-300">{f.unit || '—'}</td>
                        <td className="py-2 px-3 text-navy-300">{f.referenceRange || 'Not provided'}</td>
                        <td className="py-2 px-3">
                          {f.flag === 'abnormal' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-danger-500/20 text-danger-300 border border-danger-500/30">
                              Abnormal
                            </span>
                          ) : f.flag === 'unspecified_range' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Unspecified Range
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-teal-500/10 text-teal-300 border border-teal-500/20">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Missing or Uncertain Information & 5. Needs Clinician Review */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Missing Info */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <Info className="w-4 h-4" />
                  Missing or Uncertain Information ({summary.missingOrUncertainInfo.length})
                </div>
                {summary.missingOrUncertainInfo.length === 0 ? (
                  <p className="text-xs text-navy-400">All standard report parameters present.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-xs">
                    {summary.missingOrUncertainInfo.map((m, idx) => (
                      <li key={idx} className="flex flex-col gap-0.5">
                        <span className="font-semibold text-amber-200">• {m.item}</span>
                        <span className="text-navy-300 text-[11px] pl-3">{m.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Needs Clinician Review */}
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-purple-400" />
                  Needs Clinician Review ({summary.needsClinicianReview.length})
                </div>
                <ul className="flex flex-col gap-2 text-xs">
                  {summary.needsClinicianReview.map((rev, idx) => (
                    <li key={idx} className="flex flex-col gap-0.5">
                      <span className="font-semibold text-purple-200">⚠ {rev.questionOrFinding}</span>
                      <span className="text-navy-300 text-[11px] pl-4">{rev.context}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Clinical Safety Disclaimer Banner */}
            <div className="rounded-xl border border-navy-600 bg-navy-800/80 p-3.5 flex items-start gap-3 mt-2">
              <ShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Clinical Safety & Review Protocol
                </span>
                <p className="text-xs text-navy-300 leading-relaxed">{summary.disclaimer}</p>
              </div>
            </div>

            {/* Raw Document Text Toggle */}
            <div className="pt-2 border-t border-navy-700/60">
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="flex items-center gap-2 text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
              >
                {showRawText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>{showRawText ? 'Hide' : 'Inspect'} Raw Source Document Text</span>
              </button>

              {showRawText && (
                <div className="mt-3 rounded-xl bg-navy-900 border border-navy-700 p-4">
                  <pre className="text-xs font-mono text-navy-200 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                    {activeReport.rawText || 'No narrative text recorded on file.'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )}
</div>
  );
}
