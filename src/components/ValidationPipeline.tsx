import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, RotateCcw, Sparkles, Download } from 'lucide-react';
import { ServiceRecord } from '../types/analytics';
import { downloadRecordsCSV, evaluateValidationRules } from '../utils/excelValidation';

interface ValidationPipelineProps {
  records: ServiceRecord[];
  onNormalizeAll: () => void;
  onResetDataset: () => void;
  isNormalized: boolean;
}

const PYTHON_PIPELINE_CODE = `import pandas as pd

df = pd.read_csv("service_interactions_raw.csv")

# 1. Enforce valid CSAT 1-5 scale and AHT ceiling
df["csat_valid"] = df["csat_score"].between(1, 5)
df["aht_valid"] = (df["aht_seconds"] > 0) & (df["aht_seconds"] <= 2400)

# 2. Cross-column FCR & Tier 1 escalation audit
df["escalation_valid"] = ~((~df["fcr"]) & (df["tier"] == "Tier 1") & (~df["escalated"]))

# 3. Export clean analytics view for Power BI & Excel reporting
clean_df = df[df["csat_valid"] & df["aht_valid"] & df["escalation_valid"]]
summary = clean_df.groupby("category").agg(
    tickets=("ticket_id", "count"),
    avg_csat=("csat_score", "mean"),
    avg_aht_min=("aht_seconds", lambda s: s.mean() / 60),
    fcr_rate=("fcr", "mean"),
).round(2)`;

export const ValidationPipeline: React.FC<ValidationPipelineProps> = ({
  records,
  onNormalizeAll,
  onResetDataset,
  isNormalized,
}) => {
  const [selectedRuleId, setSelectedRuleId] = useState<string>('all');

  const rules = useMemo(() => evaluateValidationRules(records), [records]);

  const flaggedRecords = useMemo(() => {
    if (selectedRuleId === 'all') {
      return records.filter((r) => r.validationStatus !== 'Passed');
    }
    const rule = rules.find((rl) => rl.id === selectedRuleId);
    if (!rule) return [];
    const idSet = new Set(rule.failedIds);
    return records.filter((r) => idSet.has(r.ticketId));
  }, [records, rules, selectedRuleId]);

  const totalFailed = useMemo(
    () => records.filter((r) => r.validationStatus !== 'Passed').length,
    [records]
  );
  const passRate = (((records.length - totalFailed) / Math.max(1, records.length)) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Top Action & Audit Summary Strip */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Excel Validation & Python Data Hygiene Audit
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {records.length - totalFailed} of {records.length} records pass all 6 validation checks (
            <strong className="text-slate-900">{passRate}% integrity</strong>) · {totalFailed}{' '}
            {totalFailed === 1 ? 'record' : 'records'} requiring review
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              downloadRecordsCSV(
                flaggedRecords.length > 0 ? flaggedRecords : records,
                flaggedRecords.length > 0
                  ? 'excel_validation_exceptions.csv'
                  : 'validated_service_records.csv'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            {flaggedRecords.length > 0 ? 'Export Exceptions CSV' : 'Export Clean CSV'}
          </button>

          {isNormalized ? (
            <button
              type="button"
              onClick={onResetDataset}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore Raw Dataset
            </button>
          ) : (
            <button
              type="button"
              onClick={onNormalizeAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Auto-Normalize Flagged Records
            </button>
          )}
        </div>
      </section>

      {/* Rule-by-Rule Excel Formula & Python Check Matrix */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">
            Validation Ruleset (Excel Formulas & Pandas Checks)
          </h4>
          {selectedRuleId !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedRuleId('all')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              Show All Exceptions
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Validation Rule</th>
                <th className="px-4 py-2.5 text-left font-medium">Microsoft Excel Formula</th>
                <th className="px-4 py-2.5 text-left font-medium">Python Pandas Check</th>
                <th className="px-4 py-2.5 text-right font-medium">Exceptions</th>
                <th className="px-4 py-2.5 text-right font-medium">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rules.map((rule) => {
                const count = rule.failedIds.length;
                const isSelected = selectedRuleId === rule.id;
                return (
                  <tr
                    key={rule.id}
                    onClick={() =>
                      setSelectedRuleId(isSelected ? 'all' : rule.id)
                    }
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-slate-900">{rule.ruleName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{rule.description}</div>
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      {rule.excelFormula}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-[11px] text-slate-600">
                      {rule.pythonCheck}
                    </td>
                    <td className="px-4 py-3 align-top text-right font-mono font-semibold text-slate-900">
                      {count}
                    </td>
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      {count === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Passed
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            rule.severity === 'Critical' ? 'text-red-700' : 'text-amber-700'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {count} {rule.severity}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Split: Flagged Records Queue + Python Cleaning Script */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">
              Flagged Records Queue ({flaggedRecords.length})
            </h4>
            <span className="text-xs text-slate-500">
              Click a validation rule above to filter
            </span>
          </div>

          {flaggedRecords.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-900">
                Zero Validation Exceptions Remaining
              </div>
              <p className="text-xs text-slate-500 mt-1">
                All {records.length} service records conform to Excel and Python schema rules.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Ticket ID</th>
                    <th className="px-4 py-2 text-left font-medium">Agent</th>
                    <th className="px-4 py-2 text-right font-medium">CSAT</th>
                    <th className="px-4 py-2 text-right font-medium">AHT</th>
                    <th className="px-4 py-2 text-left font-medium">Detected Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {flaggedRecords.map((rec) => (
                    <tr key={rec.ticketId} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {rec.ticketId}
                      </td>
                      <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                        {rec.agentName}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">
                        {rec.csatScore}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">
                        {rec.ahtSeconds}s
                      </td>
                      <td
                        className={`px-4 py-2 font-medium ${
                          rec.validationStatus === 'Flagged' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {rec.validationIssue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-slate-900">
            Python Data Preparation Pipeline
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            Automated pandas validation & aggregation script feeding Power BI datasets
          </p>
          <pre className="text-[11px] font-mono leading-relaxed bg-slate-950 text-slate-100 p-4 rounded-md overflow-x-auto">
            {PYTHON_PIPELINE_CODE}
          </pre>
        </section>
      </div>
    </div>
  );
};
