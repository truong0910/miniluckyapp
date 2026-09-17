import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("forward migration enables both auth methods and keeps ZBS delivery atomic with the award", async () => {
  const migrationPath = path.resolve(process.cwd(), "../lucky-wheels/supabase/migrations/0018_dual_auth_zbs_delivery.sql");
  const sql = await fs.readFile(migrationPath, "utf8");

  assert.match(sql, /auth_method in \('preview',\s*'zalo',\s*'phone'\)/i);
  assert.match(sql, /registration_source in \([^)]*'phone_guest'/i);
  assert.match(sql, /create or replace function public\.spin_once\(\s*p_customer_id text,\s*p_idempotency_key text,\s*p_source text/i);
  assert.match(sql, /insert into public\.deliveries/i);
  assert.doesNotMatch(sql, /if\s+v_rule\.oa_required/i);
  assert.doesNotMatch(sql, /delete\s+from public\.(customers|participant_sessions|awards|deliveries)/i);
  assert.match(sql, /drop function if exists public\.spin_once\(text, text, boolean, text\)/i);
});
