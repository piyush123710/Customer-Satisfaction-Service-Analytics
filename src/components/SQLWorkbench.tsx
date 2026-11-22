import React, { useMemo, useState } from 'react';
import { Download, Play, RotateCcw } from 'lucide-react';
import { ServiceRecord } from '../types/analytics';
import { executeSQL, SQL_PRESETS } from '../utils/sqlEngine';
import { downloadGenericCSV } from '../utils/excelValidation';

interface SQLWorkbenchProps {
  records: ServiceRecord[];
}

const SCHEMA_COLUMNS = [
  { col: 'ticket_id', type: 'VARCHAR' },
  { col: 'created_at', type: 'DATE' },
  { col: 'month', type: 'CHAR(7)' },
  { col: 'channel', type: 'VARCHAR' },
  { col: 'category', type: 'VARCHAR' },
  { col: 'agent_name', type: 'VARCHAR' },
  { col: 'tier', type: 'VARCHAR' },
  { col: 'csat_score', type: 'INT (1-5)' },
  { col: 'aht_seconds', type: 'INT' },
  { col: 'fcr_flag', type: 'TINYINT (0/1)' },
  { col: 'sla_flag', type: 'TINYINT (0/1)' },
  { col: 'validation_status', type: 'VARCHAR' },
];

export const SQLWorkbench: React.FC<SQLWorkbenchProps> = ({ records }) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SQL_PRESETS[0].id);
  const [queryText, setQueryText] = useState<string>(SQL_PRESETS[0].query);
  const [executedQuery, setExecutedQuery] = useState<string>(SQL_PRESETS[0].query);

  const result = useMemo(() => executeSQL(executedQuery, records), [executedQuery, records]);

  const handleSelectPreset = (id: string) => {
    const preset = SQL_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setSelectedPresetId(id);
    setQueryText(preset.query);
    setExecutedQuery(preset.query);
  };

  const handleRunQuery = () => {
    setExecutedQuery(queryText);
  };

  const handleReset = () => {
    const preset = SQL_PRESETS.find((p) => p.id === selectedPresetId) ?? SQL_PRESETS[0];
    setQueryText(preset.query);
    setExecutedQuery(preset.query);
  };

  const handleExportResults = () => {
    if (result.error || result.rows.length === 0) return;
    downloadGenericCSV(
      result.columns,
      result.rows,
      `sql_query_${selectedPresetId}_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Preset Selector & Schema Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Analytical SQL Queries
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Select a pre-built analytical query or write custom SQL against the{' '}
              <span className="font-mono text-slate-700">{records.length}</span> records.
            </p>
            <div className="space-y-1.5">
              {SQL_PRESETS.map((preset) => {
                const active = preset.id === selectedPresetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`w-full text-left p-2.5 rounded-md border transition-colors ${
                      active
                        ? 'bg-blue-50 border-blue-200 text-blue-950'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">{preset.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Table Schema: service_interactions
              </h3>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                {records.length} rows
              </span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {SCHEMA_COLUMNS.map((item) => (
                <div key={item.col} className="py-1.5 flex items-center justify-between">
                  <span className="font-mono text-slate-800">{item.col}</span>
                  <span className="font-mono text-[11px] text-slate-400">{item.type}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* SQL Editor & Live Result Grid */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">SQL Query Editor</h3>
                <p className="text-xs text-slate-500">
                  Supports SELECT, WHERE, GROUP BY, COUNT, AVG, SUM, ROUND, ORDER BY, LIMIT
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleRunQuery}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  Run Query
                </button>
              </div>
            </div>

            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              rows={8}
              spellCheck={false}
              aria-label="SQL query editor"
              className="w-full font-mono text-xs leading-relaxed bg-slate-950 text-slate-100 p-4 rounded-md border border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </section>

          {/* Query Results */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
                <span className="font-semibold text-slate-900">Query Output</span>
                <span aria-hidden="true">·</span>
                {result.error ? (
                  <span className="text-red-700 font-medium">Execution Failed</span>
                ) : (
                  <span>
                    {result.rowCount} {result.rowCount === 1 ? 'row' : 'rows'} returned in{' '}
                    <span className="font-mono">{result.executionMs}ms</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportResults}
                disabled={Boolean(result.error) || result.rows.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Export Result CSV
              </button>
            </div>

            {result.error ? (
              <div className="p-5 bg-red-50 text-red-800 text-xs font-mono">
                {result.error}
              </div>
            ) : result.rows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Query returned 0 matching rows.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      {result.columns.map((col) => (
                        <th
                          key={col}
                          className="px-4 py-2.5 text-left font-mono font-semibold text-slate-700 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {result.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {result.columns.map((col) => {
                          const val = row[col];
                          const isNum = typeof val === 'number';
                          return (
                            <td
                              key={col}
                              className={`px-4 py-2 whitespace-nowrap ${
                                isNum ? 'font-mono text-slate-900' : 'text-slate-700'
                              }`}
                            >
                              {String(val ?? '')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
