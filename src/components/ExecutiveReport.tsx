import React, { useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import { ComplaintCategory, ServiceRecord } from '../types/analytics';
import { downloadGenericCSV } from '../utils/excelValidation';

interface ExecutiveReportProps {
  records: ServiceRecord[];
  allRecords: ServiceRecord[];
}

export const ExecutiveReport: React.FC<ExecutiveReportProps> = ({
  records,
  allRecords,
}) => {
  const reportData = useMemo(() => {
    const validCsat = records.filter((r) => r.csatScore > 0);
    const avgCsat =
      validCsat.length > 0
        ? validCsat.reduce((s, r) => s + r.csatScore, 0) / validCsat.length
        : 0;
    const avgAhtMin =
      records.length > 0
        ? records.reduce((s, r) => s + r.ahtSeconds, 0) / records.length / 60
        : 0;
    const fcrRate =
      records.length > 0
        ? (records.filter((r) => r.fcr).length / records.length) * 100
        : 0;
    const slaRate =
      records.length > 0
        ? (records.filter((r) => r.slaMet).length / records.length) * 100
        : 0;

    const categories: ComplaintCategory[] = [
      'Billing Discrepancy',
      'Delivery Delay',
      'Technical Bug',
      'Account Access',
      'Refund Request',
      'Plan Cancellation',
    ];

    const categoryBreakdown = categories
      .map((cat) => {
        const rows = records.filter((r) => r.category === cat);
        const vcsat = rows.filter((r) => r.csatScore > 0);
        return {
          category: cat,
          count: rows.length,
          sharePct: records.length > 0 ? (rows.length / records.length) * 100 : 0,
          avgCsat:
            vcsat.length > 0
              ? vcsat.reduce((s, r) => s + r.csatScore, 0) / vcsat.length
              : 0,
          avgAhtMin:
            rows.length > 0
              ? rows.reduce((s, r) => s + r.ahtSeconds, 0) / rows.length / 60
              : 0,
          fcrPct:
            rows.length > 0
              ? (rows.filter((r) => r.fcr).length / rows.length) * 100
              : 0,
        };
      })
      .sort((a, b) => b.count - a.count);

    const topComplaint = categoryBreakdown[0];
    const lowestCsatCategory = [...categoryBreakdown]
      .filter((c) => c.count > 0)
      .sort((a, b) => a.avgCsat - b.avgCsat)[0];

    const fcrRows = records.filter((r) => r.fcr && r.csatScore > 0);
    const repeatRows = records.filter((r) => !r.fcr && r.csatScore > 0);
    const fcrAvgCsat =
      fcrRows.length > 0
        ? fcrRows.reduce((s, r) => s + r.csatScore, 0) / fcrRows.length
        : 0;
    const repeatAvgCsat =
      repeatRows.length > 0
        ? repeatRows.reduce((s, r) => s + r.csatScore, 0) / repeatRows.length
        : 0;

    const validatedCount = allRecords.filter((r) => r.validationStatus === 'Passed').length;

    return {
      avgCsat,
      avgAhtMin,
      fcrRate,
      slaRate,
      categoryBreakdown,
      topComplaint,
      lowestCsatCategory,
      fcrAvgCsat,
      repeatAvgCsat,
      validatedCount,
    };
  }, [records, allRecords]);

  const handleDownloadSummaryCSV = () => {
    const columns = [
      'Complaint Category',
      'Ticket Count',
      'Volume Share (%)',
      'Avg CSAT (1-5)',
      'Avg AHT (Min)',
      'First-Contact Resolution (%)',
    ];
    const rows = reportData.categoryBreakdown.map((c) => ({
      'Complaint Category': c.category,
      'Ticket Count': c.count,
      'Volume Share (%)': Number(c.sharePct.toFixed(1)),
      'Avg CSAT (1-5)': Number(c.avgCsat.toFixed(2)),
      'Avg AHT (Min)': Number(c.avgAhtMin.toFixed(1)),
      'First-Contact Resolution (%)': Number(c.fcrPct.toFixed(1)),
    }));
    downloadGenericCSV(
      columns,
      rows,
      `service_performance_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-500">
            Performance Summary · June – November 2026
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            Customer Satisfaction & Service Operations Report
          </h2>
          <p className="text-xs text-slate-600 mt-1 tabular-nums">
            Computed across {records.length} active interaction records ({reportData.validatedCount}/
            {allRecords.length} verified by Excel & Python validation rules).
          </p>
        </div>

        <div className="flex items-center gap-2.5 no-print shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
          <button
            type="button"
            onClick={handleDownloadSummaryCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Summary CSV
          </button>
        </div>
      </div>

      {/* Executive Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Weighted Avg CSAT</div>
          <div className="text-2xl font-mono font-semibold text-slate-900 mt-1">
            {reportData.avgCsat.toFixed(2)} / 5.0
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">First-Contact Resolution</div>
          <div className="text-2xl font-mono font-semibold text-slate-900 mt-1">
            {reportData.fcrRate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Avg Handling Time</div>
          <div className="text-2xl font-mono font-semibold text-slate-900 mt-1">
            {reportData.avgAhtMin.toFixed(1)} min
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">SLA Attainment Rate</div>
          <div className="text-2xl font-mono font-semibold text-slate-900 mt-1">
            {reportData.slaRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Analytical Findings */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">
          01. Key Analytical Findings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-700 leading-relaxed">
          <div>
            <div className="font-semibold text-slate-900 mb-1">Primary Complaint Driver</div>
            <p className="tabular-nums">
              {reportData.topComplaint
                ? `${reportData.topComplaint.category} represents the highest share of incoming demand (${reportData.topComplaint.count} tickets, ${reportData.topComplaint.sharePct.toFixed(1)}% of volume) with a ${reportData.topComplaint.fcrPct.toFixed(1)}% first-contact resolution rate.`
                : 'No records available in current filter scope.'}
            </p>
          </div>
          <div>
            <div className="font-semibold text-slate-900 mb-1">FCR-to-CSAT Lift</div>
            <p className="tabular-nums">
              Interactions resolved on first contact achieve an average CSAT of{' '}
              <strong className="font-mono text-slate-900">
                {reportData.fcrAvgCsat.toFixed(2)}
              </strong>
              , compared to{' '}
              <strong className="font-mono text-slate-900">
                {reportData.repeatAvgCsat.toFixed(2)}
              </strong>{' '}
              for repeat contacts (+{(reportData.fcrAvgCsat - reportData.repeatAvgCsat).toFixed(2)}{' '}
              points).
            </p>
          </div>
          <div>
            <div className="font-semibold text-slate-900 mb-1">Lowest Satisfaction Segment</div>
            <p className="tabular-nums">
              {reportData.lowestCsatCategory
                ? `${reportData.lowestCsatCategory.category} records the lowest satisfaction at ${reportData.lowestCsatCategory.avgCsat.toFixed(2)} CSAT and ${reportData.lowestCsatCategory.avgAhtMin.toFixed(1)} min average handling time.`
                : 'No segment data available.'}
            </p>
          </div>
        </div>
      </section>

      {/* Category Performance Breakdown Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">
            02. Category-Level Performance Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-6 py-2.5 text-left font-medium">Complaint Category</th>
                <th className="px-6 py-2.5 text-right font-medium">Tickets</th>
                <th className="px-6 py-2.5 text-right font-medium">Volume Share</th>
                <th className="px-6 py-2.5 text-right font-medium">Avg CSAT</th>
                <th className="px-6 py-2.5 text-right font-medium">Avg AHT</th>
                <th className="px-6 py-2.5 text-right font-medium">FCR Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {reportData.categoryBreakdown.map((row) => (
                <tr key={row.category} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-900">{row.category}</td>
                  <td className="px-6 py-3 text-right font-mono text-slate-700">{row.count}</td>
                  <td className="px-6 py-3 text-right font-mono text-slate-700">
                    {row.sharePct.toFixed(1)}%
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-slate-900">
                    {row.avgCsat.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-slate-700">
                    {row.avgAhtMin.toFixed(1)}m
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-slate-900">
                    {row.fcrPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
