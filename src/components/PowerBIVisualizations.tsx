import React, { useMemo, useState } from 'react';
import {
  Channel,
  ComplaintCategory,
  DashboardFilters,
  ServiceRecord,
} from '../types/analytics';

interface PowerBIVisualizationsProps {
  filteredRecords: ServiceRecord[];
  allRecords: ServiceRecord[];
  filters: DashboardFilters;
  onToggleChannel: (ch: Channel) => void;
  onToggleCategory: (cat: ComplaintCategory) => void;
  onToggleAgent: (agent: string) => void;
}

const MONTH_LABELS: Record<string, string> = {
  '2026-06': 'Jun 2026',
  '2026-07': 'Jul 2026',
  '2026-08': 'Aug 2026',
  '2026-09': 'Sep 2026',
  '2026-10': 'Oct 2026',
  '2026-11': 'Nov 2026',
};

const DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_BUCKETS = [
  { label: '08–10', min: 8, max: 9 },
  { label: '10–12', min: 10, max: 11 },
  { label: '12–14', min: 12, max: 13 },
  { label: '14–16', min: 14, max: 15 },
  { label: '16–18', min: 16, max: 17 },
  { label: '18–20', min: 18, max: 19 },
];

export const PowerBIVisualizations: React.FC<PowerBIVisualizationsProps> = ({
  filteredRecords,
  allRecords,
  filters,
  onToggleChannel,
  onToggleCategory,
  onToggleAgent,
}) => {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [hoveredHeatCell, setHoveredHeatCell] = useState<{
    day: string;
    bucket: string;
    count: number;
    slaRate: number;
  } | null>(null);

  // 1. Monthly Trend Series
  const monthlySeries = useMemo(() => {
    const map = new Map<
      string,
      { count: number; csatSum: number; csatCount: number; fcrCount: number; ahtSum: number }
    >();
    for (const r of filteredRecords) {
      const entry = map.get(r.month) ?? {
        count: 0,
        csatSum: 0,
        csatCount: 0,
        fcrCount: 0,
        ahtSum: 0,
      };
      entry.count += 1;
      if (r.csatScore > 0) {
        entry.csatSum += r.csatScore;
        entry.csatCount += 1;
      }
      if (r.fcr) entry.fcrCount += 1;
      entry.ahtSum += r.ahtSeconds;
      map.set(r.month, entry);
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, d]) => ({
        month,
        label: MONTH_LABELS[month] ?? month,
        count: d.count,
        avgCsat: d.csatCount > 0 ? d.csatSum / d.csatCount : 0,
        fcrPct: d.count > 0 ? (d.fcrCount / d.count) * 100 : 0,
        avgAhtMin: d.count > 0 ? d.ahtSum / d.count / 60 : 0,
      }));
  }, [filteredRecords]);

  // 2. Recurring Complaint Drivers
  const categoryStats = useMemo(() => {
    const categories: ComplaintCategory[] = [
      'Billing Discrepancy',
      'Delivery Delay',
      'Technical Bug',
      'Account Access',
      'Refund Request',
      'Plan Cancellation',
    ];
    return categories
      .map((cat) => {
        const rows = filteredRecords.filter((r) => r.category === cat);
        const validCsat = rows.filter((r) => r.csatScore > 0);
        const avgCsat =
          validCsat.length > 0
            ? validCsat.reduce((s, r) => s + r.csatScore, 0) / validCsat.length
            : 0;
        const fcrPct =
          rows.length > 0 ? (rows.filter((r) => r.fcr).length / rows.length) * 100 : 0;
        const avgAhtMin =
          rows.length > 0
            ? rows.reduce((s, r) => s + r.ahtSeconds, 0) / rows.length / 60
            : 0;
        return {
          category: cat,
          count: rows.length,
          avgCsat,
          fcrPct,
          avgAhtMin,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  // 3. Channel Efficiency Matrix
  const channelStats = useMemo(() => {
    const channels: Channel[] = ['Phone', 'Live Chat', 'Email', 'Web Portal'];
    return channels.map((ch) => {
      const rows = filteredRecords.filter((r) => r.channel === ch);
      const validCsat = rows.filter((r) => r.csatScore > 0);
      const avgCsat =
        validCsat.length > 0
          ? validCsat.reduce((s, r) => s + r.csatScore, 0) / validCsat.length
          : 0;
      const fcrPct =
        rows.length > 0 ? (rows.filter((r) => r.fcr).length / rows.length) * 100 : 0;
      const avgAhtMin =
        rows.length > 0
          ? rows.reduce((s, r) => s + r.ahtSeconds, 0) / rows.length / 60
          : 0;
      const slaPct =
        rows.length > 0 ? (rows.filter((r) => r.slaMet).length / rows.length) * 100 : 0;
      return {
        channel: ch,
        count: rows.length,
        avgCsat,
        fcrPct,
        avgAhtMin,
        slaPct,
      };
    });
  }, [filteredRecords]);

  // 4. CSAT Score Distribution (1 to 5 Stars)
  const csatDistribution = useMemo(() => {
    const valid = filteredRecords.filter((r) => r.csatScore >= 1 && r.csatScore <= 5);
    const total = valid.length || 1;
    return [5, 4, 3, 2, 1].map((score) => {
      const rows = valid.filter((r) => r.csatScore === score);
      const fcrPct =
        rows.length > 0 ? (rows.filter((r) => r.fcr).length / rows.length) * 100 : 0;
      return {
        score,
        count: rows.length,
        pct: (rows.length / total) * 100,
        fcrPct,
      };
    });
  }, [filteredRecords]);

  // 5. Agent Efficiency Quadrant (AHT vs FCR%)
  const agentStats = useMemo(() => {
    const map = new Map<
      string,
      { tier: string; count: number; ahtSum: number; fcrCount: number; csatSum: number; csatN: number }
    >();
    // Seed from allRecords so agents remain visible even when filtered
    for (const r of allRecords) {
      if (!map.has(r.agentName)) {
        map.set(r.agentName, { tier: r.tier, count: 0, ahtSum: 0, fcrCount: 0, csatSum: 0, csatN: 0 });
      }
    }
    for (const r of filteredRecords) {
      const entry = map.get(r.agentName)!;
      entry.count += 1;
      entry.ahtSum += r.ahtSeconds;
      if (r.fcr) entry.fcrCount += 1;
      if (r.csatScore > 0) {
        entry.csatSum += r.csatScore;
        entry.csatN += 1;
      }
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({
        name,
        tier: d.tier,
        count: d.count,
        avgAhtMin: d.count > 0 ? d.ahtSum / d.count / 60 : 0,
        fcrPct: d.count > 0 ? (d.fcrCount / d.count) * 100 : 0,
        avgCsat: d.csatN > 0 ? d.csatSum / d.csatN : 0,
      }))
      .filter((a) => a.count > 0);
  }, [filteredRecords, allRecords]);

  // 6. Heatmap: Day x Hour Block
  const heatmapData = useMemo(() => {
    let maxCount = 1;
    const grid = DAYS_ORDER.map((day) => {
      const cells = HOUR_BUCKETS.map((bucket) => {
        const rows = filteredRecords.filter(
          (r) => r.dayOfWeek === day && r.hourBlock >= bucket.min && r.hourBlock <= bucket.max
        );
        if (rows.length > maxCount) maxCount = rows.length;
        const slaRate =
          rows.length > 0 ? (rows.filter((r) => r.slaMet).length / rows.length) * 100 : 100;
        return {
          day,
          bucket: bucket.label,
          count: rows.length,
          slaRate,
        };
      });
      return { day, cells };
    });
    return { grid, maxCount };
  }, [filteredRecords]);

  const maxCategoryCount = Math.max(1, ...categoryStats.map((c) => c.count));
  const maxMonthCount = Math.max(1, ...monthlySeries.map((m) => m.count));

  // Chart 1 SVG Geometry
  const chartW = 540;
  const chartH = 220;
  const padL = 40;
  const padR = 40;
  const padT = 20;
  const padB = 34;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const csatToY = (csat: number) => {
    const minC = 3.0;
    const maxC = 5.0;
    const clamped = Math.min(maxC, Math.max(minC, csat));
    return padT + innerH - ((clamped - minC) / (maxC - minC)) * innerH;
  };

  const countToY = (cnt: number) => {
    return padT + innerH - (cnt / (maxMonthCount * 1.15)) * innerH;
  };

  const hoveredMonthObj = monthlySeries.find((m) => m.month === hoveredMonth);
  const hoveredAgentObj = agentStats.find((a) => a.name === hoveredAgent);

  if (filteredRecords.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
        <h3 className="text-base font-semibold text-slate-900">
          No interactions match the active filter combination
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Adjust or clear the channel, complaint category, or search filters to view Power BI visualizations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: CSAT & Volume Trend (Left) + Recurring Complaint Drivers (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Visualization 1: CSAT & Volume Trend */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                01. CSAT & Interaction Volume Trajectory
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly service volume (bars) overlaid with mean CSAT rating vs. 4.20 target
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 bg-slate-200 border border-slate-300 inline-block" />
                Volume
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-3 h-0.5 bg-blue-700 inline-block" />
                Avg CSAT
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-600 inline-block" />
                Target 4.20
              </span>
            </div>
          </div>

          <div className="relative w-full">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-56 overflow-visible"
              role="img"
              aria-label="CSAT and interaction volume monthly chart"
            >
              {/* Horizontal Gridlines */}
              {[3.0, 3.5, 4.0, 4.5, 5.0].map((tick) => {
                const y = csatToY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={chartW - padR}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray={tick === 3.0 ? undefined : '2 3'}
                    />
                    <text
                      x={padL - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono tabular-nums"
                    >
                      {tick.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* 4.20 Benchmark Line */}
              <line
                x1={padL}
                y1={csatToY(4.2)}
                x2={chartW - padR}
                y2={csatToY(4.2)}
                stroke="#D97706"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />

              {/* Bars & Line Points */}
              {monthlySeries.length > 0 && (() => {
                const slotW = innerW / monthlySeries.length;
                const barW = Math.min(38, slotW * 0.45);
                const points = monthlySeries
                  .map((m, idx) => {
                    const cx = padL + idx * slotW + slotW / 2;
                    const cy = csatToY(m.avgCsat);
                    return `${cx},${cy}`;
                  })
                  .join(' ');

                return (
                  <>
                    {monthlySeries.map((m, idx) => {
                      const cx = padL + idx * slotW + slotW / 2;
                      const barY = countToY(m.count);
                      const barH = padT + innerH - barY;
                      const isHovered = hoveredMonth === m.month;
                      return (
                        <g
                          key={m.month}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredMonth(m.month)}
                          onMouseLeave={() => setHoveredMonth(null)}
                        >
                          <rect
                            x={cx - barW / 2}
                            y={barY}
                            width={barW}
                            height={Math.max(2, barH)}
                            rx={2}
                            fill={isHovered ? '#CBD5E1' : '#E2E8F0'}
                          />
                          <text
                            x={cx}
                            y={barY - 5}
                            textAnchor="middle"
                            className="fill-slate-500 text-[10px] font-mono tabular-nums"
                          >
                            {m.count}
                          </text>
                          <text
                            x={cx}
                            y={chartH - 12}
                            textAnchor="middle"
                            className="fill-slate-600 text-[11px] font-medium"
                          >
                            {m.label.split(' ')[0]}
                          </text>
                        </g>
                      );
                    })}

                    {/* CSAT Polyline */}
                    {monthlySeries.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#1D4ED8"
                        strokeWidth="2.25"
                        points={points}
                      />
                    )}

                    {/* Line nodes */}
                    {monthlySeries.map((m, idx) => {
                      const cx = padL + idx * slotW + slotW / 2;
                      const cy = csatToY(m.avgCsat);
                      const isHovered = hoveredMonth === m.month;
                      return (
                        <g
                          key={`pt-${m.month}`}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredMonth(m.month)}
                          onMouseLeave={() => setHoveredMonth(null)}
                        >
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isHovered ? 5.5 : 4}
                            fill="#FFFFFF"
                            stroke="#1D4ED8"
                            strokeWidth="2.25"
                          />
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>

            {/* Hover Summary Strip */}
            <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular-nums">
              {hoveredMonthObj ? (
                <>
                  <span className="font-medium text-slate-900">{hoveredMonthObj.label}</span>
                  <span>
                    Records: <strong className="font-mono">{hoveredMonthObj.count}</strong> · Avg CSAT:{' '}
                    <strong className="font-mono text-blue-700">
                      {hoveredMonthObj.avgCsat.toFixed(2)}
                    </strong>{' '}
                    · FCR: <strong className="font-mono">{hoveredMonthObj.fcrPct.toFixed(1)}%</strong> · Avg AHT:{' '}
                    <strong className="font-mono">{hoveredMonthObj.avgAhtMin.toFixed(1)}m</strong>
                  </span>
                </>
              ) : (
                <>
                  <span>Hover any month bar to inspect exact period metrics</span>
                  <span className="font-mono text-slate-500">
                    {monthlySeries.length} active periods
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Visualization 2: Recurring Complaint Drivers (Click to cross-filter) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                02. Recurring Complaint Drivers
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any category bar to cross-filter the dashboard
              </p>
            </div>
            {filters.category !== 'All' && (
              <button
                type="button"
                onClick={() => onToggleCategory(filters.category as ComplaintCategory)}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
              >
                Reset
              </button>
            )}
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {categoryStats.map((item) => {
              const widthPct = (item.count / maxCategoryCount) * 100;
              const isSelected = filters.category === item.category;
              const isDimmed = filters.category !== 'All' && !isSelected;

              return (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => onToggleCategory(item.category)}
                  className={`w-full text-left group transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-blue-600 rounded p-1 -mx-1 ${
                    isDimmed ? 'opacity-45 hover:opacity-80' : 'opacity-100'
                  }`}
                >
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="font-medium text-slate-800 group-hover:text-blue-700 transition-colors">
                      {item.category}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600 text-[11px]">
                      {item.count} tickets · CSAT {item.avgCsat.toFixed(2)} · FCR{' '}
                      {item.fcrPct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-700'
                          : item.avgCsat < 3.7
                          ? 'bg-amber-600 group-hover:bg-amber-700'
                          : 'bg-slate-700 group-hover:bg-blue-700'
                      }`}
                      style={{ width: `${Math.max(4, widthPct)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Amber bars indicate categories below 3.70 CSAT threshold</span>
            <span className="font-mono tabular-nums">Top 6 categories</span>
          </div>
        </section>
      </div>

      {/* Row 2: Channel Efficiency Matrix + CSAT Distribution + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Visualization 3: Channel Performance Matrix */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                03. Channel Performance Matrix
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click a channel row to isolate Phone, Chat, Email, or Web Portal
              </p>
            </div>
            {filters.channel !== 'All' && (
              <button
                type="button"
                onClick={() => onToggleChannel(filters.channel as Channel)}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
              >
                Reset
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2 text-left font-medium">Channel</th>
                  <th className="py-2 text-right font-medium">Vol</th>
                  <th className="py-2 text-right font-medium">CSAT</th>
                  <th className="py-2 text-right font-medium">FCR %</th>
                  <th className="py-2 text-right font-medium">Avg AHT</th>
                  <th className="py-2 text-right font-medium">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {channelStats.map((ch) => {
                  const isSelected = filters.channel === ch.channel;
                  const isDimmed = filters.channel !== 'All' && !isSelected;
                  return (
                    <tr
                      key={ch.channel}
                      onClick={() => onToggleChannel(ch.channel)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/80 font-medium'
                          : 'hover:bg-slate-50'
                      } ${isDimmed ? 'opacity-45' : 'opacity-100'}`}
                    >
                      <td className="py-2.5 text-left text-slate-900 font-medium">
                        {ch.channel}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-700">{ch.count}</td>
                      <td className="py-2.5 text-right font-mono text-slate-900">
                        {ch.avgCsat.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right font-mono">
                        <span
                          className={
                            ch.fcrPct >= 75
                              ? 'text-emerald-700 font-medium'
                              : ch.fcrPct < 65
                              ? 'text-amber-700 font-medium'
                              : 'text-slate-700'
                          }
                        >
                          {ch.fcrPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-700">
                        {ch.avgAhtMin.toFixed(1)}m
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-600">
                        {ch.slaPct.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Visual FCR Bar Comparison */}
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
            <div className="text-[11px] font-medium text-slate-500">
              First-Contact Resolution Share by Channel
            </div>
            <div className="grid grid-cols-4 gap-2">
              {channelStats.map((ch) => (
                <button
                  key={`bar-${ch.channel}`}
                  type="button"
                  onClick={() => onToggleChannel(ch.channel)}
                  className="text-left group"
                >
                  <div className="h-14 bg-slate-100 rounded-sm flex items-end overflow-hidden">
                    <div
                      className={`w-full transition-all duration-200 ${
                        filters.channel === ch.channel
                          ? 'bg-blue-700'
                          : 'bg-teal-700 group-hover:bg-blue-700'
                      }`}
                      style={{ height: `${Math.max(8, ch.fcrPct)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600 font-mono tabular-nums">
                    <span className="truncate">{ch.channel.split(' ')[0]}</span>
                    <span>{ch.fcrPct.toFixed(0)}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Visualization 4: CSAT Rating Distribution */}
        <section className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              04. CSAT Rating Breakdown
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              1–5 star distribution & FCR correlation
            </p>
          </div>

          <div className="space-y-2.5 my-4">
            {csatDistribution.map((row) => {
              const barColor =
                row.score >= 4
                  ? 'bg-emerald-600'
                  : row.score === 3
                  ? 'bg-amber-500'
                  : 'bg-red-600';
              return (
                <div key={row.score} className="space-y-1">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="font-medium text-slate-800">
                      {row.score} {row.score === 1 ? 'Star' : 'Stars'}
                    </span>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {row.count} ({row.pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className={`h-full ${barColor}`}
                      style={{ width: `${Math.max(2, row.pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1 tabular-nums">
            <div className="flex justify-between">
              <span>Satisfied (4–5 Stars)</span>
              <span className="font-mono font-semibold text-emerald-700">
                {(
                  (csatDistribution.find((d) => d.score === 5)?.pct ?? 0) +
                  (csatDistribution.find((d) => d.score === 4)?.pct ?? 0)
                ).toFixed(1)}
                %
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dissatisfied (1–2 Stars)</span>
              <span className="font-mono font-semibold text-red-700">
                {(
                  (csatDistribution.find((d) => d.score === 1)?.pct ?? 0) +
                  (csatDistribution.find((d) => d.score === 2)?.pct ?? 0)
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>
        </section>

        {/* Visualization 6: Peak Load & SLA Heatmap */}
        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              05. Weekly Peak Load Heatmap
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ticket density by weekday and UTC window
            </p>
          </div>

          <div className="my-3">
            <div className="grid grid-cols-7 gap-1 text-[10px] font-mono text-slate-500 mb-1.5">
              <div />
              {HOUR_BUCKETS.map((b) => (
                <div key={b.label} className="text-center">
                  {b.label.split('–')[0]}h
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {heatmapData.grid.map((row) => (
                <div key={row.day} className="grid grid-cols-7 gap-1 items-center">
                  <div className="text-[11px] font-medium text-slate-600">{row.day}</div>
                  {row.cells.map((cell) => {
                    const intensity = cell.count / heatmapData.maxCount;
                    let bg = 'bg-slate-100 text-slate-400';
                    if (cell.count > 0) {
                      if (intensity > 0.72) bg = 'bg-blue-700 text-white';
                      else if (intensity > 0.48) bg = 'bg-blue-500 text-white';
                      else if (intensity > 0.24) bg = 'bg-blue-200 text-slate-900';
                      else bg = 'bg-blue-50 text-slate-700';
                    }
                    return (
                      <div
                        key={`${cell.day}-${cell.bucket}`}
                        onMouseEnter={() => setHoveredHeatCell(cell)}
                        onMouseLeave={() => setHoveredHeatCell(null)}
                        className={`h-6 rounded-sm flex items-center justify-center text-[10px] font-mono tabular-nums cursor-default transition-transform ${bg}`}
                      >
                        {cell.count}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 text-[11px] text-slate-600 tabular-nums flex items-center justify-between">
            {hoveredHeatCell ? (
              <span>
                <strong>
                  {hoveredHeatCell.day} {hoveredHeatCell.bucket} UTC
                </strong>
                : {hoveredHeatCell.count} tickets · {hoveredHeatCell.slaRate.toFixed(0)}% SLA met
              </span>
            ) : (
              <span>Hover any time block for SLA compliance rate</span>
            )}
          </div>
        </section>
      </div>

      {/* Row 3: Visualization 5 - Agent Efficiency Quadrant (Full Width Scatter + Leaderboard) */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              06. Agent Efficiency Quadrant (Average Handling Time vs. First-Contact Resolution)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bubble size reflects resolved ticket volume; click any agent bubble to cross-filter
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
              CSAT ≥ 4.10
            </span>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              CSAT 3.70–4.09
            </span>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
              CSAT &lt; 3.70
            </span>
            {filters.agent !== 'All' && (
              <button
                type="button"
                onClick={() => onToggleAgent(filters.agent)}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                Clear Agent
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Scatter Plot SVG */}
          <div className="lg:col-span-7">
            {(() => {
              const sw = 560;
              const sh = 240;
              const sPadL = 48;
              const sPadR = 24;
              const sPadT = 20;
              const sPadB = 34;
              const sW = sw - sPadL - sPadR;
              const sH = sh - sPadT - sPadB;

              const minAht = 4;
              const maxAht = 14;
              const minFcr = 45;
              const maxFcr = 95;

              const xPos = (aht: number) =>
                sPadL + ((Math.min(maxAht, Math.max(minAht, aht)) - minAht) / (maxAht - minAht)) * sW;
              const yPos = (fcr: number) =>
                sPadT + sH - ((Math.min(maxFcr, Math.max(minFcr, fcr)) - minFcr) / (maxFcr - minFcr)) * sH;

              const midX = xPos(8.5);
              const midY = yPos(72);

              return (
                <svg viewBox={`0 0 ${sw} ${sh}`} className="w-full h-60 overflow-visible">
                  {/* Quadrant Labels */}
                  <text x={sPadL + 8} y={sPadT + 14} className="fill-emerald-700/70 text-[10px] font-medium">
                    Optimal (Fast + High FCR)
                  </text>
                  <text
                    x={sw - sPadR - 8}
                    y={sPadT + 14}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px] font-medium"
                  >
                    High-Touch Specialists
                  </text>
                  <text
                    x={sw - sPadR - 8}
                    y={sh - sPadB - 8}
                    textAnchor="end"
                    className="fill-amber-700/70 text-[10px] font-medium"
                  >
                    Coaching Priority
                  </text>

                  {/* Gridlines */}
                  {[50, 65, 80, 95].map((f) => (
                    <g key={f}>
                      <line
                        x1={sPadL}
                        y1={yPos(f)}
                        x2={sw - sPadR}
                        y2={yPos(f)}
                        stroke="#E2E8F0"
                        strokeDasharray="2 3"
                      />
                      <text
                        x={sPadL - 8}
                        y={yPos(f) + 3}
                        textAnchor="end"
                        className="fill-slate-400 text-[10px] font-mono tabular-nums"
                      >
                        {f}%
                      </text>
                    </g>
                  ))}

                  {[4, 6, 8, 10, 12, 14].map((m) => (
                    <g key={m}>
                      <line
                        x1={xPos(m)}
                        y1={sPadT}
                        x2={xPos(m)}
                        y2={sh - sPadB}
                        stroke="#E2E8F0"
                        strokeDasharray="2 3"
                      />
                      <text
                        x={xPos(m)}
                        y={sh - sPadB + 15}
                        textAnchor="middle"
                        className="fill-slate-400 text-[10px] font-mono tabular-nums"
                      >
                        {m}m
                      </text>
                    </g>
                  ))}

                  {/* Quadrant Benchmark Dividers */}
                  <line
                    x1={midX}
                    y1={sPadT}
                    x2={midX}
                    y2={sh - sPadB}
                    stroke="#94A3B8"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={sPadL}
                    y1={midY}
                    x2={sw - sPadR}
                    y2={midY}
                    stroke="#94A3B8"
                    strokeDasharray="4 4"
                  />

                  {/* Agent Bubbles */}
                  {agentStats.map((agent) => {
                    const cx = xPos(agent.avgAhtMin);
                    const cy = yPos(agent.fcrPct);
                    const r = Math.max(6, Math.min(14, Math.sqrt(agent.count) * 1.45));
                    const isSelected = filters.agent === agent.name;
                    const isHovered = hoveredAgent === agent.name;
                    const isDimmed = filters.agent !== 'All' && !isSelected;

                    const fill =
                      agent.avgCsat >= 4.1
                        ? '#16A34A'
                        : agent.avgCsat >= 3.7
                        ? '#2563EB'
                        : '#D97706';

                    return (
                      <g
                        key={agent.name}
                        className="cursor-pointer"
                        onClick={() => onToggleAgent(agent.name)}
                        onMouseEnter={() => setHoveredAgent(agent.name)}
                        onMouseLeave={() => setHoveredAgent(null)}
                        opacity={isDimmed ? 0.3 : 0.9}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered || isSelected ? r + 2 : r}
                          fill={fill}
                          stroke={isSelected ? '#0F172A' : '#FFFFFF'}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                        />
                        {(isHovered || isSelected || agent.count >= 45) && (
                          <text
                            x={cx}
                            y={cy - r - 4}
                            textAnchor="middle"
                            className="fill-slate-700 text-[10px] font-medium pointer-events-none"
                          >
                            {agent.name.split(' ')[0]}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>

          {/* Compact Agent Summary Table */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 pt-4 lg:pt-0">
            <div className="text-xs font-medium text-slate-700 mb-2 flex items-center justify-between">
              <span>
                {hoveredAgentObj
                  ? `Focused Agent: ${hoveredAgentObj.name}`
                  : 'Top Agents by CSAT Rating'}
              </span>
              <span className="font-mono text-slate-400">Click row to filter</span>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {[...agentStats]
                .sort((a, b) => b.avgCsat - a.avgCsat)
                .slice(0, 6)
                .map((agent) => {
                  const isSelected = filters.agent === agent.name;
                  return (
                    <button
                      key={agent.name}
                      type="button"
                      onClick={() => onToggleAgent(agent.name)}
                      onMouseEnter={() => setHoveredAgent(agent.name)}
                      onMouseLeave={() => setHoveredAgent(null)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors tabular-nums ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900 font-medium'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="font-medium text-slate-900">{agent.name}</span>
                        <span className="text-[11px] text-slate-400">{agent.tier}</span>
                      </span>
                      <span className="font-mono text-[11px] shrink-0">
                        {agent.avgCsat.toFixed(2)} CSAT · {agent.fcrPct.toFixed(0)}% FCR ·{' '}
                        {agent.avgAhtMin.toFixed(1)}m
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
