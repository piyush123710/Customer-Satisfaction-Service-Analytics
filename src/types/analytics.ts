export type Channel = 'Phone' | 'Live Chat' | 'Email' | 'Web Portal';

export type ComplaintCategory =
  | 'Billing Discrepancy'
  | 'Delivery Delay'
  | 'Account Access'
  | 'Technical Bug'
  | 'Plan Cancellation'
  | 'Refund Request';

export type SupportTier = 'Tier 1' | 'Tier 2' | 'Tier 3';

export type ValidationStatus = 'Passed' | 'Warning' | 'Flagged';

export type Region = 'North America' | 'Europe' | 'Asia Pacific' | 'Latin America';

export interface ServiceRecord {
  ticketId: string;
  createdAt: string; // ISO date string YYYY-MM-DD
  timestamp: string; // Full ISO timestamp
  month: string; // YYYY-MM
  dayOfWeek: string; // Mon..Sun
  hourBlock: number; // 0..23
  customerId: string;
  region: Region;
  channel: Channel;
  category: ComplaintCategory;
  agentName: string;
  tier: SupportTier;
  csatScore: number; // 1 to 5 (or 0 if unverified anomaly)
  ahtSeconds: number; // Average handling time in seconds
  fcr: boolean; // First-Contact Resolution
  slaMet: boolean;
  escalated: boolean;
  validationStatus: ValidationStatus;
  validationIssue: string | null;
  resolutionSummary: string;
}

export interface DashboardFilters {
  dateRange: '30d' | '90d' | 'all';
  channel: Channel | 'All';
  category: ComplaintCategory | 'All';
  tier: SupportTier | 'All';
  agent: string | 'All';
  fcrOnly: 'all' | 'fcr' | 'repeat';
  searchQuery: string;
}

export interface SQLPreset {
  id: string;
  title: string;
  description: string;
  query: string;
}

export interface ValidationRule {
  id: string;
  ruleName: string;
  excelFormula: string;
  pythonCheck: string;
  description: string;
  severity: 'Critical' | 'Warning';
  failedIds: string[];
}
