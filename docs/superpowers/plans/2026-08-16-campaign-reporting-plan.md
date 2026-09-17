# Phase 4 — Reporting & Sync (Báo cáo, Xuất dữ liệu & Đồng bộ Google Sheets) Implementation Plan

> **Goal:** Build event-scoped analytics reporting, CSV/XLSX export endpoints, enrich Google Sheets sync payloads with campaign metadata, and provide webhook retry status visibility.

## User Review Required

> [!IMPORTANT]
> Google Sheets payloads are backward compatible with existing Apps Script `doPost` handlers by adding `campaign_id` and `campaign_name` as top-level JSON fields without removing existing spin/award fields.

## Proposed Changes

### Component 1: Event-Scoped Analytics & Reporting Service

#### [NEW] [campaign-reporting-service.js](file:///d:/thuctap/zalominiapp/backend/src/campaign-reporting-service.js)
- `getCampaignAnalytics({ db, campaignId })`:
  - Returns campaign summary: total participants, total allocated spins, total spins used, remaining spins; awards issued, delivered, redeemed, expired/voided; delivery success rate.
- `generateCampaignExportCsv({ db, campaignId, type = 'awards' })`:
  - Builds RFC4180 compliant CSV string for participants or awards of the selected campaign.
- Enriches `postSpinToGoogleSheets` / `syncSpinToGoogleSheets` in `backend/src/google-sheets.js` with `campaignId` and `campaignName`.

#### [NEW] [campaign-reporting-service.test.js](file:///d:/thuctap/zalominiapp/backend/test/campaign-reporting-service.test.js)
- Unit tests for analytics calculation, CSV formatting, and Google Sheets payload enrichment.

---

### Component 2: Admin Reporting Routes

#### [MODIFY] [admin.routes.js](file:///d:/thuctap/zalominiapp/backend/src/routes/admin.routes.js)
- `GET /api/v1/admin/campaigns/:id/analytics`: Event-scoped dashboard analytics.
- `GET /api/v1/admin/campaigns/:id/export`: Download CSV export for campaign participants or awards.

#### [NEW] [admin-reporting.test.js](file:///d:/thuctap/zalominiapp/backend/test/admin-reporting.test.js)
- Contract tests for reporting and export endpoints.

---

### Component 3: Admin Web UI Reporting & Export Panel

#### [MODIFY] [App.jsx](file:///d:/thuctap/zalominiapp/admin-web/src/App.jsx)
- **Tổng quan (Dashboard) screen**:
  - Filter stats by selected campaign dropdown.
  - Display event-scoped cards (Thành viên, Lượt quay, Lượt trúng, Đã đổi thưởng).
  - Add **"Xuất Báo cáo CSV"** download button.

## Verification Plan

### Automated Tests
- `npm --prefix backend test`
- `npm --prefix lucky-wheels test -- --run`
- `npm --prefix admin-web run build`
- `npm test` from monorepo root

### Git Verification
- `git status -sb` and `git diff --check`.
- Commit changes task-by-task.
