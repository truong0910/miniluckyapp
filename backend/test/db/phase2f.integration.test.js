import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "../lucky-wheels/supabase/migrations/0008_campaign_spin_isolation.sql",
);

test("phase 2F migration declares campaign-isolated spin_once RPC", async () => {
  const sql = (await fs.readFile(migrationPath, "utf8")).toLowerCase();
  for (const declaration of [
    "create or replace function public.spin_once",
    "campaign_participants",
    "status = 'active'",
    "v_campaign_id",
    "v_allowed_spins",
  ]) {
    assert.ok(sql.includes(declaration), `missing migration declaration: ${declaration}`);
  }
});

test("phase 2F does not grant a new campaign's quota to unregistered customers", async () => {
  const sql = (await fs.readFile(migrationPath, "utf8")).toLowerCase();
  assert.match(
    sql,
    /if not found then\s*if v_campaign_id = '00000000-0000-0000-0000-000000000001'::uuid\s*then[\s\S]*?else[\s\S]*?raise exception/,
  );
});
