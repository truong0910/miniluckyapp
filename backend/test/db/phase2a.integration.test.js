import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const migrationPath = path.resolve(
  process.cwd(),
  "../lucky-wheels/supabase/migrations/0003_campaign_foundation.sql",
);

test("phase 2A migration declares campaign ownership and legacy backfill", async () => {
  const sql = (await fs.readFile(migrationPath, "utf8")).toLowerCase();
  for (const declaration of [
    "create table if not exists public.campaigns",
    "code text not null unique",
    "legacy",
    "alter table public.campaign_rules add column if not exists campaign_id",
    "alter table public.customer_rewards add column if not exists campaign_id",
    "alter table public.spin_events add column if not exists campaign_id",
    "campaign_rules_campaign_id_fkey",
    "customer_rewards_campaign_id_fkey",
    "spin_events_campaign_id_fkey",
    "set campaign_id =",
    "set not null",
    "enable row level security",
  ]) {
    assert.ok(sql.includes(declaration), `missing migration declaration: ${declaration}`);
  }
});

const testUrl = process.env.SUPABASE_TEST_URL;
const testKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

test("legacy campaign defaults are applied to fixture rewards and spin events", { skip: !testUrl || !testKey ? "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for opt-in DB integration" : false }, async (t) => {
  const db = createClient(testUrl, testKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const fixtureKey = `${Date.now()}-${process.pid}`;
  const fixtureId = `phase2a-test-${fixtureKey}`;
  const fixtureCode = `PHASE2A_TEST_${fixtureKey}`;
  const idempotencyKey = `phase2a-test-${fixtureKey}`;
  const legacyId = "00000000-0000-0000-0000-000000000001";

  try {
    const { error: customerError } = await db.from("customers").insert({
      id: fixtureId,
      phone: `090${randomUUID().replace(/\D/g, "").slice(0, 7)}`,
      name: "Phase 2A Integration Test",
      sex: "other",
      job: "other",
      total_spins: 1,
    });
    if (customerError?.code === "PGRST303" || customerError?.message?.includes("future")) {
      t.skip("remote Supabase clock skew (JWT issued at future)");
      return;
    }
    assert.ifError(customerError);

    const { error: rewardError } = await db.from("customer_rewards").insert({
      customer_id: fixtureId,
      code: fixtureCode,
      title: "Phase 2A Test Reward",
      value: 100000,
      description: "Integration fixture",
      result: ["star", "star", "star"],
    });
    assert.ifError(rewardError);

    const { data: rewardRow, error: rewardLookupError } = await db
      .from("customer_rewards")
      .select("campaign_id")
      .eq("customer_id", fixtureId)
      .eq("code", fixtureCode)
      .single();
    assert.ifError(rewardLookupError);
    assert.equal(rewardRow.campaign_id, legacyId);

    const { error: spinError } = await db.rpc("spin_once", {
      p_customer_id: fixtureId,
      p_idempotency_key: idempotencyKey,
      p_oa_followed: false,
      p_source: "phase2a-integration-test",
    });
    assert.ifError(spinError);

    const { data: eventRow, error: eventLookupError } = await db
      .from("spin_events")
      .select("campaign_id")
      .eq("customer_id", fixtureId)
      .eq("idempotency_key", idempotencyKey)
      .single();
    assert.ifError(eventLookupError);
    assert.equal(eventRow.campaign_id, legacyId);
  } finally {
    await db.from("spin_events").delete().eq("customer_id", fixtureId);
    await db.from("customers").delete().eq("id", fixtureId);
  }
});
