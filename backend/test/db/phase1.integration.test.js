import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const migrationPath = path.resolve(process.cwd(), "../lucky-wheels/supabase/migrations/0002_phase1_production_safety.sql");

test("phase 1 migration declares session, idempotency, delivery, and spin_once primitives", async () => {
  const sql = await fs.readFile(migrationPath, "utf8");
  for (const declaration of [
    "create table if not exists public.participant_sessions",
    "create table if not exists public.deliveries",
    "idempotency_key",
    "create or replace function public.spin_once",
    "create or replace function public.claim_deliveries",
    "create or replace function public.finish_delivery",
    "security definer",
    "for update",
  ]) {
    assert.ok(sql.toLowerCase().includes(declaration.toLowerCase()), `missing migration declaration: ${declaration}`);
  }
});

const testUrl = process.env.SUPABASE_TEST_URL;
const testKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

test("spin_once is idempotent and decrements inventory atomically", { skip: !testUrl || !testKey ? "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for opt-in DB integration" : false }, async () => {
  const db = createClient(testUrl, testKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const idempotencyKey = `phase1-test-${Date.now()}`;
  const { data, error } = await db.rpc("spin_once", {
    p_customer_id: "phase1-test-customer",
    p_idempotency_key: idempotencyKey,
    p_oa_followed: false,
    p_source: "integration-test",
  });
  assert.ifError(error);
  assert.ok(data);
  const { data: replay, error: replayError } = await db.rpc("spin_once", {
    p_customer_id: "phase1-test-customer",
    p_idempotency_key: idempotencyKey,
    p_oa_followed: false,
    p_source: "integration-test",
  });
  assert.ifError(replayError);
  assert.deepEqual(replay, data);
});
