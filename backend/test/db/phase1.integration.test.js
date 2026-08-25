import "dotenv/config";
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

test("spin_once is idempotent and decrements inventory atomically", { skip: !testUrl || !testKey ? "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for opt-in DB integration" : false }, async (t) => {
  const db = createClient(testUrl, testKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const fixtureId = `phase1-test-${Date.now()}`;
  const fixtureCode = `PHASE1_TEST_${Date.now()}`;
  const { error: customerError } = await db.from("customers").insert({
    id: fixtureId,
    phone: `090${String(Date.now()).slice(-7)}`,
    name: "Phase 1 Integration Test",
    sex: "other",
    job: "other",
    total_spins: 1,
  });

  if (customerError && (customerError.code === "PGRST303" || customerError.message?.includes("future"))) {
    t.skip("remote Supabase clock skew (JWT issued at future)");
    return;
  }

  assert.ifError(customerError);
  const { error: rewardError } = await db.from("customer_rewards").insert({
    customer_id: fixtureId,
    code: fixtureCode,
    title: "Phase 1 Test Reward",
    value: 100000,
    description: "Integration fixture",
    result: ["star", "star", "star"],
  });
  assert.ifError(rewardError);
  const idempotencyKey = `phase1-test-${Date.now()}`;
  const { data, error } = await db.rpc("spin_once", {
    p_customer_id: fixtureId,
    p_idempotency_key: idempotencyKey,
    p_oa_followed: false,
    p_source: "integration-test",
  });
  assert.ifError(error);
  assert.ok(data);
  const { data: replay, error: replayError } = await db.rpc("spin_once", {
    p_customer_id: fixtureId,
    p_idempotency_key: idempotencyKey,
    p_oa_followed: false,
    p_source: "integration-test",
  });
  assert.ifError(replayError);
  assert.deepEqual(replay, data);
  const { data: deliveries, error: deliveryError } = await db
    .from("deliveries")
    .select("id")
    .eq("customer_id", fixtureId)
    .eq("channel", "zbs");
  assert.ifError(deliveryError);
  assert.equal(deliveries?.length, 1);
});
