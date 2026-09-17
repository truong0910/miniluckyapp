# Participant Awards API (Phase 2B.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a participant-scoped, paginated awards API backed by the durable `public.awards` snapshots, with tests proving session-based identity isolation and safe response mapping.

**Architecture:** Keep `public.routes.js` thin: the route authenticates through `requireParticipant`, validates pagination, and delegates to a focused `award-service.js`. The service filters only by the server-resolved participant customer ID, orders by `issued_at DESC, id DESC`, fetches one extra row for `hasMore`, and maps database snake_case snapshots to the participant-safe camelCase contract. The Mini App, spin RPC, delivery worker, and awards migration remain unchanged.

**Tech Stack:** Node.js ESM, Express, Supabase JS query builder, `node:test`, strict assertions, dotenv, existing backend DB integration suite.

## Global Constraints

- Use `GET /api/v1/participant/me/awards` with the existing `requireParticipant` middleware.
- Never accept customer identity from URL parameters, query parameters, request bodies, or client-supplied headers.
- Return only `id`, `campaignId`, `spinEventId`, `rewardId`, `code`, `title`, `value`, `description`, `result`, `status`, `issuedAt`, `deliveredAt`, `redeemedAt`, and `expiresAt` for each award.
- `page` defaults to `1` and is valid only from `1` through `100`; `limit` defaults to `20` and is valid only from `1` through `50`.
- Query at most `limit + 1` rows ordered by `issued_at DESC, id DESC`; response shape is `{ items, page, limit, hasMore }`.
- Keep award reads service-role-backed inside the Backend; do not change RLS, `spin_once`, delivery, redemption, expiry processing, or Mini App UI.
- Invalid pagination returns the existing public `400` error shape; missing/revoked/expired participant sessions return `401`; empty history returns `200` with an empty `items` array.
- Use `apply_patch` for repository edits, keep secrets out of output/commits, and run focused tests before broad suites.

---

## Task 1: Define the award service contract with failing unit tests

**Files:**
- Create: `backend/test/participant-awards.test.js`
- Inspect: `backend/src/utils.js`, `backend/test/spin-service.test.js`

**Interfaces:**
- The tests will consume `parseAwardsPagination(query)` and
  `listParticipantAwards({ db, customerId, page, limit })` from
  `backend/src/award-service.js`.
- `listParticipantAwards` must return `{ items, page, limit, hasMore }` and
  map database fields exactly as the Global Constraints specify.

- [ ] Write a test for default pagination: `{}` becomes `{ page: 1, limit: 20 }`.
- [ ] Write tests that reject non-integers, zero/negative values, page above `100`, and limit above `50` with an error carrying status `400`.
- [ ] Add a deterministic fake Supabase query builder that records `from`, `select`, `eq`, both `order` calls, and `range` arguments, then returns three rows for a requested limit of `2`.
- [ ] Assert the service filters with `eq("customer_id", "customer-a")`, requests `range(0, 2)`, orders `issued_at` descending then `id` descending, trims the extra row, sets `hasMore: true`, and maps `title_snapshot`, `value_snapshot`, lifecycle timestamps, and `result` to camelCase.
- [ ] Add a second-page test asserting `range(2, 4)` for page `2`, preserving deterministic ordering and returning `hasMore: false` when only two rows are returned.
- [ ] Run `node --test backend/test/participant-awards.test.js` and confirm it fails because `backend/src/award-service.js` does not exist.
- [ ] Commit the intentional red tests as `test: define participant awards service contract`.

## Task 2: Implement pagination, customer scoping, and snapshot mapping

**Files:**
- Create: `backend/src/award-service.js`
- Test: `backend/test/participant-awards.test.js`

**Interfaces:**
- Produces `parseAwardsPagination(query)` and
  `listParticipantAwards({ db, customerId, page, limit })` for the route task.

- [ ] Implement `parseAwardsPagination` with integer-only parsing, defaults
  `{ page: 1, limit: 20 }`, bounds `1..100` and `1..50`, and `publicError` for
  invalid values.
- [ ] Implement the Supabase query using exactly these columns:
  `id,campaign_id,spin_event_id,reward_id,code,title_snapshot,value_snapshot,description_snapshot,result,status,issued_at,delivered_at,redeemed_at,expires_at`.
- [ ] Apply `eq("customer_id", customerId)`, `order("issued_at", { ascending: false })`, `order("id", { ascending: false })`, and `range((page - 1) * limit, (page - 1) * limit + limit)` to fetch `limit + 1` rows.
- [ ] Throw Supabase errors unchanged for the existing route error handler; never return raw database rows.
- [ ] Map each row to camelCase, convert `value_snapshot` to a number, default nullable `reward_id`/timestamps to `null`, default description to `""`, and preserve the stored `result` array.
- [ ] Return only the first `limit` mapped rows plus `hasMore = rows.length > limit`.
- [ ] Run the focused service tests and confirm all cases pass.
- [ ] Commit as `feat: add participant awards query service`.

## Task 3: Add the authenticated participant route and static route contract

**Files:**
- Modify: `backend/src/routes/public.routes.js`
- Create: `backend/test/participant-awards-route.contract.test.js`

**Interfaces:**
- The route consumes `req.participant.customerId`, `parseAwardsPagination(req.query)`, and `listParticipantAwards({ db: supabase, customerId, page, limit })`.
- It produces `GET /api/v1/participant/me/awards` with the service response as JSON.

- [ ] Add a failing static contract test that reads `public.routes.js` and asserts the route declaration includes `requireParticipant`, calls `parseAwardsPagination`, calls `listParticipantAwards`, and does not read `req.query.customerId`, `req.body.customerId`, or a route `:id`.
- [ ] Run the focused route contract test and confirm it fails before the route exists.
- [ ] Import `parseAwardsPagination` and `listParticipantAwards` from `../award-service.js`.
- [ ] Add `router.get("/participant/me/awards", requireParticipant, asyncRoute(async (req, res) => { ... }))`; validate query pagination, use only `req.participant.customerId`, and `res.json(await listParticipantAwards(...))`.
- [ ] Keep the route read-only and leave `/participant/me`, `/participant/me/spins`, `/spins`, and delivery routes unchanged.
- [ ] Run the route contract and service tests together; commit as `feat: expose participant awards endpoint`.

## Task 4: Add opt-in database scoping coverage and wire `test:db`

**Files:**
- Create: `backend/test/db/phase2b2.integration.test.js`
- Modify: `backend/package.json`
- Inspect: `backend/test/db/phase2b1.integration.test.js`

**Interfaces:**
- The integration test consumes `listParticipantAwards` with a service-role Supabase client and uses the same response-equivalent mapping as the route.

- [ ] Add a static migration-independent test that confirms the participant awards service contract is present and the new endpoint remains separate from `spin_once`/delivery behavior.
- [ ] Add an opt-in runtime test gated by `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY`; if `public.awards` is unavailable, skip with the existing opt-in reason rather than exposing secrets.
- [ ] When enabled, create two uniquely named customers, two spin events under the legacy campaign UUID, and one award per customer with distinct codes/snapshots. Call `listParticipantAwards` separately for each customer and assert each sees exactly its own award, correct snapshot/status fields, and no other customer's ID/code.
- [ ] Clean up only the inserted awards, spin events, and customers in `finally`, in foreign-key-safe order; never delete existing fixtures.
- [ ] Add `phase2b2.integration.test.js` after phase 2B.1 in `backend`'s `test:db` script and use `--test-concurrency=1` for deterministic DB fixture ordering.
- [ ] Run the focused integration test and `npm --prefix backend run test:db`; both must pass when the isolated test project has migration 0004 applied, while the runtime case remains skipped without opt-in credentials.
- [ ] Commit as `test: verify participant awards isolation`.

## Task 5: Verify the complete repository and hand off

**Files:**
- No further source changes expected unless verification exposes a concrete defect.

- [ ] Run `npm --prefix backend test` and confirm all backend unit and contract tests pass.
- [ ] Run `npm --prefix backend run test:db` and confirm phase 1, phase 2A, phase 2B.1, and phase 2B.2 integration tests pass against the isolated project.
- [ ] Run `npm --prefix lucky-wheels test -- --run` and confirm the Mini App suite remains unchanged and passing.
- [ ] Run `git diff --check`, inspect `git status --short`, and verify only the intended service, route, tests, package script, and spec/plan commits exist.
- [ ] Record that Mini App UI wiring, award creation inside `spin_once`, delivery integration, redemption, and expiry remain later phases.
- [ ] Request final whole-branch review before offering merge/push/keep-as-is options.

## Expected verification commands

```powershell
node --test backend/test/participant-awards.test.js backend/test/participant-awards-route.contract.test.js
npm --prefix backend run test:db
npm --prefix backend test
npm --prefix lucky-wheels test -- --run
git diff --check
```
