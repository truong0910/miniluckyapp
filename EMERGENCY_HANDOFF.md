# Emergency Handoff — Lucky Wheels / Zalo Mini App

**Updated:** 2026-08-16
**Repository:** `D:\thuctap\zalominiapp`
**Branch:** `codex/participant-awards-api`

> If the original agent runs out of context, read this file first. Do not restart the work from scratch.

## User goal

The customer wants to reuse the same Mini App for later events while preserving all old data. Admin should manage one event at a time, import customers/vouchers from Excel, operate the voucher lifecycle, and report to Google Sheets.

## Decisions confirmed by the user

- Historical customers, spins, awards, deliveries, and redemption timestamps must remain; never reset or delete old event data.
- Only one campaign/event can be active at a time. There are no concurrent events or multiple event links.
- Event cloning has two modes:
  1. clone configuration only;
  2. clone configuration plus customer list, groups, quotas/assignments as new records.
- Keep one full-access Admin account. No multi-user roles are needed.
- Before the first spin, configuration is editable. After a spin exists, old results, reward identity/code, and timestamps are immutable; use explicit pause/end/void/reissue workflows for corrections.
- Excel import is required. The supplied template has `Tên KH`, `SĐT`, `Số voucher tặng`, and `Ghi chú`.
- In that template, `Số voucher tặng` means pre-assigned vouchers, not spin quota. Example: `3` + `5 triệu, 5 triệu, 3 triệu` creates three voucher assignments.
- Import must match each denomination to an existing reward in the selected event and reuse its code configuration. If no matching reward exists, show a message requiring the Admin to enter a code or create the reward; do not silently guess.
- If the file later contains real voucher codes, an optional `Mã voucher` column may supply them. A separate import mode may allocate spin quota instead of vouchers.

## Completed work

- Campaign foundation, awards foundation, and award creation in `spin_once` were implemented in earlier commits/migrations.
- Active Supabase project has migration `0005_award_creation_spin_once.sql` applied. Do not reapply production changes casually.
- Google Sheets webhook sync is implemented. Apps Script health endpoint returns `{"status":"ok","version":"v2-12-columns"}`. Existing recent rows that are “May Mắn Lần Sau” legitimately have empty Award/Delivery/Redemption columns.
- Local preview phone lookup is enabled; production/Zalo mode still hides manual phone entry.
- Final design spec (approved direction, implementation pending):
  - `docs/superpowers/specs/2026-08-16-reusable-campaign-admin-design.md`
  - commit `2b57181`
- Phase 1 implementation plan (not yet implemented):
  - `docs/superpowers/plans/2026-08-16-campaign-control.md`
  - commit `06a41c6`

## Immediate next step

Execute **Phase 1 — Campaign Control** from the plan. It covers only:

1. additive migration `0006_campaign_control.sql`;
2. lifecycle statuses and database single-active guard;
3. injectable backend campaign service and authenticated Admin CRUD/status routes;
4. active campaign metadata in public `/content`;
5. Admin “Sự kiện” screen;
6. focused/unit/DB/build verification.

Do not implement Excel import, cloning, participant allocations, award operations, or reports in Phase 1. Those are separate follow-up plans after Phase 1 review.

The plan requires choosing an execution mode: subagent-driven or inline. If token pressure is high, use small checkpoints and commit each task independently. Do not claim completion without running the verification commands in the plan.

## Important repository state

- Current worktree has an untracked `supabase/` directory. It was present before the latest documentation work and must not be deleted, reset, or included in unrelated commits without inspection.
- Latest commits:

```text
06a41c6 docs: plan campaign control phase
2b57181 docs: specify reusable campaign admin
42b428a docs: add webhook deployment health check
0d950d1 docs: add local preview phone lookup
6d52407 docs: refresh backend environment example
904f78b feat: sync spin results to Google Sheets webhook
```

## Environment and safety

- Backend local URL: `http://localhost:8787`; Admin Vite URL: `http://localhost:5174`.
- Backend active Supabase configuration is in `backend/.env`; never print or commit secrets.
- `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` are optional DB-integration credentials. The service-role key is secret, not public.
- Apply migrations to the isolated test project first. Use the active project only when explicitly required and never reset it.
- `GOOGLE_SHEETS_WEBHOOK_URL` is configured locally; do not expose its value in logs or commits.
- Use `apply_patch` for file edits. Preserve unrelated user changes.

## Known verification notes

- `npm --prefix backend run test:db` previously passed the enabled DB integration set after the awards migration when test credentials were configured.
- A previous full root test run had one unrelated DB integration failure caused by a Supabase JWT clock/future-issued timestamp; report it accurately if it recurs rather than masking it.
- Mini App tests/build and backend unit tests were previously passing for the completed features.

## Handoff rule

Read the Phase 1 plan, inspect current files, then work task-by-task with tests and commits. When Phase 1 is done, pause for user review before creating the separate Excel/clone implementation plan.
