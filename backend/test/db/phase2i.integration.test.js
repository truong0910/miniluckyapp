import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("phase 2I migration makes spin_event_id nullable on public.awards", async () => {
  const migration = await fs.readFile(
    path.resolve(process.cwd(), "../lucky-wheels/supabase/migrations/0011_make_spin_event_id_nullable.sql"),
    "utf8",
  );
  assert.match(migration, /ALTER TABLE public\.awards/i);
  assert.match(migration, /ALTER COLUMN spin_event_id DROP NOT NULL/i);
});
