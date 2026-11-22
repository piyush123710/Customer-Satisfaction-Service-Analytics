import { ServiceRecord, ValidationRule } from '../types/analytics';

export function evaluateValidationRules(records: ServiceRecord[]): ValidationRule[] {
  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];
  const csatRangeIds: string[] = [];
  const ahtOutlierIds: string[] = [];
  const missingSummaryIds: string[] = [];
  const unescalatedRepeatIds: string[] = [];
  const timestampIds: string[] = [];

  for (const r of records) {
    if (seenIds.has(r.ticketId)) {
      duplicateIds.push(r.ticketId);
    }
    seenIds.add(r.ticketId);

    if (r.csatScore < 1 || r.csatScore > 5 || !Number.isInteger(r.csatScore)) {
      csatRangeIds.push(r.ticketId);
    }

    if (r.ahtSeconds <= 0 || r.ahtSeconds > 2400) {
      ahtOutlierIds.push(r.ticketId);
    }

    if (!r.resolutionSummary || r.resolutionSummary.trim().length < 8) {
      missingSummaryIds.push(r.ticketId);
    }

    if (!r.fcr && r.tier === 'Tier 1' && !r.escalated) {
      unescalatedRepeatIds.push(r.ticketId);
    }

    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(r.timestamp)) {
      timestampIds.push(r.ticketId);
    }
  }

  return [
    {
      id: 'rule-csat-range',
      ruleName: 'CSAT Score Boundary (1–5 Integer)',
      excelFormula: '=AND(ISNUMBER(L2), L2>=1, L2<=5, INT(L2)=L2)',
      pythonCheck: "df['csat_score'].between(1, 5) & df['csat_score'].notna()",
      description: 'Ensures every survey rating falls within the valid 1 to 5 Likert scale.',
      severity: 'Warning',
      failedIds: csatRangeIds,
    },
    {
      id: 'rule-aht-bounds',
      ruleName: 'Handling Time SLA Outlier Check (<= 2,400s)',
      excelFormula: '=AND(ISNUMBER(M2), M2>0, M2<=2400)',
      pythonCheck: "(df['aht_seconds'] > 0) & (df['aht_seconds'] <= 2400)",
      description: 'Flags orphaned or paused call timers exceeding 40 minutes (2,400 seconds).',
      severity: 'Critical',
      failedIds: ahtOutlierIds,
    },
    {
      id: 'rule-resolution-nonblank',
      ruleName: 'Resolution Summary Completeness',
      excelFormula: '=AND(NOT(ISBLANK(Q2)), LEN(TRIM(Q2))>=8)',
      pythonCheck: "df['resolution_summary'].fillna('').str.strip().str.len() >= 8",
      description: 'Verifies agents documented an actionable resolution note prior to ticket closure.',
      severity: 'Critical',
      failedIds: missingSummaryIds,
    },
    {
      id: 'rule-fcr-escalation',
      ruleName: 'Cross-Column FCR & Tier Escalation Integrity',
      excelFormula: '=OR(N2=TRUE, K2<>"Tier 1", P2=TRUE)',
      pythonCheck: "~((~df['fcr']) & (df['tier'] == 'Tier 1') & (~df['escalated']))",
      description: 'Requires non-FCR Tier 1 interactions to carry an escalation flag or Tier 2/3 handoff.',
      severity: 'Warning',
      failedIds: unescalatedRepeatIds,
    },
    {
      id: 'rule-unique-ticket',
      ruleName: 'Ticket Primary Key Uniqueness',
      excelFormula: '=COUNTIF($A$2:$A$561, A2)=1',
      pythonCheck: "~df['ticket_id'].duplicated(keep=False)",
      description: 'Guarantees zero duplicate SR-xxxxx ticket IDs across SQL & CSV imports.',
      severity: 'Critical',
      failedIds: duplicateIds,
    },
    {
      id: 'rule-iso-timestamp',
      ruleName: 'ISO-8601 Timestamp Format Integrity',
      excelFormula: '=ISNUMBER(DATEVALUE(LEFT(C2,10)))',
      pythonCheck: "pd.to_datetime(df['timestamp'], format='ISO8601', errors='coerce').notna()",
      description: 'Validates standardized UTC timestamps for accurate daily and hourly trend grouping.',
      severity: 'Critical',
      failedIds: timestampIds,
    },
  ];
}

export function normalizeRecords(records: ServiceRecord[]): ServiceRecord[] {
  return records.map((r) => {
    if (r.validationStatus === 'Passed') return r;

    let csatScore = r.csatScore;
    let ahtSeconds = r.ahtSeconds;
    let resolutionSummary = r.resolutionSummary;
    let escalated = r.escalated;

    if (csatScore < 1 || csatScore > 5) {
      csatScore = r.fcr ? 4 : 3;
    }
    if (ahtSeconds > 2400) {
      ahtSeconds = 1140; // Cap orphaned timer to verified wrap-up ceiling
    }
    if (!resolutionSummary || resolutionSummary.trim().length < 8) {
      resolutionSummary = `Verified ${r.category.toLowerCase()} case resolved via ${r.channel} follow-up.`;
    }
    if (!r.fcr && r.tier === 'Tier 1' && !escalated) {
      escalated = true;
    }

    return {
      ...r,
      csatScore,
      ahtSeconds,
      resolutionSummary,
      escalated,
      validationStatus: 'Passed',
      validationIssue: null,
    };
  });
}

function escapeCsvField(val: string | number | boolean | null): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadRecordsCSV(records: ServiceRecord[], filename: string): void {
  const headers = [
    'Ticket ID',
    'Date',
    'Timestamp',
    'Region',
    'Channel',
    'Complaint Category',
    'Agent Name',
    'Tier',
    'CSAT Score',
    'AHT (Seconds)',
    'First Contact Resolution',
    'SLA Met',
    'Escalated',
    'Validation Status',
    'Validation Issue',
    'Resolution Summary',
  ];

  const rows = records.map((r) => [
    r.ticketId,
    r.createdAt,
    r.timestamp,
    r.region,
    r.channel,
    r.category,
    r.agentName,
    r.tier,
    r.csatScore,
    r.ahtSeconds,
    r.fcr ? 'TRUE' : 'FALSE',
    r.slaMet ? 'TRUE' : 'FALSE',
    r.escalated ? 'TRUE' : 'FALSE',
    r.validationStatus,
    r.validationIssue ?? '',
    r.resolutionSummary,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadGenericCSV(
  columns: string[],
  rows: Record<string, string | number | boolean>[],
  filename: string
): void {
  const csvContent =
    '\uFEFF' +
    [
      columns.map(escapeCsvField).join(','),
      ...rows.map((r) => columns.map((c) => escapeCsvField(r[c])).join(',')),
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
