import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("phase 2G migration adds an additive award status reason", async () => {
  const migration = await fs.readFile(
    path.resolve(process.cwd(), "../lucky-wheels/supabase/migrations/0009_award_status_audit.sql"),
    "utf8",
  );
  assert.match(migration, /alter table public\.awards/i);
  assert.match(migration, /add column if not exists status_reason/i);
});
