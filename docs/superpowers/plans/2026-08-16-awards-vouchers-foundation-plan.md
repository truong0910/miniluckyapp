# Awards/Vouchers Foundation (Phase 2B.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable `public.awards` record for every resolvable winning spin, preserving the campaign context and immutable reward snapshots without changing spin execution, delivery, or the Mini App yet.

**Architecture:** Add an additive Supabase migration after campaign foundation (`0004_awards_vouchers_foundation.sql`). The migration creates the awards entity, backfills historical reward spin events from `customer_rewards` first and `reward_catalog` second, and makes the backfill idempotent through the unique `spin_event_id` boundary. RLS remains admin-only; participant reads and delivery integration are deferred to later phases.

**Tech Stack:** PostgreSQL/Supabase SQL migrations, Node.js `node:test`, `@supabase/supabase-js`, dotenv, npm scripts, existing Mini App Vitest suite.

## Global Constraints

- Preserve the current `spin_once`, delivery worker, `customer_rewards`, public routes, and Mini App behavior.
- Keep the migration additive and safe to rerun. Never fabricate an award when a historical reward cannot resolve a positive value/title snapshot.
- Do not print or commit Supabase URLs, service-role keys, or `.env` contents.
- Use `apply_patch` for all repository file edits.
- Run focused tests after each implementation step and full verification before claiming completion.

---

## Task 1: Add the failing migration contract test first

**Files:**
- Create: `backend/test/db/phase2b1.integration.test.js`
- Inspect: `backend/test/db/phase2a.integration.test.js`

- [ ] Add a static `node:test` case named `phase 2B.1 migration declares awards and voucher snapshots` that reads `lucky-wheels/supabase/migrations/0004_awards_vouchers_foundation.sql` and asserts declarations for:
  - `create table if not exists public.awards`;
  - campaign, spin-event, customer, and optional reward foreign keys;
  - the unique `spin_event_id` idempotency boundary;
  - the six approved statuses (`issued`, `delivering`, `delivered`, `redeemed`, `expired`, `void`);
  - snapshot fields (`code`, title, value, description, result) and issued timestamps;
  - historical reward backfill and `on conflict (spin_event_id) do nothing`;
  - indexes, `set_updated_at`, and admin-only RLS.
- [ ] Reuse the existing dotenv/opt-in test conventions, but keep the static contract independent of Supabase credentials.
- [ ] Run the focused test before creating the migration and confirm it fails because the migration file is absent.
- [ ] Commit the intentional red test as `test: define awards vouchers migration contract`.

## Task 2: Implement the additive awards migration

**Files:**
- Create: `lucky-wheels/supabase/migrations/0004_awards_vouchers_foundation.sql`

- [ ] Create `public.awards` with UUID identity, required campaign/spin-event/customer relationships, nullable reward relationship, immutable reward snapshot columns, lifecycle status check, issue/delivery/redemption/expiry timestamps, and `created_at`/`updated_at`.
- [ ] Make `spin_event_id` unique and use named constraints or equivalent declarations so one winning spin can never create duplicate awards.
- [ ] Backfill only reward spin events with a customer and non-empty reward code. Resolve snapshots from `(customer_id, reward_code)` in `customer_rewards` first, then `reward_catalog` by `reward_id`; skip rows without a valid title or positive value.
- [ ] Preserve the spin event campaign and creation timestamp. Use the existing reward result when present, otherwise a catalog-symbol triple or the standard three-star JSON fallback.
- [ ] Use `on conflict (spin_event_id) do nothing` and ensure every DDL/backfill statement is safe to rerun.
- [ ] Add customer/status and campaign/status lookup indexes, the shared `set_updated_at` trigger, and RLS with no anon/authenticated read policy and an admin-only management policy.
- [ ] Run the focused contract test and confirm it passes.
- [ ] Commit as `feat: add awards vouchers foundation migration`.

## Task 3: Add opt-in database assertions and wire the test script

**Files:**
- Modify: `backend/test/db/phase2b1.integration.test.js`
- Modify: `backend/package.json`

- [ ] Add an opt-in runtime test gated by `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` that confirms the `awards` table is queryable.
- [ ] Query existing reward spin events with a customer and reward code; for each resolvable event, assert exactly one award, matching campaign/code/value and an `issued`-compatible lifecycle status. Do not require a particular fixture ID; if the isolated project has no reward events, keep the schema check meaningful without fabricating production data.
- [ ] Keep cleanup limited to data created by this test (if any), and never delete shared fixtures.
- [ ] Add `phase2b1.integration.test.js` to `backend`'s `test:db` script after the existing phase 1 and phase 2A tests.
- [ ] Run the focused test and the complete `npm --prefix backend run test:db` suite.
- [ ] Commit as `test: verify awards backfill and idempotency`.

## Task 4: Apply and rerun the migration on the isolated Supabase test project

**Files:**
- No committed file changes expected; generated `.temp` metadata must remain ignored/removed.

- [ ] Apply `0004_awards_vouchers_foundation.sql` with the authenticated Supabase CLI linked to the isolated test project, using the project ref parsed from local `backend/.env` without printing secrets.
- [ ] Run `npm --prefix backend run test:db` with the test-project environment loaded.
- [ ] Apply the same migration a second time and rerun the DB suite to verify DDL and backfill idempotency.
- [ ] Remove any CLI-generated `.temp` files or redundant ignore-file changes with `apply_patch`; leave `.env` untracked.

## Task 5: Verify the complete repository and hand off

**Files:**
- No further source changes expected unless verification exposes a real defect.

- [ ] Run `npm --prefix backend test` and confirm all backend unit/integration tests pass.
- [ ] Run `npm --prefix lucky-wheels test -- --run` and confirm the Mini App suite passes unchanged.
- [ ] Run `git diff --check` and inspect `git status --short` for only intended commits/clean working tree.
- [ ] Record that Phase 2B.1 deliberately does not expose participant award reads, alter delivery, or wire the UI; those remain Phase 2B.2/2B.3 work.
- [ ] Publish the implementation branch only after verification and user approval of the resulting commit scope.

## Expected verification commands

```powershell
npm --prefix backend test -- --test-name-pattern="phase 2B.1 migration declares"
npm --prefix backend run test:db
npm --prefix backend test
npm --prefix lucky-wheels test -- --run
git diff --check
```
