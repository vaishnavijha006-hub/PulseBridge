/**
 * PulseBridge AI — Medical Report Comparison View
 * 
 * Safety & Clinical Grounding Standards:
 * 1. Strict Patient Isolation: Compares only reports belonging to the exact same authorized patient.
 * 2. Strict Unit Comparability: Only computes mathematical differences when units match identically.
 * 3. Exact Value Preservation: Non-numeric and unreadable values are labeled "Unavailable", never imputed.
 * 4. Descriptive Only: Mathematical differences are review aids and do NOT infer clinical diagnosis or treatment guidance.
 */

import { useState, useMemo } from 'react';
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Calendar,
  Building,
  User,
  ShieldCheck,
  FileText,
  AlertCircle,
  ArrowRightLeft,
  Filter,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { compareReports } from '@/utils/reportComparison';
import type { MedicalReport, ReportComparisonResult } from '@/types';

interface ReportComparisonViewProps {
  reports: MedicalReport[];
  initialReportAId?: string;
  initialReportBId?: string;
  className?: string;
  onOpenReportSummary?: (reportId: string) => void;
}

export function ReportComparisonView({
  reports,
  initialReportAId,
  initialReportBId,
  className,
  onOpenReportSummary,
}: ReportComparisonViewProps) {
  // Sort reports chronologically descending (newest first for selector)
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reports]);

  // Report selection state
  const [reportAId, setReportAId] = useState<string>(() => {
    if (initialReportAId && reports.some((r) => r.id === initialReportAId)) return initialReportAId;
    return sortedReports[0]?.id ?? '';
  });

  const [reportBId, setReportBId] = useState<string>(() => {
    if (initialReportBId && reports.some((r) => r.id === initialReportBId)) return initialReportBId;
    // Default report B to the second most recent report if available
    return sortedReports[1]?.id ?? (sortedReports[0]?.id ?? '');
  });

  const [filterMode, setFilterMode] = useState<'all' | 'comparable' | 'incomparable' | 'abnormal'>('all');
  const [customOrder, setCustomOrder] = useState<boolean>(false);

  const reportA = useMemo(() => reports.find((r) => r.id === reportAId), [reports, reportAId]);
  const reportB = useMemo(() => reports.find((r) => r.id === reportBId), [reports, reportBId]);

  // Execute comparison if two distinct reports are selected
  const comparisonResult: ReportComparisonResult | null = useMemo(() => {
    if (!reportA || !reportB || reportA.id === reportB.id) return null;
    try {
      return compareReports(reportA, reportB, { chronological: !customOrder });
    } catch (err) {
      console.warn('Comparison error:', err);
      return null;
    }
  }, [reportA, reportB, customOrder]);

  // Swap Report A and Report B
  const handleSwap = () => {
    const temp = reportAId;
    setReportAId(reportBId);
    setReportBId(temp);
    setCustomOrder((prev) => !prev);
  };

  if (reports.length < 2) {
    return (
      <div className="rounded-2xl border border-navy-600 bg-navy-700/30 p-8 text-center text-navy-400">
        <GitCompare className="w-10 h-10 mx-auto mb-3 opacity-40 text-teal-400" />
        <p className="text-base font-semibold text-white">Report Comparison Unavailable</p>
        <p className="text-sm text-navy-400 mt-1 max-w-md mx-auto">
          Side-by-side comparison requires at least 2 diagnostic reports belonging to this authorized patient profile. Currently, only {reports.length} report is on file.
        </p>
      </div>
    );
  }

  const filteredFindings = useMemo(() => {
    if (!comparisonResult) return [];
    return comparisonResult.findings.filter((f) => {
      if (filterMode === 'comparable') return f.comparable;
      if (filterMode === 'incomparable') return !f.comparable;
      if (filterMode === 'abnormal') {
        return f.baseline.isAbnormal === true || f.current.isAbnormal === true;
      }
      return true;
    });
  }, [comparisonResult, filterMode]);

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Selector Control Bar */}
      <div className="rounded-2xl border border-navy-600 bg-navy-800/80 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-navy-300 uppercase tracking-wider flex items-center gap-1.5">
            <GitCompare className="w-4 h-4 text-teal-400" />
            Select Two Reports to Compare:
          </span>
          <button
            onClick={handleSwap}
            disabled={reportAId === reportBId}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-navy-600 bg-navy-700/60 text-xs font-semibold text-navy-200 hover:text-white hover:bg-navy-600 transition-colors disabled:opacity-40"
            title="Swap comparison order"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Swap Order</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Report A Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-navy-400 uppercase">
              First Report (Baseline or Follow-Up):
            </label>
            <select
              value={reportAId}
              onChange={(e) => {
                setReportAId(e.target.value);
                setCustomOrder(false);
              }}
              className="w-full rounded-xl bg-navy-900 border border-navy-600 px-3.5 py-2.5 text-xs text-white font-medium focus:border-teal-400 focus:outline-none"
            >
              {sortedReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.date} — {r.title} ({r.reportType})
                </option>
              ))}
            </select>
          </div>

          {/* Report B Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-navy-400 uppercase">
              Second Report (Comparison Target):
            </label>
            <select
              value={reportBId}
              onChange={(e) => {
                setReportBId(e.target.value);
                setCustomOrder(false);
              }}
              className="w-full rounded-xl bg-navy-900 border border-navy-600 px-3.5 py-2.5 text-xs text-white font-medium focus:border-teal-400 focus:outline-none"
            >
              {sortedReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.date} — {r.title} ({r.reportType})
                </option>
              ))}
            </select>
          </div>
        </div>

        {reportAId === reportBId && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Please select two different reports to perform side-by-side comparison.</span>
          </div>
        )}
      </div>

      {/* Comparison Results Card */}
      {comparisonResult && (
        <div className="rounded-2xl border border-navy-600 bg-navy-700/50 p-5 flex flex-col gap-5">
          {/* Side-by-Side Header Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-navy-600/60 pb-5">
            {/* Baseline Card */}
            <div className="rounded-xl bg-navy-800/90 border border-navy-600/80 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-navy-700 text-teal-300 border border-navy-600">
                  Baseline Document (Earlier)
                </span>
                <span className="text-xs text-navy-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {comparisonResult.baselineReport.date}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">{comparisonResult.baselineReport.title}</h4>
              <div className="text-xs text-navy-300 flex items-center justify-between pt-1">
                <span className="capitalize">{comparisonResult.baselineReport.reportType} Report</span>
                {onOpenReportSummary && (
                  <button
                    onClick={() => onOpenReportSummary(comparisonResult.baselineReport.id)}
                    className="text-[11px] font-bold text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    View Summary →
                  </button>
                )}
              </div>
            </div>

            {/* Comparison Target Card */}
            <div className="rounded-xl bg-navy-800/90 border border-navy-600/80 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Comparison Document (Later)
                </span>
                <span className="text-xs text-navy-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {comparisonResult.comparisonReport.date}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">{comparisonResult.comparisonReport.title}</h4>
              <div className="text-xs text-navy-300 flex items-center justify-between pt-1">
                <span className="capitalize">{comparisonResult.comparisonReport.reportType} Report</span>
                {onOpenReportSummary && (
                  <button
                    onClick={() => onOpenReportSummary(comparisonResult.comparisonReport.id)}
                    className="text-[11px] font-bold text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    View Summary →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="text-xs font-bold text-navy-200 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              Side-by-Side Finding Differences ({filteredFindings.length})
            </h4>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setFilterMode('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap',
                  filterMode === 'all'
                    ? 'bg-navy-600 text-white'
                    : 'text-navy-400 hover:text-white hover:bg-navy-800'
                )}
              >
                All Analytes ({comparisonResult.findings.length})
              </button>
              <button
                onClick={() => setFilterMode('comparable')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap',
                  filterMode === 'comparable'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'text-navy-400 hover:text-white hover:bg-navy-800'
                )}
              >
                Comparable ({comparisonResult.findings.filter((f) => f.comparable).length})
              </button>
              <button
                onClick={() => setFilterMode('abnormal')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap',
                  filterMode === 'abnormal'
                    ? 'bg-danger-500/20 text-danger-300 border border-danger-500/40'
                    : 'text-navy-400 hover:text-white hover:bg-navy-800'
                )}
              >
                Abnormal Flags
              </button>
              <button
                onClick={() => setFilterMode('incomparable')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap',
                  filterMode === 'incomparable'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-navy-400 hover:text-white hover:bg-navy-800'
                )}
              >
                Incomparable / Missing
              </button>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto rounded-xl border border-navy-600/70">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-800/80 text-navy-300 uppercase font-semibold border-b border-navy-600/70">
                <tr>
                  <th className="py-2.5 px-3">Test / Analyte</th>
                  <th className="py-2.5 px-3">
                    Baseline ({comparisonResult.baselineReport.date})
                  </th>
                  <th className="py-2.5 px-3">
                    Comparison ({comparisonResult.comparisonReport.date})
                  </th>
                  <th className="py-2.5 px-3">Mathematical Delta</th>
                  <th className="py-2.5 px-3">Reference Interval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/60 text-navy-100">
                {filteredFindings.map((f, idx) => (
                  <tr key={idx} className="hover:bg-navy-700/30 transition-colors">
                    {/* Analyte Name */}
                    <td className="py-3 px-3 font-semibold text-white">
                      <div className="flex flex-col">
                        <span>{f.testName}</span>
                        {f.baseline.unit && (
                          <span className="text-[10px] text-navy-400 font-normal">
                            Unit: {f.baseline.unit}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Baseline Result */}
                    <td className="py-3 px-3">
                      {f.baseline.status === 'present' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-white">{f.baseline.value}</span>
                          <span className="text-[11px] text-navy-400">{f.baseline.unit || ''}</span>
                          {f.baseline.isAbnormal === true && (
                            <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-danger-500/20 text-danger-300 border border-danger-500/30">
                              HIGH
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-navy-400 italic">Unavailable in report</span>
                      )}
                    </td>

                    {/* Comparison Result */}
                    <td className="py-3 px-3">
                      {f.current.status === 'present' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-white">{f.current.value}</span>
                          <span className="text-[11px] text-navy-400">{f.current.unit || ''}</span>
                          {f.current.isAbnormal === true && (
                            <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-danger-500/20 text-danger-300 border border-danger-500/30">
                              HIGH
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-navy-400 italic">Unavailable in report</span>
                      )}
                    </td>

                    {/* Delta / Difference */}
                    <td className="py-3 px-3">
                      {f.comparable && f.delta !== null ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold border',
                              f.direction === 'increased'
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                : f.direction === 'decreased'
                                ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                                : 'bg-navy-800 border-navy-600 text-navy-300'
                            )}
                          >
                            {f.direction === 'increased' ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : f.direction === 'decreased' ? (
                              <TrendingDown className="w-3.5 h-3.5" />
                            ) : (
                              <Minus className="w-3.5 h-3.5" />
                            )}
                            {f.delta > 0 ? `+${f.delta}` : f.delta} {f.current.unit || ''}
                          </span>
                          {f.percentChange !== null && (
                            <span className="text-[10px] text-navy-400 font-mono">
                              ({f.percentChange > 0 ? `+${f.percentChange}` : f.percentChange}%)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span>{f.incomparabilityReason || 'Incomparable'}</span>
                        </span>
                      )}
                    </td>

                    {/* Reference Range */}
                    <td className="py-3 px-3 text-navy-300">
                      {(() => {
                        const baseRange = f.baseline.referenceRange?.trim();
                        const currRange = f.current.referenceRange?.trim();

                        if (!baseRange && !currRange) {
                          return <span className="text-navy-400 italic">Not provided</span>;
                        }
                        if (baseRange && currRange) {
                          if (baseRange.toLowerCase() === currRange.toLowerCase()) {
                            return <span>{baseRange}</span>;
                          }
                          return (
                            <div className="flex flex-col gap-0.5 text-[11px]">
                              <span className="text-navy-300 font-mono">
                                <strong className="text-navy-400">Baseline:</strong> {baseRange}
                              </span>
                              <span className="text-navy-200 font-mono">
                                <strong className="text-navy-400">Comparison:</strong> {currRange}
                              </span>
                              <span className="text-[10px] text-amber-400 italic">
                                Reference intervals differ between source laboratories
                              </span>
                            </div>
                          );
                        }
                        if (baseRange && !currRange) {
                          return (
                            <div className="flex flex-col text-[11px]">
                              <span className="font-mono">{baseRange}</span>
                              <span className="text-[10px] text-navy-400 italic">
                                (Baseline interval; unstated in comparison report)
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-col text-[11px]">
                            <span className="font-mono">{currRange}</span>
                            <span className="text-[10px] text-navy-400 italic">
                              (Comparison interval; unstated in baseline report)
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mandatory Clinical Disclaimer Banner */}
          <div className="rounded-xl border border-navy-600 bg-navy-800/80 p-3.5 flex items-start gap-3 mt-1">
            <ShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Clinical Safety & Review Protocol
              </span>
              <p className="text-xs text-navy-300 leading-relaxed">{comparisonResult.disclaimer}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
