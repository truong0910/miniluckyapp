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
