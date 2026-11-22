# ServicePulse BI — Customer Satisfaction & Service Analytics Dashboard

An interactive customer operations analytics workbench built to analyze **560 simulated customer interaction records** across support channels, track **Customer Satisfaction (CSAT)**, **Average Handling Time (AHT)**, and **First-Contact Resolution (FCR)**, run **SQL queries** directly against the dataset, and audit data quality using **Microsoft Excel validation formulas** and **Python (`pandas`)** checks.

---

## Core Modules & Capabilities

### 1. Power BI-Style Interactive Visualizations (`Power BI Dashboard`)
- **4-KPI Executive Strip**: Real-time weighted CSAT (vs. `4.20` target), First-Contact Resolution rate, Average Handling Time (`min` and `sec`), SLA attainment, and QA exception count.
- **Global Slicers & Cross-Filtering**: Filter dynamically by Date Range (`Last 30 Days`, `Last 90 Days`, `All 560 Records`), Channel, Complaint Category, Support Tier, Resolution Outcome, or click directly on any chart element to cross-filter every visualization simultaneously.
- **6 Interactive Visualizations**:
  1. **CSAT & Interaction Volume Trajectory** — Dual-axis monthly volume bar chart overlaid with mean CSAT trendline and `4.20` target benchmark.
  2. **Recurring Complaint Drivers** — Clickable horizontal bar ranking across 6 complaint categories with CSAT and FCR% annotations.
  3. **Channel Performance Matrix** — Interactive comparison of Phone, Live Chat, Email, and Web Portal across Volume, CSAT, FCR%, AHT, and SLA attainment.
  4. **CSAT Rating Breakdown** — 1–5 star distribution histogram with satisfied vs. dissatisfied share.
  5. **Weekly Peak Load Heatmap** — Day-of-week (`Mon–Sun`) × UTC time-block (`08:00–20:00`) grid displaying ticket density and hover SLA compliance rates.
  6. **Agent Efficiency Quadrant** — Scatter plot comparing all 12 service agents by AHT (x-axis) vs. FCR% (y-axis), sized by ticket volume and grouped by CSAT tier, paired with a clickable agent leaderboard.

### 2. SQL Query Workbench (`SQL Query Explorer`)
- Built-in client-side SQL query engine (`src/utils/sqlEngine.ts`) executing live queries against the `service_interactions` table.
- Supports `SELECT`, `WHERE` (`=`, `!=`, `<>`, `>`, `<`, `>=`, `<=`, `AND`, `OR`, `LIKE`), `GROUP BY`, `ORDER BY`, `LIMIT`, column aliases (`AS`), and aggregate expressions (`COUNT`, `AVG`, `SUM`, `MIN`, `MAX`, `ROUND`).
- Includes **5 pre-built analytical queries**:
  - Recurring Complaints & FCR Impact
  - Channel Performance & SLA Compliance
  - Agent Productivity Leaderboard
  - Monthly CSAT & Volume Trajectory
  - Excel Validation Exceptions
- Exports any query output directly to RFC-4180 CSV.

### 3. Excel & Python Data Validation Pipeline (`Excel & Python QA`)
Evaluates **6 automated validation rules** across all 560 interaction records and isolates anomalies in a review queue:

| Validation Rule | Microsoft Excel Formula | Python `pandas` Check |
| :--- | :--- | :--- |
| **CSAT Score Boundary (1–5)** | `=AND(ISNUMBER(L2), L2>=1, L2<=5, INT(L2)=L2)` | `df['csat_score'].between(1, 5) & df['csat_score'].notna()` |
| **Handling Time SLA Outlier (<= 2,400s)** | `=AND(ISNUMBER(M2), M2>0, M2<=2400)` | `(df['aht_seconds'] > 0) & (df['aht_seconds'] <= 2400)` |
| **Resolution Summary Completeness** | `=AND(NOT(ISBLANK(Q2)), LEN(TRIM(Q2))>=8)` | `df['resolution_summary'].fillna('').str.strip().str.len() >= 8` |
| **FCR & Tier Escalation Integrity** | `=OR(N2=TRUE, K2<>"Tier 1", P2=TRUE)` | `~((~df['fcr']) & (df['tier'] == 'Tier 1') & (~df['escalated']))` |
| **Ticket Primary Key Uniqueness** | `=COUNTIF($A$2:$A$561, A2)=1` | `~df['ticket_id'].duplicated(keep=False)` |
| **ISO-8601 Timestamp Integrity** | `=ISNUMBER(DATEVALUE(LEFT(C2,10)))` | `pd.to_datetime(df['timestamp'], format='ISO8601', errors='coerce').notna()` |

Includes one-click **Auto-Normalize Flagged Records** (with an option to restore the raw dataset) and CSV export for exceptions or clean data.

### 4. Service Interaction Records Explorer (`Interaction Records`)
- Searchable, sortable, and paginated table of all **560 simulated records** (`SR-10420` through `SR-10979`).
- Clicking any row opens the **Interaction Inspector** slide-over drawer displaying full ticket metadata, SLA compliance, validation diagnostics, and resolution notes.

### 5. Executive Performance Report (`Performance Report`)
- Aggregates live findings across the active filter scope: primary complaint driver, FCR-to-CSAT lift, lowest satisfaction segment, and category-level breakdown table.
- Supports **Print Report** (`@media print` layout) and **Export Summary CSV**.

---

## Dataset Schema (`service_interactions`)

Generated deterministically via a seeded PRNG (`src/data/generateRecords.ts`) spanning **June 2026 – November 2026**:

- **Channels**: `Phone`, `Live Chat`, `Email`, `Web Portal`
- **Complaint Categories**: `Billing Discrepancy`, `Delivery Delay`, `Technical Bug`, `Account Access`, `Refund Request`, `Plan Cancellation`
- **Support Tiers & Agents**: 12 agents distributed across `Tier 1`, `Tier 2`, and `Tier 3`
- **Regions**: `North America`, `Europe`, `Asia Pacific`, `Latin America`
- **Key Fields**: `ticket_id`, `created_at`, `month`, `day_of_week`, `hour_block`, `customer_id`, `region`, `channel`, `category`, `agent_name`, `tier`, `csat_score`, `aht_seconds`, `fcr_flag`, `sla_flag`, `escalated`, `validation_status`, `validation_issue`, `resolution_summary`

---

## Tech Stack

- **Analytics & BI Workflow**: Power BI-style interactive cross-filtering, SQL querying, Microsoft Excel validation formulas, Python `pandas` cleaning logic
- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React

---

## Project Structure

```text
├── index.html
├── metadata.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── App.tsx                                 # Workspace shell, navigation, global slicers & KPIs
    ├── index.css                               # Tailwind v4 theme & print styles
    ├── main.tsx                                # React entry point
    ├── types/
    │   └── analytics.ts                        # Domain interfaces & union types
    ├── data/
    │   └── generateRecords.ts                  # Seeded 560-record interaction dataset generator
    ├── utils/
    │   ├── sqlEngine.ts                        # In-memory SQL parser/executor & 5 presets
    │   └── excelValidation.ts                  # Excel/Python validation rules, normalization & CSV export
    └── components/
        ├── PowerBIVisualizations.tsx           # 6 cross-filtered SVG/table visualizations
        ├── SQLWorkbench.tsx                    # SQL query editor, schema & result grid
        ├── ValidationPipeline.tsx              # Excel & Python QA audit & auto-normalization
        ├── RecordsExplorer.tsx                 # Searchable/sortable 560-record grid & inspector drawer
        └── ExecutiveReport.tsx                 # Printable executive summary & category breakdown
```

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm

### Installation & Local Development

```bash
# Install dependencies
npm install

# Start the development server on port 3000
npm run dev
```

### Type-Checking & Production Build

```bash
# Run TypeScript compiler checks
npm run lint

# Build production bundle into dist/
npm run build

# Preview production build
npm run preview
```
