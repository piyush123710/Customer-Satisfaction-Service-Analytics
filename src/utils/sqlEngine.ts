import { ServiceRecord, SQLPreset } from '../types/analytics';

export interface SQLQueryResult {
  columns: string[];
  rows: Record<string, string | number | boolean>[];
  rowCount: number;
  executionMs: number;
  error?: string;
}

export const SQL_PRESETS: SQLPreset[] = [
  {
    id: 'recurring-complaints',
    title: 'Recurring Complaints & FCR Impact',
    description: 'Ranks complaint categories by ticket volume, average CSAT, FCR rate, and mean handling time.',
    query: `SELECT category,
  COUNT(*) AS ticket_count,
  ROUND(AVG(csat_score), 2) AS avg_csat,
  ROUND(AVG(aht_seconds) / 60, 1) AS avg_aht_min,
  ROUND(AVG(fcr_flag) * 100, 1) AS fcr_pct
FROM service_interactions
WHERE csat_score > 0
GROUP BY category
ORDER BY ticket_count DESC`,
  },
  {
    id: 'channel-efficiency',
    title: 'Channel Performance & SLA Compliance',
    description: 'Compares Phone, Live Chat, Email, and Web Portal across handling time and SLA attainment.',
    query: `SELECT channel,
  COUNT(*) AS interactions,
  ROUND(AVG(csat_score), 2) AS avg_csat,
  ROUND(AVG(aht_seconds), 0) AS avg_aht_sec,
  ROUND(AVG(fcr_flag) * 100, 1) AS fcr_pct,
  ROUND(AVG(sla_flag) * 100, 1) AS sla_pct
FROM service_interactions
WHERE csat_score > 0
GROUP BY channel
ORDER BY avg_csat DESC`,
  },
  {
    id: 'agent-leaderboard',
    title: 'Agent Productivity Leaderboard',
    description: 'Evaluates all 12 service agents by resolved volume, CSAT rating, and First-Contact Resolution.',
    query: `SELECT agent_name,
  tier,
  COUNT(*) AS tickets,
  ROUND(AVG(csat_score), 2) AS avg_csat,
  ROUND(AVG(aht_seconds) / 60, 1) AS avg_aht_min,
  ROUND(AVG(fcr_flag) * 100, 1) AS fcr_pct
FROM service_interactions
WHERE csat_score > 0
GROUP BY agent_name, tier
ORDER BY avg_csat DESC
LIMIT 12`,
  },
  {
    id: 'monthly-trends',
    title: 'Monthly CSAT & Volume Trajectory',
    description: 'Tracks month-over-month service volume, CSAT recovery, and FCR progression.',
    query: `SELECT month,
  COUNT(*) AS volume,
  ROUND(AVG(csat_score), 2) AS avg_csat,
  ROUND(AVG(aht_seconds) / 60, 1) AS avg_aht_min,
  ROUND(AVG(fcr_flag) * 100, 1) AS fcr_pct
FROM service_interactions
WHERE csat_score > 0
GROUP BY month
ORDER BY month ASC`,
  },
  {
    id: 'validation-audit',
    title: 'Excel Validation Exceptions',
    description: 'Isolates records flagged by Excel validation formulas for QA reconciliation.',
    query: `SELECT ticket_id,
  created_at,
  channel,
  category,
  agent_name,
  csat_score,
  aht_seconds,
  validation_status,
  validation_issue
FROM service_interactions
WHERE validation_status != 'Passed'
ORDER BY created_at DESC`,
  },
];

type FlatRow = Record<string, string | number | boolean | null>;

function toSqlRow(r: ServiceRecord): FlatRow {
  return {
    ticket_id: r.ticketId,
    created_at: r.createdAt,
    month: r.month,
    day_of_week: r.dayOfWeek,
    hour_block: r.hourBlock,
    customer_id: r.customerId,
    region: r.region,
    channel: r.channel,
    category: r.category,
    agent_name: r.agentName,
    tier: r.tier,
    csat_score: r.csatScore,
    aht_seconds: r.ahtSeconds,
    fcr: r.fcr ? 1 : 0,
    fcr_flag: r.fcr ? 1 : 0,
    sla_met: r.slaMet ? 1 : 0,
    sla_flag: r.slaMet ? 1 : 0,
    escalated: r.escalated ? 1 : 0,
    validation_status: r.validationStatus,
    validation_issue: r.validationIssue ?? '',
  };
}

function splitTopLevelCommas(str: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let inQuote: string | null = null;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      current += ch;
      if (ch === inQuote) inQuote = null;
    } else if (ch === "'" || ch === '"') {
      inQuote = ch;
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parseValueLiteral(raw: string): string | number {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== '') return num;
  return trimmed;
}

function evaluateCondition(row: FlatRow, cond: string): boolean {
  const trimmed = cond.trim();
  if (!trimmed) return true;

  // Handle OR at top level
  const orParts = trimmed.split(/\s+OR\s+/i);
  if (orParts.length > 1) {
    return orParts.some((part) => evaluateCondition(row, part));
  }

  // Handle AND at top level
  const andParts = trimmed.split(/\s+AND\s+/i);
  if (andParts.length > 1) {
    return andParts.every((part) => evaluateCondition(row, part));
  }

  // LIKE
  const likeMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+LIKE\s+(['"].*['"])$/i);
  if (likeMatch) {
    const col = likeMatch[1].toLowerCase();
    const pattern = String(parseValueLiteral(likeMatch[2]))
      .replace(/%/g, '.*')
      .replace(/_/g, '.');
    const regex = new RegExp(`^${pattern}$`, 'i');
    return regex.test(String(row[col] ?? ''));
  }

  // Comparison operators
  const opMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*(!=|<>|>=|<=|=|>|<)\s*(.+)$/);
  if (!opMatch) {
    throw new Error(`Unsupported WHERE condition: "${trimmed}"`);
  }

  const col = opMatch[1].toLowerCase();
  if (!(col in row)) {
    throw new Error(`Unknown column in WHERE clause: "${col}"`);
  }
  const op = opMatch[2];
  const rhs = parseValueLiteral(opMatch[3]);
  const lhs = row[col];

  if (lhs === null || lhs === undefined) return false;

  const lhsNum = typeof lhs === 'number' ? lhs : Number(lhs);
  const rhsNum = typeof rhs === 'number' ? rhs : Number(rhs);
  const bothNumeric =
    typeof lhs === 'number' && typeof rhs === 'number' && !Number.isNaN(lhsNum) && !Number.isNaN(rhsNum);

  const a = bothNumeric ? lhsNum : String(lhs).toLowerCase();
  const b = bothNumeric ? rhsNum : String(rhs).toLowerCase();

  switch (op) {
    case '=':
      return a === b;
    case '!=':
    case '<>':
      return a !== b;
    case '>':
      return a > b;
    case '<':
      return a < b;
    case '>=':
      return a >= b;
    case '<=':
      return a <= b;
    default:
      return false;
  }
}

function evaluateAggregateExpr(expr: string, groupRows: FlatRow[]): string | number {
  const clean = expr.trim();

  // Check ROUND(inner, decimals)
  const roundMatch = clean.match(/^ROUND\((.+),\s*(\d+)\)$/i);
  if (roundMatch) {
    const innerVal = Number(evaluateAggregateExpr(roundMatch[1], groupRows));
    const decimals = Number(roundMatch[2]);
    const factor = Math.pow(10, decimals);
    return Math.round(innerVal * factor) / factor;
  }

  // Handle simple arithmetic like AVG(aht_seconds) / 60 or AVG(fcr_flag) * 100
  const arithMatch = clean.match(/^(.+?)\s*([*/+-])\s*(\d+(?:\.\d+)?)$/);
  if (arithMatch) {
    const leftVal = Number(evaluateAggregateExpr(arithMatch[1], groupRows));
    const op = arithMatch[2];
    const rightVal = Number(arithMatch[3]);
    if (op === '/') return rightVal === 0 ? 0 : leftVal / rightVal;
    if (op === '*') return leftVal * rightVal;
    if (op === '+') return leftVal + rightVal;
    if (op === '-') return leftVal - rightVal;
  }

  if (/^COUNT\(\*\)$/i.test(clean)) {
    return groupRows.length;
  }

  const aggMatch = clean.match(/^(COUNT|AVG|SUM|MIN|MAX)\(([a-zA-Z0-9_]+)\)$/i);
  if (aggMatch) {
    const fn = aggMatch[1].toUpperCase();
    const col = aggMatch[2].toLowerCase();
    if (groupRows.length > 0 && !(col in groupRows[0])) {
      throw new Error(`Unknown column "${col}" in ${fn}()`);
    }
    const vals = groupRows
      .map((r) => Number(r[col]))
      .filter((v) => !Number.isNaN(v));

    if (fn === 'COUNT') return groupRows.filter((r) => r[col] !== null && r[col] !== '').length;
    if (vals.length === 0) return 0;
    if (fn === 'SUM') return vals.reduce((acc, v) => acc + v, 0);
    if (fn === 'AVG') return vals.reduce((acc, v) => acc + v, 0) / vals.length;
    if (fn === 'MIN') return Math.min(...vals);
    if (fn === 'MAX') return Math.max(...vals);
  }

  // Plain column reference
  const colKey = clean.toLowerCase();
  if (groupRows.length > 0 && colKey in groupRows[0]) {
    const val = groupRows[0][colKey];
    return val === null ? '' : typeof val === 'boolean' ? String(val) : val;
  }

  throw new Error(`Invalid SELECT expression: "${clean}"`);
}

export function executeSQL(query: string, records: ServiceRecord[]): SQLQueryResult {
  const start = performance.now();
  try {
    const normalized = query.replace(/\s+/g, ' ').trim().replace(/;$/, '');
    if (!normalized) {
      return { columns: [], rows: [], rowCount: 0, executionMs: 0, error: 'Query cannot be empty.' };
    }

    const match = normalized.match(
      /^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+GROUP\s+BY\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i
    );

    if (!match) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionMs: 0,
        error: 'Syntax error. Use: SELECT <columns> FROM service_interactions [WHERE ...] [GROUP BY ...] [ORDER BY ...] [LIMIT n]',
      };
    }

    const [, selectClause, tableName, whereClause, groupByClause, orderByClause, limitClause] = match;

    if (tableName.toLowerCase() !== 'service_interactions') {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionMs: 0,
        error: `Unknown table "${tableName}". Available table: service_interactions`,
      };
    }

    let sqlRows = records.map(toSqlRow);

    if (whereClause) {
      sqlRows = sqlRows.filter((row) => evaluateCondition(row, whereClause));
    }

    // Parse SELECT items
    const selectItemsRaw =
      selectClause.trim() === '*'
        ? [
            'ticket_id',
            'created_at',
            'channel',
            'category',
            'agent_name',
            'tier',
            'csat_score',
            'aht_seconds',
            'fcr',
            'validation_status',
          ]
        : splitTopLevelCommas(selectClause);

    const selectDefs = selectItemsRaw.map((item) => {
      const asMatch = item.match(/^(.+?)\s+AS\s+([a-zA-Z0-9_]+)$/i);
      if (asMatch) {
        return { expr: asMatch[1].trim(), alias: asMatch[2].trim() };
      }
      return { expr: item.trim(), alias: item.trim().toLowerCase() };
    });

    const hasAggregate = selectDefs.some((d) => /\b(COUNT|AVG|SUM|MIN|MAX)\(/i.test(d.expr));

    let outputRows: Record<string, string | number | boolean>[] = [];

    if (groupByClause) {
      const groupCols = splitTopLevelCommas(groupByClause).map((c) => c.toLowerCase());
      const groups = new Map<string, FlatRow[]>();
      for (const row of sqlRows) {
        for (const gc of groupCols) {
          if (!(gc in row)) {
            throw new Error(`Unknown column "${gc}" in GROUP BY`);
          }
        }
        const key = groupCols.map((c) => String(row[c])).join('||');
        const list = groups.get(key) ?? [];
        list.push(row);
        groups.set(key, list);
      }

      for (const groupRows of groups.values()) {
        const outRow: Record<string, string | number | boolean> = {};
        for (const def of selectDefs) {
          outRow[def.alias] = evaluateAggregateExpr(def.expr, groupRows);
        }
        outputRows.push(outRow);
      }
    } else if (hasAggregate) {
      const outRow: Record<string, string | number | boolean> = {};
      for (const def of selectDefs) {
        outRow[def.alias] = evaluateAggregateExpr(def.expr, sqlRows);
      }
      outputRows.push(outRow);
    } else {
      outputRows = sqlRows.map((row) => {
        const outRow: Record<string, string | number | boolean> = {};
        for (const def of selectDefs) {
          outRow[def.alias] = evaluateAggregateExpr(def.expr, [row]);
        }
        return outRow;
      });
    }

    if (orderByClause) {
      const orderParts = orderByClause.trim().split(/\s+/);
      const orderCol = orderParts[0].toLowerCase();
      const desc = orderParts[1]?.toUpperCase() === 'DESC';
      outputRows.sort((a, b) => {
        const va = a[orderCol];
        const vb = b[orderCol];
        if (typeof va === 'number' && typeof vb === 'number') {
          return desc ? vb - va : va - vb;
        }
        return desc
          ? String(vb ?? '').localeCompare(String(va ?? ''))
          : String(va ?? '').localeCompare(String(vb ?? ''));
      });
    }

    if (limitClause) {
      const limit = Number(limitClause);
      if (!Number.isNaN(limit) && limit >= 0) {
        outputRows = outputRows.slice(0, limit);
      }
    }

    const columns = selectDefs.map((d) => d.alias);
    const executionMs = Math.max(0.4, Math.round((performance.now() - start) * 10) / 10);

    return {
      columns,
      rows: outputRows,
      rowCount: outputRows.length,
      executionMs,
    };
  } catch (err) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionMs: 0,
      error: err instanceof Error ? err.message : 'Failed to execute SQL query.',
    };
  }
}
