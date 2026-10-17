import { useState, useMemo } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Clock,
  Building,
  User,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/utils/cn';
import { summarizeMedicalReport } from '@/services/reportSummarizer';
import type { MedicalReport } from '@/types';

interface ReportSummaryViewProps {
  reports: MedicalReport[];
  className?: string;
}

export function ReportSummaryView({ reports, className }: ReportSummaryViewProps) {
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id ?? '');
  const [showRawText, setShowRawText] = useState(false);

  const activeReport = useMemo(() => {
    return reports.find((r) => r.id === selectedReportId) ?? reports[0];
  }, [reports, selectedReportId]);

  const summary = useMemo(() => {
    if (!activeReport) return null;
    return summarizeMedicalReport(activeReport);
  }, [activeReport]);

  if (!activeReport || !summary) {
    return (
      <div className="rounded-2xl border border-navy-600 bg-navy-700/30 p-8 text-center text-navy-400">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-base font-semibold text-white">No Diagnostic Reports On File</p>
        <p className="text-sm text-navy-400 mt-1">
          No laboratory or diagnostic pathology reports have been registered for this patient profile.
        </p>
      </div>
    );
  }

  const { reportOverview, keyFindings, abnormalValues, missingOrUncertainInfo, needsClinicianReview, disclaimer } = summary;

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* Report Selection Header (if multiple) */}
      {reports.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-navy-300 uppercase mr-1">Select Report:</span>
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedReportId(r.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap',
                selectedReportId === r.id
                  ? 'border-teal-400 bg-teal-500/20 text-teal-300 shadow-sm'
                  : 'border-navy-600 bg-navy-800/40 text-navy-300 hover:bg-navy-700 hover:text-white'
              )}
            >
              {r.title} ({r.date})
            </button>
          ))}
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
                <h3 className="text-lg font-bold text-white">{reportOverview.title}</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-navy-600 text-teal-300 border border-navy-500">
                  {reportOverview.reportType}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-navy-300 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-navy-400" />
                  Date: {reportOverview.date}
                </span>
                {reportOverview.facility && (
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-navy-400" />
                    {reportOverview.facility}
                  </span>
                )}
                {reportOverview.orderingDoctor && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-navy-400" />
                    Ordering: {reportOverview.orderingDoctor}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Engine & Source Integrity Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-1 rounded bg-teal-500/10 border border-teal-500/30 text-teal-300 font-semibold flex items-center gap-1">
              <Info className="w-3 h-3" />
              Rule-Based Extraction MVP (No External LLM)
            </span>

            {reportOverview.sourceIntegrity === 'complete' ? (
              <span className="text-[10px] px-2 py-1 rounded bg-success-500/10 border border-success-500/30 text-success-300 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Source Complete
              </span>
            ) : reportOverview.sourceIntegrity === 'unreadable' ? (
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
        {abnormalValues.length > 0 && (
          <div className="rounded-xl border border-danger-500/50 bg-danger-500/10 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-danger-400" />
              <h4 className="text-sm font-bold text-danger-200 uppercase tracking-wide">
                Abnormal Findings ({abnormalValues.length})
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {abnormalValues.map((ab, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-navy-800/80 border border-danger-500/30 p-3 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{ab.name}</span>
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-danger-500/20 text-danger-300 border border-danger-500/40">
                      {ab.value} {ab.unit ?? ''}
                    </span>
                  </div>
                  <div className="text-xs text-navy-300 flex items-center gap-1.5 mt-0.5">
                    <span className="text-navy-400">Reference:</span>
                    <span className="font-semibold text-navy-200">{ab.referenceRange}</span>
                  </div>
                  {ab.interpretation && (
                    <span className="text-[11px] text-amber-300/90 italic mt-0.5">
                      Note: {ab.interpretation}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Key Findings Table */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-navy-200 uppercase tracking-wide flex items-center justify-between">
            <span>Key Findings ({keyFindings.length})</span>
            <span className="text-xs font-normal text-navy-400">Preserving exact numeric values & units</span>
          </h4>

          {keyFindings.length === 0 ? (
            <p className="text-xs text-navy-400 italic">No structured test parameters extracted.</p>
          ) : (
            <div className="rounded-xl border border-navy-600 bg-navy-800/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-navy-900/60 text-navy-300 font-semibold border-b border-navy-600/80 uppercase">
                    <tr>
                      <th className="py-2.5 px-3.5">Test / Parameter</th>
                      <th className="py-2.5 px-3">Result Value</th>
                      <th className="py-2.5 px-3">Reference Interval</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/60 text-navy-200">
                    {keyFindings.map((finding, idx) => (
                      <tr
                        key={idx}
                        className={cn(
                          'hover:bg-navy-700/30 transition-colors',
                          finding.flag === 'abnormal' ? 'bg-danger-500/5' : ''
                        )}
                      >
                        <td className="py-2.5 px-3.5 font-medium text-white">{finding.name}</td>
                        <td className="py-2.5 px-3 font-mono font-bold">
                          <span
                            className={cn(
                              finding.flag === 'abnormal'
                                ? 'text-danger-400'
                                : finding.flag === 'unspecified_range'
                                ? 'text-amber-300'
                                : 'text-teal-300'
                            )}
                          >
                            {finding.value}
                          </span>
                          {finding.unit && <span className="text-navy-400 ml-1 font-sans">{finding.unit}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-navy-300">
                          {finding.referenceRange}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {finding.flag === 'abnormal' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-danger-300 bg-danger-500/20 px-2 py-0.5 rounded border border-danger-500/40">
                              <AlertTriangle className="w-3 h-3" />
                              Abnormal
                            </span>
                          ) : finding.flag === 'normal' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-300 bg-success-500/10 px-2 py-0.5 rounded border border-success-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              Normal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                              <HelpCircle className="w-3 h-3" />
                              No Range
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 4. Missing or Uncertain Information */}
        {missingOrUncertainInfo.length > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-300">
              <HelpCircle className="w-4 h-4 flex-shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-wide">
                Missing or Uncertain Information ({missingOrUncertainInfo.length})
              </h4>
            </div>
            <div className="flex flex-col gap-1.5 mt-1">
              {missingOrUncertainInfo.map((info, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-navy-200">
                  <span className="text-amber-400 font-bold">•</span>
                  <div>
                    <span className="font-semibold text-amber-200">{info.item}:</span>{' '}
                    <span className="text-navy-300">{info.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Needs Clinician Review */}
        {needsClinicianReview.length > 0 && (
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-teal-300">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-wide">
                Recommended Clinician Verification ({needsClinicianReview.length})
              </h4>
            </div>
            <div className="flex flex-col gap-2 mt-1">
              {needsClinicianReview.map((rev, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-navy-800/60 border border-navy-600/50 p-2.5 flex items-start gap-2.5 text-xs"
                >
                  <span className="flex w-5 h-5 items-center justify-center rounded-full bg-teal-500/20 text-teal-300 font-bold text-[10px] flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">{rev.questionOrFinding}</span>
                    <span className="text-navy-400 text-[11px] mt-0.5">{rev.context}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Raw Source Text Toggle (Auditing & Transparency) */}
        <div className="border-t border-navy-600/60 pt-3">
          <button
            onClick={() => setShowRawText(!showRawText)}
            className="flex items-center justify-between w-full text-xs font-semibold text-navy-300 hover:text-teal-400 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              {showRawText ? 'Hide Original Source Report Text' : 'View Original Source Report Text'}
            </span>
            {showRawText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showRawText && (
            <div className="mt-3 rounded-xl border border-navy-600 bg-navy-950 p-4 text-[11px] font-mono text-navy-200 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
              {activeReport.rawText || '(No raw text available for this report)'}
            </div>
          )}
        </div>

        {/* 7. Mandatory Clinical Review Disclaimer */}
        <div className="rounded-xl border border-navy-600 bg-navy-900/60 p-3.5 flex items-start gap-2.5 text-navy-400 text-[11px] leading-relaxed">
          <Info className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
          <p>
            <strong className="text-navy-300">CLINICAL SAFETY NOTICE: </strong>
            {disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
