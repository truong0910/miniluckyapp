import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("phase 2H migration declares unlisted customer access policy and registration source", async () => {
  const migration = await fs.readFile(
    path.resolve(process.cwd(), "../lucky-wheels/supabase/migrations/0010_unlisted_customer_access.sql"),
    "utf8",
  );
  assert.match(migration, /allow_unlisted boolean/i);
  assert.match(migration, /unlisted_spin_quota integer/i);
  assert.match(migration, /registration_source text/i);
  assert.match(migration, /campaign_rules_scope_check/i);
});
