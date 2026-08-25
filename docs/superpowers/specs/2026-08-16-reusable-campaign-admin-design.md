# Reusable Campaign Admin Design

**Date:** 2026-08-16
**Status:** Draft for user review; approach approved, implementation pending

## Goal

Turn the current Admin Console into a reusable event manager for the Mini App. An operator should be able to create a new event, reuse a previous event's configuration or audience, run exactly one event at a time, and inspect every historical result without resetting or deleting old data.

The design keeps the existing single-admin model and the current Zalo/preview authentication boundary. It extends the campaign and award foundations already present in the database instead of replacing `spin_events` or historical `awards`.

## Decisions already confirmed

- Historical customers, spins, awards, deliveries, and redemption timestamps remain permanently queryable.
- A new event gets a new `campaign_id`; it never reuses the old event's transaction rows.
- The clone dialog exposes both modes:
  1. **Configuration only:** copy event metadata, assets, rules, reward setup, probabilities, and planned inventory.
  2. **Configuration + audience:** also copy campaign membership, customer groups, and newly issued spin quotas/reward assignments. The copied allocations receive new ids and counters; old spins and awards are never copied.
- Only one campaign may be active at a time. There is no parallel-event/link model.
- One Admin account has full access. Multi-user roles and invitations are out of scope.
- Before the first spin, configuration can be edited normally. After a spin exists, historical results and reward identity/code are immutable. Operational actions remain available through explicit workflows such as pause, adjust stock with a reason, resend, redeem, expire, or void.

## Scope

### In scope

- Campaign lifecycle and event selector in Admin.
- Blank creation and the two clone modes above.
- Campaign-scoped customer membership, quota allocation, group/tag metadata, and bulk import/export.
- Campaign-scoped rule and reward inventory configuration.
- Award/delivery operations and a searchable event history.
- Campaign dashboard, filtered reports, and Google Sheets synchronization context.
- Safety constraints, audit notes, and migration/test coverage.

### Out of scope

- Multiple concurrently active events.
- Multiple Admin accounts, role-based access control, or approval workflows.
- Requiring Zalo phone permission before this Admin work can be tested locally.
- Deleting or rewriting legacy rows to fit the new model.
- A new public Mini App design unrelated to selecting the active campaign.

## Campaign lifecycle

The Admin displays campaigns with a clear status and date window:

```text
draft -> active -> paused -> active
draft -> active -> ended -> archived
paused -> ended -> archived
```

`draft` is editable and cannot receive public spins. `active` is the only state eligible for a public spin. `paused` blocks new spins while preserving all reads and operational actions. `ended` is a terminal operational state; `archived` hides the event from default lists but does not delete it. A future migration may add `ended` to the existing campaign status check constraint; until then `ends_at` plus an explicit archive transition must not change historical rows.

Activation is transactional and must reject an overlap. The UI asks the Admin to pause/end the currently active event before activating another one; it must not silently move a live event or reset its inventory. The database also enforces the single-active invariant with a unique partial index or equivalent transaction guard.

## Admin information architecture

### 1. Tổng quan

The dashboard is scoped to the selected campaign and shows:

- total participants, allocated spins, consumed spins, and remaining spins;
- reward spins, issued awards, delivered awards, redeemed awards, expired/void awards;
- reward inventory remaining and low-stock warnings;
- recent operational failures (delivery, webhook, redemption).

### 2. Sự kiện

- list, search, and filter campaigns by lifecycle status;
- create a blank event;
- clone configuration only or configuration plus audience;
- edit draft metadata, banner assets, rules, dates, and timezone;
- activate, pause, end, archive, and reopen only where the state transition allows it;
- view an event's immutable history and configuration revision summary.

### 3. Khách hàng của sự kiện

- add an existing customer to a campaign without duplicating the customer master;
- import an XLSX/XLS/CSV file using the supplied customer-list shape;
- bulk add, subtract, or replace future spin quota with a reason;
- assign customer groups/tags and filter by them;
- show allocated, consumed, remaining, awards, and latest activity per event;
- keep customer master data shared while keeping membership and quota campaign-scoped.

#### Customer-file import

The first import template supports these columns (Vietnamese labels are accepted and can be mapped in the preview step):

| File column | Required | Destination | Validation |
| --- | --- | --- | --- |
| `Tên KH` | yes | customer name | non-empty, trimmed |
| `SĐT` | yes | normalized customer phone | Vietnamese phone format; preserve leading zero |
| `Số voucher tặng` | yes | number of campaign-scoped voucher assignments | integer greater than or equal to zero |
| `Ghi chú` | no | campaign participant note | stored as text, never parsed as money |

The upload flow is: choose campaign -> upload file -> map/preview columns -> validate -> show valid/invalid and duplicate rows -> confirm import. Validation errors are downloadable and a failed confirmation performs no partial campaign assignment. A normalized phone identifies an existing customer; the import reuses that customer master row instead of creating a duplicate. Re-importing the same file must be idempotent or require an explicit merge policy (add, replace, or skip) before it changes a quota.

For the supplied template, the import mode is **cấp voucher cụ thể**. `Số voucher tặng` must equal the number of comma-separated denominations in `Ghi chú`; for example, `3` and `5 triệu, 5 triệu, 3 triệu` creates three campaign-scoped assignments with values 5,000,000, 5,000,000, and 3,000,000 VND. The original note is retained verbatim, and each assignment receives a new id. Unknown money formats or a count mismatch make the row invalid instead of guessing.

The Admin may also choose a separate **cấp số lượt quay** import mode for future files; in that mode the quantity becomes event spin quota and no voucher assignments are created. If the business has pre-generated voucher codes, an optional `Mã voucher` column (one code per denomination, or a separate detail file) is required so redemption can be tracked; the system must not pretend a generated internal id is an external voucher code.

#### Resolving a missing voucher code

When the file does not contain `Mã voucher`, the preview resolves each denomination against the selected event's reward definitions:

1. Match the normalized value (and title when available) to a reward already configured for that campaign.
2. If exactly one reward matches, reuse its reward id and code configuration. The assignment receives a new id and, where the configured code is a prefix rather than a pre-generated voucher code, a unique code generated from that prefix; the preview shows this source clearly.
3. If no reward matches, show **“Chưa có giải thưởng/mã trong sự kiện — nhập mã hoặc tạo giải thưởng trước khi tiếp tục”** and block confirmation for that row until the Admin resolves it.
4. If multiple rewards match, require an explicit Admin selection; never pick an arbitrary reward.
5. If an explicit `Mã voucher` column is supplied, validate uniqueness and use the supplied code for the assignment.

This keeps the import convenient when the event already contains the prize while ensuring every assigned voucher remains traceable and redeemable.

### 4. Phần thưởng và tồn kho

- configure per-event rules, per-spin win rate, per-reward probability, planned quantity, per-customer cap, expiry, label, and active flag;
- show planned, issued, delivered, redeemed, and remaining quantities;
- warn before activating an event with invalid probabilities or insufficient inventory;
- preserve an immutable snapshot on every award so later catalog edits cannot alter a historical voucher.

### 5. Kho voucher / vận hành

- searchable award list filtered by event, customer, code, and status;
- safe transitions: `issued -> delivered -> redeemed`, plus `expired` or `void` with a reason;
- retry/resend delivery without creating a second award;
- show spin id, award id, delivery timestamps, redemption timestamp, and error details;
- never offer a generic delete or direct overwrite for a historical award.

### 6. Báo cáo và đồng bộ

- event-scoped tables and summary cards with date/status filters;
- CSV/XLSX export for the selected event;
- Google Sheets rows include `campaign_id`/campaign name in addition to the existing spin and award columns;
- webhook delivery is idempotent by `spin_id`, and a failed sync is visible for retry rather than changing spin success.

## Data model direction

The existing `campaigns`, `campaign_rules`, `rule_spin_configs`, `rule_spin_rewards`, `customer_rewards`, `spin_events`, and `awards` remain the source of truth for their current responsibilities.

Add a campaign membership/allocation boundary rather than using the global `customers.total_spins` value for future events:

```sql
campaign_participants (
  id uuid primary key,
  campaign_id uuid not null references campaigns(id) on delete restrict,
  customer_id uuid not null references customers(id) on delete restrict,
  status text not null check (status in ('active', 'paused', 'removed')),
  spin_quota integer not null default 0 check (spin_quota >= 0),
  imported_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
)
```

`spins_used` is derived from campaign-scoped `spin_events` (or maintained transactionally if performance requires it); it must never be copied from an old event. Existing rows without an explicit campaign remain attached to the seeded `legacy` campaign.

Cloning creates new campaign, rule/config, membership, and future assignment ids in one transaction. It does not copy `spin_events`, `deliveries`, `awards`, or their timestamps. The clone operation returns a summary of copied configuration and allocation counts so the Admin can verify the result before activation.

## Safety and invariants

1. No historical delete/reset operation is exposed from Admin.
2. Campaigns with spins or awards can only be paused, ended, or archived.
3. Reward code, title/value snapshot, spin outcome, issue time, delivery time, and redemption time are immutable facts once recorded. Corrections use an explicit void/reissue workflow and reason.
4. Only one active campaign is accepted by the database and public spin path.
5. Every campaign-aware read and write is filtered by the selected `campaign_id`; Admin must not accidentally show a global total as an event total.
6. Clone operations are idempotent by a request key so a browser retry cannot duplicate a campaign or its allocations.
7. Customer phone values remain masked in logs and are not written to client-visible error messages.

## API and UI boundary

The implementation should add campaign-aware Admin endpoints behind the existing `requireAdmin` middleware, keeping current routes backward compatible during migration. The public preview/Zalo session flow resolves the single active campaign and passes that campaign context into the existing spin transaction. Admin pages use the selected campaign id for all list, mutation, and report requests; a missing selection falls back to a read-only `legacy` view until a new event is chosen.

Potential endpoint groups (exact naming is implementation work):

- `/admin/campaigns` list/create/update/lifecycle/clone;
- `/admin/campaigns/:id/participants` list/import/bulk quota;
- `/admin/campaigns/:id/rules` and `/admin/campaigns/:id/rewards`;
- `/admin/campaigns/:id/awards` search and safe status actions;
- `/admin/campaigns/:id/reports` summary and export;
- `/admin/campaigns/:id/sync` webhook status/retry.

## Delivery plan

The work is intentionally phased so each slice can be tested locally:

1. **Campaign control:** schema guard for one active event, campaign CRUD/lifecycle, selected-event Admin shell, and active-campaign resolution.
2. **Reuse:** two clone modes, campaign participants, bulk quota/import, and campaign-filtered rules/rewards.
3. **Operations:** inventory counters, award status workflows, resend/void/expire, and event history.
4. **Reporting:** event-scoped dashboard, exports, Google Sheets campaign columns, webhook retry visibility, and cleanup of legacy Admin views.

## Testing strategy

- Migration contract tests for campaign membership, foreign keys, uniqueness, status transitions, and the single-active invariant.
- Integration tests proving a clone creates new ids and no copied spin/award rows.
- Integration tests proving a campaign spin decrements only that campaign's quota/inventory and cannot use another campaign's inactive rule.
- API tests for lifecycle transitions, both clone modes, bulk import validation, award state transitions, and idempotent retries.
- Admin UI tests for event selection, clone confirmation, immutable-history messaging, and campaign-scoped metrics.
- Google Sheets contract test asserting campaign id/name are present while existing columns remain backward compatible.
- Run focused suites first, then the backend, Admin, and Mini App builds before claiming completion.

## Rollback boundary

Do not edit an already-applied migration. Add down/repair migrations only if needed. A rollback must preserve all existing `campaigns`, `spin_events`, `awards`, and customer records; it may disable new Admin routes or hide the new UI while leaving the data readable. Never roll back by deleting historical event rows.
