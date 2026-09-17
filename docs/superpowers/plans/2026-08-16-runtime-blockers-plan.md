# Implementation Plan — Resolution of Runtime Blockers & Schema Alignment

> **Goal:** Resolve all runtime blockers identified in audit: implement true CSV/Excel file upload in Admin UI, fix campaign cloning (copy rules, spin configs, reward odds), assign `campaign_id` to imported vouchers, isolate `spin_once` RPC execution by campaign, align queries with actual database column names (`title_snapshot`, `spin_event_id`, `rule_spin_rewards`), and load campaign metadata for Google Sheets sync.

---

## User Review Required

> [!IMPORTANT]
> A new additive SQL migration `0008_campaign_spin_isolation.sql` will be created to update `spin_once` RPC so that spin quotas and rule evaluations are strictly isolated by active `campaign_id` and `campaign_participants`.

---

## Proposed Changes

### Database Migration

#### [NEW] [0008_campaign_spin_isolation.sql](file:///d:/thuctap/zalominiapp/lucky-wheels/supabase/migrations/0008_campaign_spin_isolation.sql)
- Updates `spin_once(text, text, boolean, text)` RPC:
  - Resolves active campaign `v_campaign_id` (`status = 'active'`).
  - Scopes spin event count to `(customer_id, campaign_id)`.
  - Reads `spin_quota` from `public.campaign_participants` for `(campaign_id, customer_id)` (falling back to `customers.total_spins` for legacy data).
  - Filters rule evaluation by `campaign_rules.campaign_id = v_campaign_id`.

---

### Backend Core Services

#### [MODIFY] [campaign-reuse-service.js](file:///d:/thuctap/zalominiapp/backend/src/campaign-reuse-service.js)
- **Campaign Cloning (`cloneCampaign`)**:
  - Filter `campaign_rules` by `campaign_id = sourceCampaignId`.
  - Clone rules into new campaign, and recursively copy `rule_spin_configs` and `rule_spin_rewards`.
- **Voucher Import (`importCampaignParticipants`)**:
  - Include `campaign_id: campaign.id` when inserting pre-assigned vouchers into `public.customer_rewards`.

#### [MODIFY] [award-operations-service.js](file:///d:/thuctap/zalominiapp/backend/src/award-operations-service.js)
- **Resend ZNS Delivery (`resendAwardDelivery`)**:
  - Query `awards` by `id` to obtain `spin_event_id`, then update `deliveries` WHERE `spin_event_id = award.spin_event_id` and `channel = 'zbs'` (aligning with `deliveries` table schema).
- **Inventory Summary (`getCampaignInventorySummary`)**:
  - Query planned quantities from `rule_spin_rewards` linked via `rule_spin_configs` and `campaign_rules` WHERE `campaign_id = campaignId`.

#### [MODIFY] [campaign-reporting-service.js](file:///d:/thuctap/zalominiapp/backend/src/campaign-reporting-service.js)
- **CSV Export Query (`generateCampaignExportCsv`)**:
  - Fix query to select `code, title_snapshot, value_snapshot, status, issued_at, customers(name,phone)` from `public.awards` (aligning with `awards` table schema).

#### [MODIFY] [google-sheets-service.js](file:///d:/thuctap/zalominiapp/backend/src/google-sheets-service.js)
- **Sync Context (`loadGoogleSheetsSyncContext`)**:
  - Fetch `campaigns` table record associated with `spin.campaign_id` or `award.campaign_id` and pass into `buildGoogleSheetsPayload`.

---

### Admin Web Frontend

#### [MODIFY] [App.jsx](file:///d:/thuctap/zalominiapp/admin-web/src/App.jsx)
- **Excel/CSV File Import UI**:
  - Replace raw JSON textarea with an interactive File Upload input (`<input type="file" accept=".csv,.xlsx,.xls,.json" />`) that automatically parses CSV / XLSX / JSON file content into table preview rows.

---

## Verification Plan

### Automated Tests
- Run updated unit & integration test suite: `npm --prefix backend test`
- Run DB integration tests for Migration 0008: `npm --prefix backend test:db`
- Run Mini App test suite: `npm --prefix lucky-wheels test -- --run`
- Run production build: `npm run build`

### Manual & Schema Alignment Checks
- Verify CSV export with `title_snapshot` & `value_snapshot`.
- Verify ZNS resend with `spin_event_id`.
- Verify inventory summary with `rule_spin_rewards`.
- Verify Excel file drag-and-drop / select in Admin Web UI.
