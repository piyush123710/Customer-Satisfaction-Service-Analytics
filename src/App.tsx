import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Menu,
  RotateCcw,
  Table2,
  X,
} from 'lucide-react';
import { INITIAL_RECORDS } from './data/generateRecords';
import {
  Channel,
  ComplaintCategory,
  DashboardFilters,
  ServiceRecord,
  SupportTier,
} from './types/analytics';
import { downloadRecordsCSV, normalizeRecords } from './utils/excelValidation';
import { PowerBIVisualizations } from './components/PowerBIVisualizations';
import { SQLWorkbench } from './components/SQLWorkbench';
import { ValidationPipeline } from './components/ValidationPipeline';
import { RecordsExplorer } from './components/RecordsExplorer';
import { ExecutiveReport } from './components/ExecutiveReport';

type WorkspaceTab = 'overview' | 'sql' | 'validation' | 'records' | 'report';

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  breadcrumb: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'overview',
    label: 'Power BI Dashboard',
    breadcrumb: 'Power BI Visualizations',
    icon: BarChart3,
  },
  {
    id: 'sql',
    label: 'SQL Query Explorer',
    breadcrumb: 'SQL Query Workbench',
    icon: Database,
  },
  {
    id: 'validation',
    label: 'Excel & Python QA',
    breadcrumb: 'Excel Validation & Python Pipeline',
    icon: FileCheck2,
  },
  {
    id: 'records',
    label: 'Interaction Records',
    breadcrumb: 'Service Interaction Records',
    icon: Table2,
  },
  {
    id: 'report',
    label: 'Performance Report',
    breadcrumb: 'Executive Performance Report',
    icon: FileSpreadsheet,
  },
];

const DEFAULT_FILTERS: DashboardFilters = {
  dateRange: 'all',
  channel: 'All',
  category: 'All',
  tier: 'All',
  agent: 'All',
  fcrOnly: 'all',
  searchQuery: '',
};

export default function App() {
  const [records, setRecords] = useState<ServiceRecord[]>(INITIAL_RECORDS);
  const [isNormalized, setIsNormalized] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const filteredRecords = useMemo(() => {
    const refEnd = new Date('2026-11-21T23:59:59Z').getTime();
    const q = filters.searchQuery.trim().toLowerCase();

    return records.filter((r) => {
      if (filters.dateRange === '30d') {
        const diffDays = (refEnd - new Date(r.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 30) return false;
      } else if (filters.dateRange === '90d') {
        const diffDays = (refEnd - new Date(r.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 90) return false;
      }

      if (filters.channel !== 'All' && r.channel !== filters.channel) return false;
      if (filters.category !== 'All' && r.category !== filters.category) return false;
      if (filters.tier !== 'All' && r.tier !== filters.tier) return false;
      if (filters.agent !== 'All' && r.agentName !== filters.agent) return false;
      if (filters.fcrOnly === 'fcr' && !r.fcr) return false;
      if (filters.fcrOnly === 'repeat' && r.fcr) return false;

      if (q) {
        const haystack = `${r.ticketId} ${r.agentName} ${r.category} ${r.channel} ${r.region} ${r.resolutionSummary}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [records, filters]);

  // Core KPIs
  const kpis = useMemo(() => {
    const total = filteredRecords.length;
    const validCsat = filteredRecords.filter((r) => r.csatScore > 0);
    const avgCsat =
      validCsat.length > 0
        ? validCsat.reduce((s, r) => s + r.csatScore, 0) / validCsat.length
        : 0;
    const avgAhtMin =
      total > 0
        ? filteredRecords.reduce((s, r) => s + r.ahtSeconds, 0) / total / 60
        : 0;
    const fcrPct =
      total > 0
        ? (filteredRecords.filter((r) => r.fcr).length / total) * 100
        : 0;
    const slaPct =
      total > 0
        ? (filteredRecords.filter((r) => r.slaMet).length / total) * 100
        : 0;
    const flaggedCount = filteredRecords.filter((r) => r.validationStatus !== 'Passed').length;

    return { total, avgCsat, avgAhtMin, fcrPct, slaPct, flaggedCount };
  }, [filteredRecords]);

  const hasActiveFilters =
    filters.dateRange !== 'all' ||
    filters.channel !== 'All' ||
    filters.category !== 'All' ||
    filters.tier !== 'All' ||
    filters.agent !== 'All' ||
    filters.fcrOnly !== 'all' ||
    filters.searchQuery.trim() !== '';

  const handleToggleChannel = (ch: Channel) => {
    setFilters((prev) => ({
      ...prev,
      channel: prev.channel === ch ? 'All' : ch,
    }));
  };

  const handleToggleCategory = (cat: ComplaintCategory) => {
    setFilters((prev) => ({
      ...prev,
      category: prev.category === cat ? 'All' : cat,
    }));
  };

  const handleToggleAgent = (agent: string) => {
    setFilters((prev) => ({
      ...prev,
      agent: prev.agent === agent ? 'All' : agent,
    }));
  };

  const handleNormalizeAll = () => {
    setRecords((prev) => normalizeRecords(prev));
    setIsNormalized(true);
  };

  const handleResetDataset = () => {
    setRecords(INITIAL_RECORDS);
    setIsNormalized(false);
  };

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];
  const validationIssueCount = useMemo(
    () => records.filter((r) => r.validationStatus !== 'Passed').length,
    [records]
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation (248px) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[248px] shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Wordmark */}
          <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              ServicePulse BI
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden p-1 text-slate-500 hover:text-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Navigation */}
          <nav className="p-3 space-y-1" aria-label="Workspace navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 text-blue-800 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-blue-700' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'validation' && validationIssueCount > 0 && (
                    <span className="font-mono text-[11px] text-amber-700 font-semibold tabular-nums">
                      {validationIssueCount}
                    </span>
                  )}
                  {item.id === 'records' && (
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {records.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Dataset Scope Summary */}
          <div className="mx-3 mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-2">
            <div className="font-semibold text-slate-800">Dataset Scope</div>
            <div className="space-y-1 text-[11px] text-slate-600 tabular-nums">
              <div className="flex justify-between">
                <span>Total Records</span>
                <span className="font-mono text-slate-900">{records.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Filter</span>
                <span className="font-mono text-slate-900">{filteredRecords.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Window</span>
                <span className="font-mono text-slate-900">Jun–Nov 2026</span>
              </div>
            </div>
          </div>
        </div>

        {/* Analyst Profile Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
            SA
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900 truncate">
              Service Operations BI
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Python · SQL · Excel · Power BI
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Left, Single Primary Action on Right */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="hidden sm:inline whitespace-nowrap">Customer Analytics</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 whitespace-nowrap truncate">
                {currentNav.breadcrumb}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                downloadRecordsCSV(
                  filteredRecords,
                  `service_analytics_export_${new Date().toISOString().slice(0, 10)}.csv`
                )
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV ({filteredRecords.length})
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          {/* Page Intro & Global Filter Toolbar (shown on Overview & Records) */}
          {(activeTab === 'overview' || activeTab === 'records') && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900">
                    {activeTab === 'overview'
                      ? 'Customer Satisfaction & Service Analytics'
                      : 'Customer Interaction Records'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {records.length} simulated interactions · Track CSAT, average handling time,
                    first-contact resolution, and recurring complaints
                  </p>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Clear All Filters
                  </button>
                )}
              </div>

              {/* Workspace Filter Slicers */}
              <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
                {/* Date Range Segmented Control */}
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                  {[
                    { id: '30d', label: 'Last 30 Days' },
                    { id: '90d', label: 'Last 90 Days' },
                    { id: 'all', label: 'All 560 Records' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          dateRange: opt.id as DashboardFilters['dateRange'],
                        }))
                      }
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                        filters.dateRange === opt.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="h-5 w-px bg-slate-200 hidden sm:block" />

                {/* Channel Dropdown */}
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="whitespace-nowrap">Channel:</span>
                  <select
                    value={filters.channel}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        channel: e.target.value as DashboardFilters['channel'],
                      }))
                    }
                    className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="All">All Channels</option>
                    <option value="Phone">Phone</option>
                    <option value="Live Chat">Live Chat</option>
                    <option value="Email">Email</option>
                    <option value="Web Portal">Web Portal</option>
                  </select>
                </label>

                {/* Category Dropdown */}
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="whitespace-nowrap">Complaint:</span>
                  <select
                    value={filters.category}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        category: e.target.value as DashboardFilters['category'],
                      }))
                    }
                    className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="All">All Categories</option>
                    <option value="Billing Discrepancy">Billing Discrepancy</option>
                    <option value="Delivery Delay">Delivery Delay</option>
                    <option value="Technical Bug">Technical Bug</option>
                    <option value="Account Access">Account Access</option>
                    <option value="Refund Request">Refund Request</option>
                    <option value="Plan Cancellation">Plan Cancellation</option>
                  </select>
                </label>

                {/* Support Tier Dropdown */}
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="whitespace-nowrap">Tier:</span>
                  <select
                    value={filters.tier}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        tier: e.target.value as SupportTier | 'All',
                      }))
                    }
                    className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="All">All Tiers</option>
                    <option value="Tier 1">Tier 1</option>
                    <option value="Tier 2">Tier 2</option>
                    <option value="Tier 3">Tier 3</option>
                  </select>
                </label>

                {/* FCR Resolution Segment */}
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="whitespace-nowrap">Resolution:</span>
                  <select
                    value={filters.fcrOnly}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        fcrOnly: e.target.value as DashboardFilters['fcrOnly'],
                      }))
                    }
                    className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="all">All Outcomes</option>
                    <option value="fcr">First-Contact Resolved</option>
                    <option value="repeat">Repeat / Escalated</option>
                  </select>
                </label>

                {filters.agent !== 'All' && (
                  <div className="text-xs text-blue-800 font-medium ml-auto">
                    Agent: {filters.agent}
                  </div>
                )}
              </div>

              {/* 4-Column Executive KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Customer Satisfaction (CSAT)
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-2xl font-mono font-semibold text-slate-900">
                      {kpis.avgCsat.toFixed(2)}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        kpis.avgCsat >= 4.0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {kpis.avgCsat >= 4.2 ? 'Above 4.20 Target' : 'Target 4.20 / 5.0'}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    First-Contact Resolution (FCR)
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-2xl font-mono font-semibold text-slate-900">
                      {kpis.fcrPct.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-500">
                      {kpis.slaPct.toFixed(0)}% SLA Met
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Average Handling Time (AHT)
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-2xl font-mono font-semibold text-slate-900">
                      {kpis.avgAhtMin.toFixed(1)} min
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {Math.round(kpis.avgAhtMin * 60)}s avg
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500">
                    Analyzed Interactions
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-2xl font-mono font-semibold text-slate-900">
                      {kpis.total}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('validation')}
                      className={`text-xs font-medium hover:underline ${
                        kpis.flaggedCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {kpis.flaggedCount > 0
                        ? `${kpis.flaggedCount} QA Flagged`
                        : '100% Validated'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Active Workspace Tab Content */}
          {activeTab === 'overview' && (
            <PowerBIVisualizations
              filteredRecords={filteredRecords}
              allRecords={records}
              filters={filters}
              onToggleChannel={handleToggleChannel}
              onToggleCategory={handleToggleCategory}
              onToggleAgent={handleToggleAgent}
            />
          )}

          {activeTab === 'sql' && <SQLWorkbench records={records} />}

          {activeTab === 'validation' && (
            <ValidationPipeline
              records={records}
              onNormalizeAll={handleNormalizeAll}
              onResetDataset={handleResetDataset}
              isNormalized={isNormalized}
            />
          )}

          {activeTab === 'records' && (
            <RecordsExplorer
              records={filteredRecords}
              searchQuery={filters.searchQuery}
              onSearchChange={(q) => setFilters((prev) => ({ ...prev, searchQuery: q }))}
            />
          )}

          {activeTab === 'report' && (
            <ExecutiveReport records={filteredRecords} allRecords={records} />
          )}
        </main>
      </div>
    </div>
  );
}
