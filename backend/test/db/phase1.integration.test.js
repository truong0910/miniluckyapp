import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { prepareAssignedRewardSpin } from "./assigned-spin-fixture.js";

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

test("spin_once is idempotent and queues one reward delivery", { skip: !testUrl || !testKey ? "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for opt-in DB integration" : false }, async (t) => {
  const db = createClient(testUrl, testKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const fixtureTag = `phase1-test-${Date.now()}-${process.pid}`;
  const fixtureId = fixtureTag;
  const idempotencyKey = `${fixtureTag}-idempotency`;

  try {
    const fixture = await prepareAssignedRewardSpin({
      db,
      t,
      customerId: fixtureId,
      fixtureTag,
      customerName: "Phase 1 Integration Test",
      rewardTitle: "Phase 1 Test Reward",
      rewardValue: 100000,
      rewardDescription: "Integration fixture",
    });
    if (!fixture) return;
    const { data, error } = await db.rpc("spin_once", {
      p_customer_id: fixtureId,
      p_idempotency_key: idempotencyKey,
      p_source: "integration-test",
    });
    assert.ifError(error);
    assert.ok(data);
    assert.equal(data.outcome, "reward");
    const { data: spinEvent, error: spinEventError } = await db
      .from("spin_events")
      .select("reward_code")
      .eq("id", data.spinId)
      .single();
    assert.ifError(spinEventError);
    assert.equal(spinEvent.reward_code, fixture.rewardCode);
    const { data: replay, error: replayError } = await db.rpc("spin_once", {
      p_customer_id: fixtureId,
      p_idempotency_key: idempotencyKey,
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
  } finally {
    await db.from("awards").delete().eq("customer_id", fixtureId);
    await db.from("deliveries").delete().eq("customer_id", fixtureId);
    await db.from("spin_events").delete().eq("customer_id", fixtureId);
    await db.from("customer_rewards").delete().eq("customer_id", fixtureId);
    await db.from("campaign_participants").delete().eq("customer_id", fixtureId);
    await db.from("customers").delete().eq("id", fixtureId);
  }
});
