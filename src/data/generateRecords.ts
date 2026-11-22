import {
  Channel,
  ComplaintCategory,
  Region,
  ServiceRecord,
  SupportTier,
  ValidationStatus,
} from '../types/analytics';

// Deterministic Mulberry32 PRNG for reproducible 560-record dataset
function createRng(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AGENTS: Array<{ name: string; tier: SupportTier; speedFactor: number; fcrBonus: number }> = [
  { name: 'Maya Lin', tier: 'Tier 1', speedFactor: 0.88, fcrBonus: 0.08 },
  { name: 'Liam Patel', tier: 'Tier 1', speedFactor: 0.94, fcrBonus: 0.04 },
  { name: 'Sofia Alvarez', tier: 'Tier 1', speedFactor: 0.85, fcrBonus: 0.1 },
  { name: 'Noah Brooks', tier: 'Tier 1', speedFactor: 1.06, fcrBonus: -0.05 },
  { name: 'Hannah Kim', tier: 'Tier 1', speedFactor: 0.91, fcrBonus: 0.06 },
  { name: 'Daniel Okafor', tier: 'Tier 2', speedFactor: 0.96, fcrBonus: 0.07 },
  { name: 'Clara Jensen', tier: 'Tier 2', speedFactor: 1.04, fcrBonus: 0.02 },
  { name: 'Ethan Morales', tier: 'Tier 2', speedFactor: 1.12, fcrBonus: -0.06 },
  { name: 'Priya Nair', tier: 'Tier 2', speedFactor: 0.89, fcrBonus: 0.09 },
  { name: 'Lucas Weber', tier: 'Tier 3', speedFactor: 1.18, fcrBonus: -0.04 },
  { name: 'Amina Hassan', tier: 'Tier 3', speedFactor: 0.98, fcrBonus: 0.05 },
  { name: 'Owen Gallagher', tier: 'Tier 3', speedFactor: 1.15, fcrBonus: -0.08 },
];

const CHANNELS: Array<{ name: Channel; weight: number; baseAht: number; fcrBase: number; slaLimit: number }> = [
  { name: 'Phone', weight: 0.34, baseAht: 495, fcrBase: 0.77, slaLimit: 600 },
  { name: 'Live Chat', weight: 0.31, baseAht: 380, fcrBase: 0.74, slaLimit: 480 },
  { name: 'Email', weight: 0.22, baseAht: 710, fcrBase: 0.61, slaLimit: 900 },
  { name: 'Web Portal', weight: 0.13, baseAht: 310, fcrBase: 0.81, slaLimit: 420 },
];

const CATEGORIES: Array<{
  name: ComplaintCategory;
  weight: number;
  ahtMult: number;
  fcrMod: number;
  csatMod: number;
  summaries: string[];
}> = [
  {
    name: 'Billing Discrepancy',
    weight: 0.25,
    ahtMult: 1.18,
    fcrMod: -0.11,
    csatMod: -0.35,
    summaries: [
      'Duplicate invoice charge identified on monthly renewal; credit memo issued.',
      'Pro-rated mid-cycle seat upgrade discrepancy reconciled with finance ledger.',
      'Tax exemption certificate applied retroactively and overcharge refunded.',
    ],
  },
  {
    name: 'Delivery Delay',
    weight: 0.21,
    ahtMult: 1.05,
    fcrMod: -0.06,
    csatMod: -0.25,
    summaries: [
      'Carrier hub delay escalated to regional logistics; expedited replacement dispatched.',
      'Tracking status stalled at customs clearance; updated ETA sent to customer.',
      'Split-shipment notice clarified and shipping fee waived per SLA guarantee.',
    ],
  },
  {
    name: 'Technical Bug',
    weight: 0.19,
    ahtMult: 1.32,
    fcrMod: -0.16,
    csatMod: -0.2,
    summaries: [
      'Session token expiration defect reproduced and patched via cache reset.',
      'CSV export encoding issue resolved by switching customer workspace locale.',
      'Webhook retry timeout escalated to Tier 3 engineering with diagnostic logs.',
    ],
  },
  {
    name: 'Account Access',
    weight: 0.15,
    ahtMult: 0.72,
    fcrMod: 0.16,
    csatMod: 0.35,
    summaries: [
      'MFA hardware key re-enrolled after identity verification check.',
      'SSO SAML assertion mismatch corrected for organization domain.',
      'Locked workspace administrator account unlocked and password reset verified.',
    ],
  },
  {
    name: 'Refund Request',
    weight: 0.12,
    ahtMult: 0.94,
    fcrMod: 0.06,
    csatMod: 0.1,
    summaries: [
      '30-day satisfaction guarantee refund processed to original payment method.',
      'Partial refund approved for damaged item verified via photo submission.',
      'Accidental annual auto-renewal reversed within grace window.',
    ],
  },
  {
    name: 'Plan Cancellation',
    weight: 0.08,
    ahtMult: 1.24,
    fcrMod: -0.09,
    csatMod: -0.45,
    summaries: [
      'Retention offer declined; subscription scheduled for end-of-period cancellation.',
      'Account downgraded to starter tier instead of full cancellation after review.',
      'Contract offboarding checklist completed and final invoice finalized.',
    ],
  },
];

const REGIONS: Region[] = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pickWeighted<T extends { weight: number }>(items: T[], r: number): T {
  let acc = 0;
  for (const item of items) {
    acc += item.weight;
    if (r <= acc) return item;
  }
  return items[items.length - 1];
}

export function generateServiceRecords(count = 560): ServiceRecord[] {
  const rng = createRng(20261121);
  const records: ServiceRecord[] = [];

  // Span 180 days ending 2026-11-21
  const endDate = new Date('2026-11-21T20:00:00Z').getTime();
  const spanMs = 175 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const channelObj = pickWeighted(CHANNELS, rng());
    const catObj = pickWeighted(CATEGORIES, rng());
    const region = REGIONS[Math.floor(rng() * REGIONS.length)];

    // Date distribution slightly weighted toward recent months
    const progress = Math.pow(rng(), 0.88);
    const tsMs = endDate - (1 - progress) * spanMs;
    const dateObj = new Date(tsMs);

    // Realistic weekday & business-hour skew
    const dayIdx = dateObj.getUTCDay();
    const hourRaw = Math.floor(8 + rng() * 12); // 08:00 - 19:59 peak window
    dateObj.setUTCHours(hourRaw, Math.floor(rng() * 60), Math.floor(rng() * 60), 0);

    const isoTimestamp = dateObj.toISOString();
    const createdAt = isoTimestamp.slice(0, 10);
    const month = isoTimestamp.slice(0, 7);

    // Choose tier (Technical Bug & Plan Cancellation route more to Tier 2/3)
    const tierRoll = rng();
    let targetTier: SupportTier = 'Tier 1';
    if (catObj.name === 'Technical Bug' && tierRoll > 0.38) {
      targetTier = tierRoll > 0.78 ? 'Tier 3' : 'Tier 2';
    } else if ((catObj.name === 'Billing Discrepancy' || catObj.name === 'Plan Cancellation') && tierRoll > 0.55) {
      targetTier = tierRoll > 0.86 ? 'Tier 3' : 'Tier 2';
    } else if (tierRoll > 0.72) {
      targetTier = tierRoll > 0.92 ? 'Tier 3' : 'Tier 2';
    }

    const tierAgents = AGENTS.filter((a) => a.tier === targetTier);
    const agent = tierAgents[Math.floor(rng() * tierAgents.length)];

    // Seasonal improvement over the 6 months (process improvements in Oct/Nov)
    const monthImprovement = progress * 0.08;

    const fcrProb = Math.min(
      0.95,
      Math.max(0.25, channelObj.fcrBase + catObj.fcrMod + agent.fcrBonus + monthImprovement)
    );
    const fcr = rng() < fcrProb;
    const escalated = !fcr && (targetTier !== 'Tier 1' || rng() > 0.2);

    // AHT in seconds
    const noise = 0.72 + rng() * 0.62;
    const fcrAhtMult = fcr ? 0.88 : 1.24;
    let ahtSeconds = Math.round(
      channelObj.baseAht * catObj.ahtMult * agent.speedFactor * fcrAhtMult * noise
    );
    ahtSeconds = Math.max(95, ahtSeconds);

    const slaMet = ahtSeconds <= channelObj.slaLimit * 1.15;

    // CSAT Score (1 to 5)
    let rawCsat =
      3.85 +
      catObj.csatMod +
      (fcr ? 0.85 : -0.65) +
      (slaMet ? 0.25 : -0.4) +
      monthImprovement * 1.5 +
      (rng() - 0.5) * 1.5;
    let csatScore = Math.min(5, Math.max(1, Math.round(rawCsat)));

    let validationStatus: ValidationStatus = 'Passed';
    let validationIssue: string | null = null;
    let resolutionSummary = catObj.summaries[Math.floor(rng() * catObj.summaries.length)];

    // Inject realistic Excel validation anomalies in ~16 records for QA audit workflow
    if (i === 18 || i === 104 || i === 247 || i === 389 || i === 492) {
      ahtSeconds = 2640 + Math.floor(rng() * 840); // > 44 min outlier
      validationStatus = 'Flagged';
      validationIssue = 'AHT Outlier (> 2,400s SLA Threshold)';
    } else if (i === 42 || i === 173 || i === 311 || i === 445) {
      resolutionSummary = '';
      validationStatus = 'Flagged';
      validationIssue = 'Missing Resolution Summary (ISBLANK)';
    } else if (i === 76 || i === 215 || i === 358 || i === 518) {
      csatScore = 0; // Unverified / null survey response
      validationStatus = 'Warning';
      validationIssue = 'Unverified CSAT Score (Outside 1-5 Range)';
    } else if (i === 139 || i === 288 || i === 412) {
      validationStatus = 'Warning';
      validationIssue = 'Unresolved Tier 1 Record Without Escalation Flag';
    }

    const ticketNum = 10420 + i;
    records.push({
      ticketId: `SR-${ticketNum}`,
      createdAt,
      timestamp: isoTimestamp,
      month,
      dayOfWeek: DAYS[dayIdx],
      hourBlock: hourRaw,
      customerId: `CUST-${3100 + Math.floor(rng() * 420)}`,
      region,
      channel: channelObj.name,
      category: catObj.name,
      agentName: agent.name,
      tier:
        validationIssue === 'Unresolved Tier 1 Record Without Escalation Flag'
          ? 'Tier 1'
          : targetTier,
      csatScore,
      ahtSeconds,
      fcr,
      slaMet,
      escalated:
        validationIssue === 'Unresolved Tier 1 Record Without Escalation Flag'
          ? false
          : escalated,
      validationStatus,
      validationIssue,
      resolutionSummary,
    });
  }

  // Sort descending by timestamp so newest appear first
  return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export const INITIAL_RECORDS: ServiceRecord[] = generateServiceRecords(560);
