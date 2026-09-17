# Campaign Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe Admin campaign lifecycle control for reusable events while preserving all legacy rows and allowing at most one active campaign.

**Architecture:** Add an additive Supabase migration that extends campaign lifecycle and enforces the single-active invariant in the database. Expose campaign CRUD, lifecycle, and active-campaign read operations through injected backend service functions and authenticated Admin routes. Add a small Campaigns screen to the existing Admin shell; the public content response exposes the active campaign but the spin/participant allocation cutover remains in the later participant-allocation phase.

**Tech Stack:** PostgreSQL/Supabase SQL migrations, Node.js 20+ ESM, Express 4, `@supabase/supabase-js`, Node built-in test runner, React 18, Vite 5.

## Global Constraints

- Historical customers, spins, awards, deliveries, and redemption timestamps remain queryable and are never reset or deleted.
- Only one campaign may have `status = 'active'` at a time; activation must be rejected when another campaign is active.
- Keep the existing single-Admin authentication model; do not add roles or invitations.
- Existing legacy rows remain attached to the seeded `legacy` campaign.
- Campaigns with transaction history are lifecycle-managed (pause/end/archive), not hard-deleted.
- Do not change Zalo permission requirements or expose service-role credentials to either web client.
- Every new backend route is protected by `requireAdmin`; public content may expose only the active campaign's non-secret metadata.
- This phase does not implement Excel import, campaign participant allocations, cloning, award status actions, or report exports.

---

## File map

- Create: `lucky-wheels/supabase/migrations/0006_campaign_control.sql` — lifecycle constraint, single-active guard, and safe status transition function.
- Create: `backend/src/campaign-service.js` — validation, normalization, and Supabase-backed campaign operations with an injectable `db`.
- Modify: `backend/src/routes/admin.routes.js` — authenticated campaign CRUD and status routes.
- Modify: `backend/src/routes/public.routes.js` — include the active campaign metadata in `/content`.
- Create: `backend/test/campaign-service.test.js` — pure validation/transition unit tests.
- Create: `backend/test/admin-campaigns.test.js` — route contract tests for authentication and campaign scoping.
- Create: `backend/test/db/phase2d.integration.test.js` — opt-in isolated Supabase lifecycle and uniqueness assertions.
- Modify: `backend/package.json` — include `phase2d.integration.test.js` in `test:db`.
- Modify: `admin-web/src/App.jsx` — Campaigns tab, create/edit form, lifecycle actions, and active-event status.
- Modify: `admin-web/src/styles.css` — only the small layout/status styles needed by the Campaigns screen.

## Task 1: Define campaign lifecycle and single-active database invariants

**Files:**
- Create: `lucky-wheels/supabase/migrations/0006_campaign_control.sql`
- Create: `backend/test/db/phase2d.integration.test.js`
- Modify: `backend/test/phase2a.integration.test.js` only if shared campaign fixtures need a helper extraction

**Interfaces:**
- Produces `public.transition_campaign(uuid, text) returns public.campaigns` for the backend service.
- Produces a partial unique index that permits only one `campaigns.status = 'active'` row.
- Keeps the fixed legacy campaign id `00000000-0000-0000-0000-000000000001` unchanged.

- [ ] **Step 1: Write the failing migration contract assertions.**

Add a source-level assertion in `phase2d.integration.test.js` before the opt-in test:

```js
const migrationPath = path.resolve(
  process.cwd(),
  "../lucky-wheels/supabase/migrations/0006_campaign_control.sql",
);

test("phase 2D migration declares lifecycle and single-active guards", async () => {
  const sql = (await fs.readFile(migrationPath, "utf8")).toLowerCase();
  for (const declaration of [
    "campaigns_status_check",
    "ended",
    "unique index",
    "status = 'active'",
    "transition_campaign",
    "for update",
  ]) {
    assert.ok(sql.includes(declaration), `missing migration declaration: ${declaration}`);
  }
});
```

- [ ] **Step 2: Run the focused contract test and verify it fails.**

Run: `npm --prefix backend test -- --test-name-pattern="phase 2D migration"`
Expected: FAIL because `0006_campaign_control.sql` does not exist yet.

- [ ] **Step 3: Add the additive migration.**

Implement these SQL operations in order:

```sql
alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'active', 'paused', 'ended', 'archived'));

create unique index if not exists campaigns_one_active_idx
  on public.campaigns ((status))
  where status = 'active';
```

Create `transition_campaign` as a `security definer` function with `set search_path = public`. It must lock the target row, validate the requested status and the transition matrix (`draft -> active`, `active -> paused|ended`, `paused -> active|ended`, `ended -> archived`, and `draft|paused -> archived`), reject archived transitions, and raise a stable `P0004` error when another active row exists. Return the updated campaign row. Revoke execution from `public`, `anon`, and `authenticated`; grant it to `service_role`.

- [ ] **Step 4: Run the contract test and verify it passes.**

Run: `npm --prefix backend test -- --test-name-pattern="phase 2D migration"`
Expected: PASS.

- [ ] **Step 5: Add the opt-in Supabase integration assertions.**

Using `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY`, create two draft fixtures with unique codes. Assert:

```js
const { data: active, error: activateError } = await db.rpc("transition_campaign", {
  p_campaign_id: firstId,
  p_status: "active",
});
assert.ifError(activateError);
assert.equal(active.id, firstId);

const { data: conflict, error: conflictError } = await db.rpc("transition_campaign", {
  p_campaign_id: secondId,
  p_status: "active",
});
assert.equal(conflict, null);
assert.equal(conflictError.code, "P0004");
```

Then pause the first campaign, activate the second, and assert that both campaign rows and all pre-existing legacy rows remain. Clean up only the two fixture campaigns in `finally`.

- [ ] **Step 6: Apply the migration twice to the isolated test project and run DB tests.**

Run:

```powershell
npx supabase db query --linked --project-ref $env:SUPABASE_TEST_PROJECT_REF --file lucky-wheels/supabase/migrations/0006_campaign_control.sql
npx supabase db query --linked --project-ref $env:SUPABASE_TEST_PROJECT_REF --file lucky-wheels/supabase/migrations/0006_campaign_control.sql
npm --prefix backend run test:db
```

Expected: both applications exit 0 and all enabled DB tests pass. Do not use production credentials.

- [ ] **Step 7: Commit the migration and tests.**

```powershell
git add lucky-wheels/supabase/migrations/0006_campaign_control.sql backend/test/db/phase2d.integration.test.js backend/test/phase2a.integration.test.js
git commit -m "feat: enforce campaign lifecycle invariants"
```

## Task 2: Add injectable campaign service and backend route contracts

**Files:**
- Create: `backend/src/campaign-service.js`
- Create: `backend/test/campaign-service.test.js`
- Create: `backend/test/admin-campaigns.test.js`
- Modify: `backend/src/routes/admin.routes.js`

**Interfaces:**
- `parseCampaignInput(body, { partial = false } = {}) -> { code, name, startsAt, endsAt, timezone }` or throws a 400-ready error.
- `listCampaigns({ db, status, includeArchived }) -> Promise<Array<Campaign>>`.
- `getCampaign({ db, id }) -> Promise<Campaign>` or throws a 404-ready error.
- `createCampaign({ db, input }) -> Promise<Campaign>`; always inserts `status: 'draft'`.
- `updateCampaign({ db, id, input }) -> Promise<Campaign>`; rejects code changes after activation/history.
- `transitionCampaign({ db, id, status }) -> Promise<Campaign>`; calls the SQL RPC and maps `P0004` to HTTP 409.
- `getActiveCampaign({ db }) -> Promise<Campaign | null>`.

- [ ] **Step 1: Write failing pure service tests.**

Cover these exact cases:

```js
test("parseCampaignInput normalizes code and defaults timezone", () => {
  assert.deepEqual(parseCampaignInput({ code: "  SPRING-2026 ", name: " Spring " }), {
    code: "SPRING-2026",
    name: "Spring",
    startsAt: null,
    endsAt: null,
    timezone: "Asia/Ho_Chi_Minh",
  });
});

test("parseCampaignInput rejects an empty name, invalid code, and inverted dates", () => {
  assert.throws(() => parseCampaignInput({ code: "bad code", name: "" }), /campaign/i);
  assert.throws(() => parseCampaignInput({ code: "OK", name: "OK", startsAt: "2026-08-20", endsAt: "2026-08-19" }), /endsAt/i);
});
```

Add a fake `db` with `from()` and `rpc()` methods to verify `getActiveCampaign` filters by `status = 'active'` and `transitionCampaign` sends `{ p_campaign_id: id, p_status: status }`.

- [ ] **Step 2: Run the service tests and verify they fail.**

Run: `npm --prefix backend test -- --test-name-pattern="campaign"`
Expected: FAIL because the service module and exports do not exist.

- [ ] **Step 3: Implement the service with explicit database boundaries.**

Use the existing `publicError` helper for status-bearing errors and this select list:

```js
const CAMPAIGN_COLUMNS = "id,code,name,status,starts_at,ends_at,timezone,created_at,updated_at";
```

`listCampaigns` must apply optional status filtering and order by `created_at desc`. `createCampaign` must insert only draft records. `updateCampaign` must fetch the current row first and reject edits to `code` when the row is `active`, `ended`, or `archived`; it must not update transaction rows. `transitionCampaign` must use the `transition_campaign` RPC rather than two client-side updates.

- [ ] **Step 4: Add authenticated Admin routes.**

Add these routes before the existing rule routes in `admin.routes.js`:

```js
router.get("/campaigns", requireAdmin, asyncRoute(async (req, res) => {
  res.json({ items: await listCampaigns({ db: supabase, status: req.query.status, includeArchived: req.query.includeArchived === "true" }) });
}));

router.post("/campaigns", requireAdmin, asyncRoute(async (req, res) => {
  res.status(201).json(await createCampaign({ db: supabase, input: req.body || {} }));
}));

router.get("/campaigns/:id", requireAdmin, asyncRoute(async (req, res) => {
  res.json(await getCampaign({ db: supabase, id: req.params.id }));
}));

router.put("/campaigns/:id", requireAdmin, asyncRoute(async (req, res) => {
  res.json(await updateCampaign({ db: supabase, id: req.params.id, input: req.body || {} }));
}));

router.post("/campaigns/:id/status", requireAdmin, asyncRoute(async (req, res) => {
  res.json(await transitionCampaign({ db: supabase, id: req.params.id, status: req.body?.status }));
}));
```

- [ ] **Step 5: Add route contract tests.**

Read `admin.routes.js` and assert each route includes `requireAdmin`, delegates to the service, and exposes no `customerId` or transaction reset behavior. Assert the status route accepts only the explicit status body rather than allowing arbitrary campaign columns.

- [ ] **Step 6: Run backend tests and verify they pass.**

Run: `npm --prefix backend test`
Expected: all existing tests plus the new service and route contract tests pass.

- [ ] **Step 7: Commit service and routes.**

```powershell
git add backend/src/campaign-service.js backend/src/routes/admin.routes.js backend/test/campaign-service.test.js backend/test/admin-campaigns.test.js
git commit -m "feat: add admin campaign lifecycle API"
```

## Task 3: Expose the active campaign to the public content contract

**Files:**
- Modify: `backend/src/routes/public.routes.js`
- Modify: `backend/test/phase1-contract.test.js`
- Modify: `backend/test/campaign-service.test.js` only if the active selector needs a shared fake-db helper

**Interfaces:**
- `/api/v1/content` adds `campaign: { id, code, name, status, startsAt, endsAt, timezone } | null`.
- The endpoint never returns service-role credentials, campaign internals, or inactive campaigns.

- [ ] **Step 1: Add a failing contract assertion.**

Extend `phase1-contract.test.js` to assert that `public.routes.js` imports or calls `getActiveCampaign` and includes a `campaign` property in the `/content` response.

- [ ] **Step 2: Run the focused contract test and verify it fails.**

Run: `npm --prefix backend test -- --test-name-pattern="content|active campaign"`
Expected: FAIL because `/content` currently returns banners, rewards, and rules only.

- [ ] **Step 3: Add the active-campaign lookup to `/content`.**

Call `getActiveCampaign({ db: supabase })` in the existing `Promise.all`/response path. Map snake_case database fields to the existing camelCase API convention. If there is no active campaign, return `campaign: null` without exposing drafts.

- [ ] **Step 4: Run backend tests.**

Run: `npm --prefix backend test`
Expected: PASS, including the new content contract assertion.

- [ ] **Step 5: Commit the public contract.**

```powershell
git add backend/src/routes/public.routes.js backend/test/phase1-contract.test.js
git commit -m "feat: expose active campaign metadata"
```

## Task 4: Add the Admin Campaigns screen and lifecycle controls

**Files:**
- Modify: `admin-web/src/App.jsx`
- Modify: `admin-web/src/styles.css`

**Interfaces:**
- The screen consumes `GET /admin/campaigns`, `POST /admin/campaigns`, `PUT /admin/campaigns/:id`, and `POST /admin/campaigns/:id/status`.
- It displays `draft`, `active`, `paused`, `ended`, and `archived` states and never offers a delete button.

- [ ] **Step 1: Add the UI contract checklist before implementation.**

The component must render:

```jsx
<button onClick={() => setTab("campaigns")}>Sự kiện</button>
<button onClick={() => createCampaign(form)}>Tạo sự kiện</button>
<button onClick={() => setStatus(item.id, "active")}>Kích hoạt</button>
<button onClick={() => setStatus(item.id, "paused")}>Tạm dừng</button>
<button onClick={() => setStatus(item.id, "ended")}>Kết thúc</button>
```

The activate action must show an explicit confirmation explaining that another active event blocks activation; it must not silently pause or delete the current event.

- [ ] **Step 2: Add a `Campaigns` component and shell tab.**

Keep the existing single-file Admin structure. Add `Campaigns` to the `page` map and add a `Sự kiện` navigation item. The form fields are code, name, start/end datetime, timezone, and status display. The list includes active-event highlighting, date window, and lifecycle action buttons. Use the existing `api` helper and error panel pattern.

- [ ] **Step 3: Add minimal styles and empty/loading/error states.**

Reuse existing `.panel`, `.items`, `.actions`, `.badge`, and `.error` classes; add only a campaign status badge or date-grid rule if the current stylesheet lacks one. Provide an empty state that directs the Admin to create the first non-legacy draft.

- [ ] **Step 4: Build the Admin web app.**

Run: `npm --prefix admin-web run build`
Expected: Vite build succeeds with no new warnings treated as errors.

- [ ] **Step 5: Commit the Admin UI.**

```powershell
git add admin-web/src/App.jsx admin-web/src/styles.css
git commit -m "feat: add campaign lifecycle admin screen"
```

## Task 5: Phase 1 verification and handoff

**Files:**
- Modify: `backend/package.json`
- Modify: `lucky-wheels/supabase/README.md` with the 0006 apply order and local verification commands

- [ ] **Step 1: Add the DB integration file to the test script.**

Append `test/db/phase2d.integration.test.js` to the existing `test:db` command without removing any prior phase test.

- [ ] **Step 2: Document migration order and safety.**

Document that 0006 is additive, must be applied after 0005, may be re-run on the isolated test project, and must not be used to delete or reset production data. Include the existing environment variable names without printing their values.

- [ ] **Step 3: Run the complete Phase 1 verification.**

Run:

```powershell
git diff --check
npm --prefix backend test
npm --prefix backend run test:db
npm --prefix admin-web run build
```

Expected: focused and existing backend tests pass, opt-in DB tests pass when test credentials are present (otherwise only the documented integration tests are skipped), and the Admin build succeeds.

- [ ] **Step 4: Review the spec against the implementation.**

Confirm that no task introduced Excel import, cloning, multi-user roles, concurrent campaigns, or historical deletion. Confirm the public response exposes only the active campaign and that legacy data remains untouched.

- [ ] **Step 5: Commit documentation and script changes.**

```powershell
git add backend/package.json lucky-wheels/supabase/README.md
git commit -m "docs: verify campaign control phase"
```

## Follow-up plans (not part of this Phase 1 plan)

After Phase 1 is reviewed in the local environment, create separate plans for:

1. **Campaign reuse:** two clone modes, campaign participants, Excel customer/voucher import, and campaign-scoped quotas.
2. **Operations:** inventory counters, award lifecycle actions, resend/void/expire, and event history.
3. **Reporting:** event-scoped analytics, XLSX/CSV export, Google Sheets campaign columns, and webhook retry visibility.
