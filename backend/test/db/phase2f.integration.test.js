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
