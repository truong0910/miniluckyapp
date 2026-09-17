# Phase 2 — Campaign Reuse Implementation Plan

> **Goal:** Enable Admin to clone previous events (configuration only vs. configuration + audience) and import customer/voucher lists from Excel without modifying historical records.

## User Review Required

> [!IMPORTANT]
> All changes are strictly additive. Cloning creates new campaign IDs and new participant membership rows. Historical `spin_events`, `awards`, and `deliveries` from previous events are never altered or copied.

## Proposed Changes

### Component 1: Database Migration & Schema

#### [NEW] [0007_campaign_participants.sql](file:///d:/thuctap/zalominiapp/lucky-wheels/supabase/migrations/0007_campaign_participants.sql)
- Create `public.campaign_participants` table:
  - `id uuid primary key default gen_random_uuid()`
  - `campaign_id uuid not null references public.campaigns(id)`
  - `customer_id uuid not null references public.customers(id)`
  - `status text not null default 'active' check (status in ('active', 'paused', 'removed'))`
  - `spin_quota integer not null default 0 check (spin_quota >= 0)`
  - `imported_group text`
  - `created_at`, `updated_at`
  - `unique (campaign_id, customer_id)`
- Grant read/write access to `service_role`.

#### [NEW] [phase2e.integration.test.js](file:///d:/thuctap/zalominiapp/backend/test/db/phase2e.integration.test.js)
- DB integration test verifying `campaign_participants` schema, uniqueness constraint, and isolation.

---

### Component 2: Campaign Clone & Import Service

#### [NEW] [campaign-reuse-service.js](file:///d:/thuctap/zalominiapp/backend/src/campaign-reuse-service.js)
- `cloneCampaign({ db, sourceCampaignId, newCode, newName, cloneMode })`:
  - **`config_only` mode**: Copies campaign metadata, rules, spin configs, and reward catalog links to a new draft campaign.
  - **`config_and_audience` mode**: Copies config PLUS campaign membership and pre-assigned vouchers to the new draft campaign with 0 spins used and new IDs.
- `importCampaignParticipants({ db, campaignId, rows, importMode })`:
  - Validates `Tên KH`, `SĐT` (Vietnamese format normalization), `Số voucher tặng`, `Ghi chú`.
  - **`voucher` mode**: Parses denominations from `Ghi chú` (e.g. `5 triệu, 5 triệu, 3 triệu`), matches rewards in the campaign, creates customer assignments.
  - **`quota` mode**: Allocates `spin_quota` in `campaign_participants`.
- `listCampaignParticipants({ db, campaignId, page, limit, search })`.

#### [NEW] [campaign-reuse-service.test.js](file:///d:/thuctap/zalominiapp/backend/test/campaign-reuse-service.test.js)
- Unit tests for cloning logic, Excel row parsing, denomination matching, and error validation.

---

### Component 3: Admin Routes

#### [MODIFY] [admin.routes.js](file:///d:/thuctap/zalominiapp/backend/src/routes/admin.routes.js)
- `POST /api/v1/admin/campaigns/:id/clone`: Clone a campaign.
- `GET /api/v1/admin/campaigns/:id/participants`: List campaign participants.
- `POST /api/v1/admin/campaigns/:id/participants/import`: Process bulk customer/voucher import.

#### [NEW] [admin-campaign-reuse.test.js](file:///d:/thuctap/zalominiapp/backend/test/admin-campaign-reuse.test.js)
- Contract tests for campaign cloning and participant import routes.

---

### Component 4: Admin Web UI

#### [MODIFY] [App.jsx](file:///d:/thuctap/zalominiapp/admin-web/src/App.jsx)
- **Sự kiện screen**: Add "Nhân bản sự kiện" (Clone) button opening a modal to choose mode (`config_only` vs. `config_and_audience`).
- **Khách hàng sự kiện tab**: Add Excel/CSV file upload modal with column mapping preview, validation summary, and import mode selector (Cấp Voucher vs Cấp Lượt quay).

## Verification Plan

### Automated Tests
- `npm --prefix backend test`
- `npm --prefix lucky-wheels test -- --run`
- `npm --prefix admin-web run build`
- `npm test` from monorepo root

### Git Verification
- `git status -sb` and `git diff --check`.
- Commit changes task-by-task.
