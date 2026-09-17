# Phase 3 — Operations (Kho Voucher & Vận hành Giải thưởng) Implementation Plan

> **Goal:** Provide safe operational workflows for managing awards (Redeem, Resend/Retry ZNS delivery, Void/Expire with reason) and live inventory tracking without mutating historical records.

## User Review Required

> [!IMPORTANT]
> All operational actions preserve immutable historical records. Retrying delivery reuses the existing `award_id` and delivery outbox record without duplicating awards. Voiding or expiring an award requires an audit reason and updates status safely.

## Proposed Changes

### Component 1: Award Operations Service

#### [NEW] [award-operations-service.js](file:///d:/thuctap/zalominiapp/backend/src/award-operations-service.js)
- `redeemAward({ db, awardId, redeemedBy })`:
  - Validates award exists and current status is `issued` or `delivered`.
  - Sets `status = 'redeemed'` and `redeemed_at = now()`.
- `resendAwardDelivery({ db, awardId })`:
  - Reset delivery outbox status for `awardId` to pending for retry.
  - Update award status to `delivering`.
- `updateAwardStatus({ db, awardId, status, reason })`:
  - Supports `void` and `expired`.
  - Requires non-empty `reason`.
  - Updates `status`, stores reason in audit log/note.
- `getCampaignInventorySummary({ db, campaignId })`:
  - Returns calculated metrics per reward: planned quantity, issued count, delivered count, redeemed count, remaining inventory.

#### [NEW] [award-operations-service.test.js](file:///d:/thuctap/zalominiapp/backend/test/award-operations-service.test.js)
- Unit tests for redeem, resend, void/expire with reason, and inventory counter calculations.

---

### Component 2: Admin Operations Routes

#### [MODIFY] [admin.routes.js](file:///d:/thuctap/zalominiapp/backend/src/routes/admin.routes.js)
- `POST /api/v1/admin/awards/:id/redeem`: Mark award redeemed.
- `POST /api/v1/admin/awards/:id/resend`: Trigger ZNS delivery retry for an award.
- `POST /api/v1/admin/awards/:id/status`: Transition award to `void` or `expired` with reason.
- `GET /api/v1/admin/campaigns/:id/inventory`: Get reward inventory & issuance summary.

#### [NEW] [admin-award-operations.test.js](file:///d:/thuctap/zalominiapp/backend/test/admin-award-operations.test.js)
- Contract tests for award operational routes.

---

### Component 3: Admin Web UI Operations Panel

#### [MODIFY] [App.jsx](file:///d:/thuctap/zalominiapp/admin-web/src/App.jsx)
- **Kho Voucher (Awards) screen**:
  - Add action buttons per voucher row: **Đổi thưởng (Redeem)**, **Gửi lại ZNS (Resend)**, **Hủy / Hết hạn (Void / Expire)**.
  - Action dialog prompting for reason when Voiding/Expiring.
  - Filter awards by selected event.
- **Giải thưởng screen**:
  - Display live inventory progress bars (Đã cấp / Đã đổi / Còn lại) per reward.

## Verification Plan

### Automated Tests
- `npm --prefix backend test`
- `npm --prefix lucky-wheels test -- --run`
- `npm --prefix admin-web run build`
- `npm test` from monorepo root

### Git Verification
- `git status -sb` and `git diff --check`.
- Commit changes task-by-task.
