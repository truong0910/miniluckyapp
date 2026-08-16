# Campaign Foundation (Phase 2A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class `campaigns` table and attach existing rules, assigned rewards, and spin events to a deterministic `legacy` campaign without changing current spin behavior.

**Architecture:** Add one additive Supabase migration after the two Phase 1 migrations. The migration creates a fixed-id active `legacy` row, adds campaign foreign keys with a legacy default, backfills existing rows, and adds RLS/indexes. Backend behavior remains unchanged because existing inserts omit `campaign_id` and PostgreSQL supplies the default; integration tests verify both the schema contract and the resulting spin-event ownership.

**Tech Stack:** PostgreSQL/Supabase SQL migrations, Node.js `node:test`, `@supabase/supabase-js`, npm scripts, Git.

## Global Constraints

- Migration file: `lucky-wheels/supabase/migrations/0003_campaign_foundation.sql`.
- Legacy campaign id is exactly `00000000-0000-0000-0000-000000000001` and code is exactly `legacy`.
- Attached tables are exactly `campaign_rules`, `customer_rewards`, and `spin_events`.
- Existing `spin_once` selection, inventory decrement, idempotency, delivery creation, and API payloads must not change.
- The migration must be safe to re-run and must backfill before enforcing `NOT NULL` and foreign keys.
- No Zalo credentials, production deployment, Admin UI changes, or campaign CRUD routes are part of this plan.
- Never stage `.env`, service-role keys, build output, or `node_modules`.

---

### Task 1: Add the failing campaign migration contract test

**Files:**
- Create: `backend/test/db/phase2a.integration.test.js`
- Read: `lucky-wheels/supabase/migrations/0003_campaign_foundation.sql`

**Interfaces:**
- Produces a static migration contract test that later tasks must satisfy.
- Does not connect to Supabase for the static test; the DB test in Task 4 handles runtime behavior.

- [ ] **Step 1: Write the failing test**

Create a Node test that reads `0003_campaign_foundation.sql` and asserts the migration contains these case-insensitive declarations:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "../lucky-wheels/supabase/migrations/0003_campaign_foundation.sql",
);

test("phase 2A migration declares campaign ownership and legacy backfill", async () => {
  const sql = (await fs.readFile(migrationPath, "utf8")).toLowerCase();
  for (const declaration of [
    "create table if not exists public.campaigns",
    "code text not null unique",
    "legacy",
    "alter table public.campaign_rules add column if not exists campaign_id",
    "alter table public.customer_rewards add column if not exists campaign_id",
    "alter table public.spin_events add column if not exists campaign_id",
    "campaign_rules_campaign_id_fkey",
    "customer_rewards_campaign_id_fkey",
    "spin_events_campaign_id_fkey",
    "set campaign_id =",
    "set not null",
    "enable row level security",
  ]) {
    assert.ok(sql.includes(declaration), `missing migration declaration: ${declaration}`);
  }
});
```

- [ ] **Step 2: Run the test and verify it fails for the expected reason**

Run:

```bash
npm --prefix backend test -- --test-name-pattern="phase 2A migration declares"
```

Expected: FAIL because `0003_campaign_foundation.sql` does not exist yet. Do not create the migration before observing this failure.

- [ ] **Step 3: Commit the red test**

```bash
git add backend/test/db/phase2a.integration.test.js
git commit -m "test: define campaign foundation migration contract"
```

### Task 2: Implement the additive campaign foundation migration

**Files:**
- Create: `lucky-wheels/supabase/migrations/0003_campaign_foundation.sql`

**Interfaces:**
- Creates `public.campaigns` and the fixed legacy row.
- Adds `campaign_id` to `campaign_rules`, `customer_rewards`, and `spin_events`.
- Preserves existing callers through the legacy default UUID.

- [ ] **Step 1: Create the campaigns table and legacy row**

Use this schema and fixed compatibility row:

```sql
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

insert into public.campaigns (id, code, name, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'legacy',
  'Legacy campaign',
  'active'
)
on conflict (id) do update
set code = excluded.code,
    name = excluded.name,
    status = excluded.status;
```

- [ ] **Step 2: Add and backfill campaign columns**

For each attached table, add the column if missing, update null rows to the fixed legacy id, then set the default and `NOT NULL`:

```sql
alter table public.campaign_rules
  add column if not exists campaign_id uuid;
update public.campaign_rules
set campaign_id = '00000000-0000-0000-0000-000000000001'
where campaign_id is null;
alter table public.campaign_rules
  alter column campaign_id set default '00000000-0000-0000-0000-000000000001',
  alter column campaign_id set not null;
```

Repeat the same three statements for `customer_rewards` and `spin_events`.

- [ ] **Step 3: Add idempotent foreign keys, indexes, trigger, and RLS**

Use named constraints guarded by `pg_constraint` checks so the migration can be applied more than once. Add these indexes:

```sql
create index if not exists campaigns_status_window_idx
  on public.campaigns (status, starts_at, ends_at);
create index if not exists campaign_rules_campaign_idx
  on public.campaign_rules (campaign_id, active, priority desc);
create index if not exists customer_rewards_campaign_idx
  on public.customer_rewards (campaign_id, customer_id, created_at);
create index if not exists spin_events_campaign_idx
  on public.spin_events (campaign_id, created_at desc);
```

Create the existing `set_updated_at` trigger for `campaigns`, enable RLS, and add policies named `public can read active campaigns` and `admins manage campaigns`. Drop those policy names before recreating them so re-running the migration does not fail.

- [ ] **Step 4: Run the focused contract test and verify it passes**

Run:

```bash
npm --prefix backend test -- --test-name-pattern="phase 2A migration declares"
```

Expected: PASS.

- [ ] **Step 5: Commit the migration**

```bash
git add lucky-wheels/supabase/migrations/0003_campaign_foundation.sql
git commit -m "feat: add campaign foundation migration"
```

### Task 3: Add runtime campaign defaults to the DB integration fixture

**Files:**
- Modify: `backend/test/db/phase2a.integration.test.js`

**Interfaces:**
- Consumes `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` when both are configured.
- Produces assertions that omitted campaign ids resolve to the legacy campaign.

- [ ] **Step 1: Write the failing runtime assertions**

Add an opt-in test with a unique customer and reward. Insert the reward without `campaign_id`, call `spin_once` once, then query the fixture reward and spin event:

```js
const legacyId = "00000000-0000-0000-0000-000000000001";
const { data: rewardRow, error: rewardLookupError } = await db
  .from("customer_rewards")
  .select("campaign_id")
  .eq("customer_id", fixtureId)
  .eq("code", fixtureCode)
  .single();
assert.ifError(rewardLookupError);
assert.equal(rewardRow.campaign_id, legacyId);

const { data: eventRow, error: eventLookupError } = await db
  .from("spin_events")
  .select("campaign_id")
  .eq("customer_id", fixtureId)
  .eq("idempotency_key", idempotencyKey)
  .single();
assert.ifError(eventLookupError);
assert.equal(eventRow.campaign_id, legacyId);
```

- [ ] **Step 2: Run the runtime test and verify it fails before migration is applied**

Run:

```bash
npm --prefix backend test -- --test-name-pattern="legacy campaign defaults"
```

Expected with an already migrated test project: FAIL because the new columns/table are not present. If test credentials are not configured, the test must be reported as skipped with the existing opt-in message rather than inventing credentials.

- [ ] **Step 3: Keep fixture cleanup safe and bounded**

Wrap the fixture assertions in `try/finally` and delete only the generated customer id through the service-role client. The customer cascade removes its reward and spin rows; never delete the whole table or the legacy campaign.

- [ ] **Step 4: Commit the red runtime test**

```bash
git add backend/test/db/phase2a.integration.test.js
git commit -m "test: verify legacy campaign ownership in db"
```

### Task 4: Apply and verify the migration on the isolated Supabase test project

**Files:**
- Read: `backend/.env` (never stage or print values)
- Apply: `lucky-wheels/supabase/migrations/0003_campaign_foundation.sql` through the existing Supabase test-project workflow

**Interfaces:**
- Uses only `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` for opt-in verification.
- Does not touch the production Supabase project.

- [ ] **Step 1: Apply the migration to the isolated test project**

Use the configured Supabase migration workflow or SQL editor against the test project. Confirm the target URL is the isolated test project before applying. Do not paste credentials into chat or commit them.

- [ ] **Step 2: Run the focused runtime test**

Run:

```bash
npm --prefix backend test -- --test-name-pattern="legacy campaign defaults"
```

Expected: PASS when both test variables are present; otherwise the test remains explicitly skipped.

- [ ] **Step 3: Run the full backend suite and DB integration suite**

Run:

```bash
npm --prefix backend test
npm --prefix backend run test:db
```

Expected: all backend tests pass, and the DB integration test reports pass rather than skip when test credentials are configured.

- [ ] **Step 4: Verify migration idempotency**

Apply the same `0003_campaign_foundation.sql` a second time in the test project, then rerun `npm --prefix backend run test:db`. Expected: no duplicate-row, constraint, policy, or trigger errors and the same campaign assertions pass.

### Task 5: Final verification and handoff

**Files:**
- Verify: `lucky-wheels/supabase/migrations/0003_campaign_foundation.sql`
- Verify: `backend/test/db/phase2a.integration.test.js`

- [ ] **Step 1: Run repository checks**

```bash
npm --prefix backend test
npm --prefix backend run test:db
npm --prefix lucky-wheels test -- --run
git diff --check
git status --short
```

Expected: tests pass, DB integration is pass or explicitly skipped based on configured test credentials, `git diff --check` is clean, and no `.env`, build output, or dependency directory is staged.

- [ ] **Step 2: Commit the verified implementation**

```bash
git add backend/test/db/phase2a.integration.test.js lucky-wheels/supabase/migrations/0003_campaign_foundation.sql
git commit -m "feat: establish campaign foundation"
```

- [ ] **Step 3: Push the current branch**

```bash
git push origin agent/publish-production-safety
```

Report the migration filename, test results, whether the isolated DB test ran or skipped, and the commit hash. Do not claim production readiness; Phase 2A does not yet add campaign-aware Admin APIs or awards/vouchers.
