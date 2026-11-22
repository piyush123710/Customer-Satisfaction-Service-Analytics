import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  X,
} from 'lucide-react';
import { ServiceRecord } from '../types/analytics';
import { downloadRecordsCSV } from '../utils/excelValidation';

interface RecordsExplorerProps {
  records: ServiceRecord[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

type SortField = 'createdAt' | 'csatScore' | 'ahtSeconds' | 'category' | 'channel';

export const RecordsExplorer: React.FC<RecordsExplorerProps> = ({
  records,
  searchQuery,
  onSearchChange,
}) => {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecord | null>(null);
  const pageSize = 18;

  const sortedRecords = useMemo(() => {
    const copy = [...records];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'createdAt') cmp = a.timestamp.localeCompare(b.timestamp);
      else if (sortField === 'csatScore') cmp = a.csatScore - b.csatScore;
      else if (sortField === 'ahtSeconds') cmp = a.ahtSeconds - b.ahtSeconds;
      else if (sortField === 'category') cmp = a.category.localeCompare(b.category);
      else if (sortField === 'channel') cmp = a.channel.localeCompare(b.channel);
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [records, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedRecords.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
    setPage(1);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  return (
    <div className="space-y-4">
      {/* Search & Export Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setPage(1);
            }}
            placeholder="Search ticket ID, agent, category, or resolution note..."
            aria-label="Search service interaction records"
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-blue-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                setPage(1);
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600 tabular-nums shrink-0">
          <span>
            Showing <strong className="font-mono text-slate-900">{sortedRecords.length}</strong>{' '}
            records
          </span>
          <button
            type="button"
            onClick={() =>
              downloadRecordsCSV(
                sortedRecords,
                `service_interactions_export_${new Date().toISOString().slice(0, 10)}.csv`
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </button>
        </div>
      </div>

      {/* High-Density Data Grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {pageRows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm font-semibold text-slate-900">
              No matching service records found
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Try clearing the search term or resetting active cross-filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Ticket ID</th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('createdAt')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Date
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('channel')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Channel
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('category')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Complaint Category
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Agent</th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('csatScore')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      CSAT
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('ahtSeconds')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      AHT
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">FCR</th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                    Validation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {pageRows.map((rec) => (
                  <tr
                    key={rec.ticketId}
                    onClick={() => setSelectedRecord(rec)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono font-medium text-blue-700 whitespace-nowrap">
                      {rec.ticketId}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                      {rec.createdAt}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 whitespace-nowrap">{rec.channel}</td>
                    <td className="px-4 py-2.5 text-slate-900 font-medium whitespace-nowrap">
                      {rec.category}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                      {rec.agentName}{' '}
                      <span className="text-slate-400">· {rec.tier}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {rec.csatScore === 0 ? 'N/A' : `${rec.csatScore}.0 / 5`}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                      {formatDuration(rec.ahtSeconds)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={
                          rec.fcr ? 'text-emerald-700 font-medium' : 'text-slate-500'
                        }
                      >
                        {rec.fcr ? 'Resolved (1st)' : 'Repeat'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          rec.validationStatus === 'Passed'
                            ? 'text-emerald-700'
                            : rec.validationStatus === 'Warning'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {rec.validationStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-600 tabular-nums">
          <span>
            Page <strong className="font-mono text-slate-900">{safePage}</strong> of{' '}
            <strong className="font-mono text-slate-900">{totalPages}</strong> · Click any row to
            inspect interaction details
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
              className="p-1.5 border border-slate-200 bg-white rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
              className="p-1.5 border border-slate-200 bg-white rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interaction Inspector Slide-Over Drawer */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/25"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="w-full max-w-md bg-white h-full border-l border-slate-200 p-6 overflow-y-auto flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="font-mono text-xs text-blue-700 font-semibold">
                    {selectedRecord.ticketId}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                    {selectedRecord.category}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1">
                    {selectedRecord.createdAt} · {selectedRecord.channel} · {selectedRecord.region}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  aria-label="Close inspector"
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs tabular-nums">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-slate-500">Customer Rating</div>
                  <div className="text-lg font-mono font-semibold text-slate-900 mt-1">
                    {selectedRecord.csatScore === 0
                      ? 'Unverified'
                      : `${selectedRecord.csatScore}.0 / 5.0`}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-slate-500">Handling Time</div>
                  <div className="text-lg font-mono font-semibold text-slate-900 mt-1">
                    {formatDuration(selectedRecord.ahtSeconds)}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs divide-y divide-slate-100">
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500">Assigned Agent</span>
                  <span className="font-medium text-slate-900">
                    {selectedRecord.agentName} ({selectedRecord.tier})
                  </span>
                </div>
                <div className="pt-3 flex justify-between">
                  <span className="text-slate-500">Customer Account</span>
                  <span className="font-mono text-slate-800">{selectedRecord.customerId}</span>
                </div>
                <div className="pt-3 flex justify-between">
                  <span className="text-slate-500">First-Contact Resolution</span>
                  <span
                    className={`font-medium ${
                      selectedRecord.fcr ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {selectedRecord.fcr ? 'Yes — Resolved First Contact' : 'No — Follow-Up Required'}
                  </span>
                </div>
                <div className="pt-3 flex justify-between">
                  <span className="text-slate-500">SLA Compliance</span>
                  <span
                    className={`font-medium ${
                      selectedRecord.slaMet ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {selectedRecord.slaMet ? 'Within Target SLA' : 'SLA Threshold Exceeded'}
                  </span>
                </div>
                <div className="pt-3 flex justify-between">
                  <span className="text-slate-500">Excel Validation Status</span>
                  <span
                    className={`font-medium ${
                      selectedRecord.validationStatus === 'Passed'
                        ? 'text-emerald-700'
                        : selectedRecord.validationStatus === 'Warning'
                        ? 'text-amber-700'
                        : 'text-red-700'
                    }`}
                  >
                    {selectedRecord.validationStatus}
                  </span>
                </div>
              </div>

              {selectedRecord.validationIssue && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900">
                  <div className="font-semibold">Validation Exception Flagged</div>
                  <div className="mt-1">{selectedRecord.validationIssue}</div>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-slate-900 mb-1.5">
                  Resolution Summary
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed">
                  {selectedRecord.resolutionSummary || (
                    <span className="text-red-700 italic">
                      Missing resolution documentation (flagged by ISBLANK Excel check).
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
