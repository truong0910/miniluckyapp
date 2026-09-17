import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "../lucky-wheels/supabase/migrations/0012_remove_demo_seed_data.sql",
);

test("phase 2J removes only unused demo customers and preserves historical rows", async () => {
  const sql = (await fs.readFile(migrationPath, "utf8")).toLowerCase();

  assert.match(sql, /kh001/);
  assert.match(sql, /kh002/);
  assert.match(sql, /kh003/);
  assert.match(sql, /delete\s+from\s+public\.customer_rewards/);
  assert.match(sql, /delete\s+from\s+public\.customers/);
  assert.match(sql, /not\s+exists\s*\(\s*select\s+1\s+from\s+public\.spin_events/s);
  assert.match(sql, /deleted_at/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.reward_catalog/);
});
