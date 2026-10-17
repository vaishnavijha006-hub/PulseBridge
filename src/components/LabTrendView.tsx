/**
 * PulseBridge AI — Lab Trend Visualization Component
 * 
 * Clinical Safety Standards:
 * 1. Trend analysis strictly requires at least 3 dated observations with identical units.
 * 2. Never interpolates missing points or infers clinical diagnoses from trajectories.
 * 3. Clearly labels dates, observed values, units, and source reference intervals.
 */

import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Clock,
  Calendar,
  Layers,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { extractLabTrends } from '@/utils/reportComparison';
import type { MedicalReport, LabTrendSeries } from '@/types';

interface LabTrendViewProps {
  reports: MedicalReport[];
  className?: string;
}

export function LabTrendView({ reports, className }: LabTrendViewProps) {
  const trends = useMemo(() => extractLabTrends(reports), [reports]);

  // Default to first series with sufficient data, or first available series
  const defaultSeriesKey = useMemo(() => {
    const sufficient = trends.find((t) => t.hasSufficientData);
    if (sufficient) return `${sufficient.testName}__${sufficient.unit}`;
    return trends[0] ? `${trends[0].testName}__${trends[0].unit}` : '';
  }, [trends]);

  const [selectedKey, setSelectedKey] = useState<string>(defaultSeriesKey);

  const activeSeries: LabTrendSeries | undefined = useMemo(() => {
    return (
      trends.find((t) => `${t.testName}__${t.unit}` === selectedKey) ??
      trends.find((t) => t.hasSufficientData) ??
      trends[0]
    );
  }, [trends, selectedKey]);

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-navy-600 bg-navy-700/30 p-8 text-center text-navy-400">
        <Clock className="w-10 h-10 mx-auto mb-3 opacity-40 text-teal-400" />
        <p className="text-base font-semibold text-white">No Diagnostic Reports On File</p>
        <p className="text-sm text-navy-400 mt-1">
          Historical trend analysis requires diagnostic laboratory reports recorded over time.
        </p>
      </div>
    );
  }

  if (trends.length === 0) {
    return (
      <div className="rounded-2xl border border-navy-600 bg-navy-700/30 p-8 text-center text-navy-400">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40 text-amber-400" />
        <p className="text-base font-semibold text-white">No Structured Lab Findings Available</p>
        <p className="text-sm text-navy-400 mt-1">
          The reports on file do not contain discrete laboratory analytes suitable for trend tracking.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Top Test Selector Tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-navy-300 uppercase tracking-wider">
            Select Lab Parameter for Longitudinal Analysis:
          </span>
          <span className="text-xs text-navy-400 font-medium">
            {trends.filter((t) => t.hasSufficientData).length} of {trends.length} parameter(s) have sufficient data (3+ dates)
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1">
          {trends.map((t) => {
            const key = `${t.testName}__${t.unit}`;
            const isSelected = activeSeries?.testName === t.testName && activeSeries?.unit === t.unit;
            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap flex items-center gap-2',
                  isSelected
                    ? 'border-teal-400 bg-teal-500/20 text-teal-300 shadow-sm'
                    : 'border-navy-600 bg-navy-800/60 text-navy-300 hover:bg-navy-700 hover:text-white'
                )}
              >
                <span>{t.testName}</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-semibold',
                    t.hasSufficientData
                      ? 'bg-teal-500/30 text-teal-200'
                      : 'bg-navy-700 text-navy-400 border border-navy-600'
                  )}
                >
                  {t.dataPoints.length} pts
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Series Presentation */}
      {activeSeries && (
        <div className="flex flex-col gap-5">
          {/* Header Card with Test Name & High-Level Summary */}
          <div className="rounded-2xl border border-navy-600 bg-navy-700/50 p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-600/60 pb-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-white">{activeSeries.testName}</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-md bg-navy-800 border border-navy-600 text-teal-300 font-mono font-bold">
                    Unit: {activeSeries.unit}
                  </span>
                </div>
                <p className="text-xs text-navy-300 mt-1">
                  Longitudinal history across {activeSeries.dataPoints.length} recorded diagnostic report(s)
                </p>
              </div>

              {activeSeries.hasSufficientData && activeSeries.summary && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm',
                      activeSeries.summary.direction === 'increased'
                        ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                        : activeSeries.summary.direction === 'decreased'
                        ? 'border-teal-500/30 bg-teal-500/15 text-teal-300'
                        : 'border-navy-500 bg-navy-800 text-navy-200'
                    )}
                  >
                    {activeSeries.summary.direction === 'increased' ? (
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                    ) : activeSeries.summary.direction === 'decreased' ? (
                      <TrendingDown className="w-4 h-4 text-teal-400" />
                    ) : (
                      <Minus className="w-4 h-4 text-navy-400" />
                    )}
                    <span>
                      {activeSeries.summary.delta > 0 ? `+${activeSeries.summary.delta}` : activeSeries.summary.delta} {activeSeries.unit}
                    </span>
                    <span className="text-[10px] text-navy-300 font-normal">overall delta</span>
                  </div>
                </div>
              )}
            </div>

            {/* Stat Cards (When 3+ points available) */}
            {activeSeries.hasSufficientData && activeSeries.summary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-navy-800/80 border border-navy-600/70 p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-navy-400 uppercase">Earliest Baseline</span>
                  <span className="text-base font-extrabold text-white font-mono">
                    {activeSeries.summary.earliest} <span className="text-xs font-normal text-navy-400">{activeSeries.unit}</span>
                  </span>
                  <span className="text-[10px] text-navy-400">{activeSeries.dataPoints[0]?.date}</span>
                </div>

                <div className="rounded-xl bg-navy-800/80 border border-navy-600/70 p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-navy-400 uppercase">Most Recent</span>
                  <span className="text-base font-extrabold text-teal-300 font-mono">
                    {activeSeries.summary.latest} <span className="text-xs font-normal text-navy-400">{activeSeries.unit}</span>
                  </span>
                  <span className="text-[10px] text-navy-400">
                    {activeSeries.dataPoints[activeSeries.dataPoints.length - 1]?.date}
                  </span>
                </div>

                <div className="rounded-xl bg-navy-800/80 border border-navy-600/70 p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-navy-400 uppercase">Historical Range</span>
                  <span className="text-base font-extrabold text-white font-mono">
                    {activeSeries.summary.min} – {activeSeries.summary.max}
                  </span>
                  <span className="text-[10px] text-navy-400">Min to Max observed</span>
                </div>

                <div className="rounded-xl bg-navy-800/80 border border-navy-600/70 p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-navy-400 uppercase">Observations</span>
                  <span className="text-base font-extrabold text-purple-300 font-mono">
                    {activeSeries.dataPoints.length}
                  </span>
                  <span className="text-[10px] text-navy-400">Dated clinical reports</span>
                </div>
              </div>
            ) : (
              /* Insufficient Data Notice */
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    Insufficient Historical Data for Trend Graph
                  </span>
                  <p className="text-xs text-navy-200 leading-relaxed">
                    {activeSeries.insufficientDataReason ||
                      'At least 3 dated diagnostic reports with comparable units are required to construct an observational trajectory.'}
                  </p>
                </div>
              </div>
            )}

            {/* SVG Line Chart (Rendered when 3+ points available) */}
            {activeSeries.hasSufficientData && (
              <div className="rounded-xl bg-navy-900/90 border border-navy-700/80 p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-navy-300">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-400" />
                    Observed Values Over Time ({activeSeries.unit})
                  </span>
                  <span className="text-[11px] text-navy-400 italic">No interpolation between dates</span>
                </div>

                <div className="w-full overflow-x-auto">
                  <TrendChartSvg series={activeSeries} />
                </div>
              </div>
            )}

            {/* Observation Data Points Table */}
            <div className="flex flex-col gap-2.5 pt-1">
              <h4 className="text-xs font-bold text-navy-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-400" />
                Dated Historical Observations ({activeSeries.dataPoints.length})
              </h4>

              <div className="overflow-x-auto rounded-xl border border-navy-600/70">
                <table className="w-full text-left text-xs">
                  <thead className="bg-navy-800/80 text-navy-300 uppercase font-semibold border-b border-navy-600/70">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Observed Value</th>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3">Reference Range</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/60 text-navy-100">
                    {activeSeries.dataPoints.map((pt, idx) => (
                      <tr key={idx} className="hover:bg-navy-700/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-navy-400" />
                          {pt.date}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-teal-300">{pt.value}</td>
                        <td className="py-2.5 px-3 text-navy-300">{pt.unit || '—'}</td>
                        <td className="py-2.5 px-3 text-navy-300">{pt.referenceRange || 'Not provided'}</td>
                        <td className="py-2.5 px-3">
                          {pt.isAbnormal === true ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-danger-500/20 text-danger-300 border border-danger-500/30">
                              Abnormal
                            </span>
                          ) : pt.isAbnormal === false ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-teal-500/10 text-teal-300 border border-teal-500/20">
                              Normal
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Unranged
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mandatory Safety Notice */}
            <div className="rounded-xl border border-navy-600 bg-navy-800/80 p-3.5 flex items-start gap-3 mt-1">
              <ShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Clinical Trend Disclaimer
                </span>
                <p className="text-xs text-navy-300 leading-relaxed">
                  Trend graphs display observational lab findings as documented on source reports. They do NOT infer disease trajectory, treatment efficacy, or clinical advice. Diagnostic interpretation requires licensed medical evaluation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Responsive, zero-dependency SVG Line Chart for longitudinal clinical trends.
 */
function TrendChartSvg({ series }: { series: LabTrendSeries }) {
  const points = series.dataPoints.filter((p) => p.numericValue !== null);
  if (points.length < 2) return null;

  const width = 640;
  const height = 220;
  const padding = { top: 25, right: 35, bottom: 40, left: 55 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = points.map((p) => p.numericValue!);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin === 0 ? 10 : rawMax - rawMin;
  const yMin = Math.floor(rawMin - spread * 0.15);
  const yMax = Math.ceil(rawMax + spread * 0.15);
  const yRange = yMax - yMin === 0 ? 1 : yMax - yMin;

  const coords = points.map((p, idx) => {
    const x = padding.left + (idx / (points.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((p.numericValue! - yMin) / yRange) * chartHeight;
    return { x, y, point: p };
  });

  const pathD = coords.reduce((acc, curr, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.y}`;
  }, '');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[260px] select-none">
      {/* Background Grid Lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
        const yVal = yMin + (1 - pct) * yRange;
        const yPos = padding.top + pct * chartHeight;
        return (
          <g key={idx}>
            <line
              x1={padding.left}
              y1={yPos}
              x2={width - padding.right}
              y2={yPos}
              stroke="#334155"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <text x={padding.left - 8} y={yPos + 4} textAnchor="end" className="text-[10px] fill-navy-400 font-mono">
              {Math.round(yVal)}
            </text>
          </g>
        );
      })}

      {/* Area Under Curve */}
      <path
        d={`${pathD} L ${coords[coords.length - 1].x} ${padding.top + chartHeight} L ${coords[0].x} ${padding.top + chartHeight} Z`}
        fill="url(#trendGradient)"
        opacity="0.25"
      />

      {/* Main Trend Line */}
      <path d={pathD} fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data Points with tooltips */}
      {coords.map((c, idx) => (
        <g key={idx}>
          {/* Outer Ring */}
          <circle cx={c.x} cy={c.y} r="5" fill="#0f172a" stroke="#2dd4bf" strokeWidth="2" />
          {/* Inner Dot */}
          <circle cx={c.x} cy={c.y} r="2.5" fill={c.point.isAbnormal ? '#f87171' : '#2dd4bf'} />

          {/* Value Label above dot */}
          <text
            x={c.x}
            y={c.y - 10}
            textAnchor="middle"
            className="text-[11px] font-bold font-mono fill-white"
          >
            {c.point.value}
          </text>

          {/* X-Axis Date Label */}
          <text
            x={c.x}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            className="text-[10px] fill-navy-300 font-medium"
          >
            {c.point.date}
          </text>
        </g>
      ))}

      {/* Gradient Definition */}
      <defs>
        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
