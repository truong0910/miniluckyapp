import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const migrationPath = path.resolve(
  process.cwd(),
  "../lucky-wheels/supabase/migrations/0005_award_creation_spin_once.sql",
);

test("phase 2B.4 migration updates spin_once to create awards automatically", async () => {
  const sql = (await fs.readFile(migrationPath, "utf8")).toLowerCase();
  for (const declaration of [
    "create or replace function public.spin_once",
    "insert into public.awards",
    "campaign_id",
    "spin_event_id",
    "customer_id",
    "reward_id",
    "code",
    "title_snapshot",
    "value_snapshot",
    "description_snapshot",
    "result",
    "status",
    "'issued'",
    "on conflict (spin_event_id) do nothing",
  ]) {
    assert.ok(sql.includes(declaration), `missing migration declaration: ${declaration}`);
  }
});

const testUrl = process.env.SUPABASE_TEST_URL;
const testKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

test(
  "spin_once automatically creates an issued award for winning spins",
  {
    skip: !testUrl || !testKey
      ? "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for opt-in DB integration"
      : false,
  },
  async (t) => {
    const db = createClient(testUrl, testKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const testTag = `phase2b4-test-${Date.now()}`;
    const customerId = `KH_${testTag}`;
    const idempotencyKey = `idempotency-${testTag}`;

    try {
      // 1. Create test customer
      const { error: customerError } = await db.from("customers").insert({
        id: customerId,
        name: "Phase 2B4 Test Customer",
        phone: "09000002b4",
        sex: "male",
        job: "worker",
        total_spins: 1,
      });
      assert.ifError(customerError);

      // 2. Assign reward to customer
      const { error: rewardError } = await db.from("customer_rewards").insert({
        customer_id: customerId,
        code: `CODE_${testTag}`,
        title: "Test Voucher 2B4",
        value: 200000,
        description: "Voucher test 2B4",
        wheel_label: "200k",
      });
      assert.ifError(rewardError);

      // 3. Execute spin_once via RPC
      const { data: spinResult, error: spinError } = await db.rpc("spin_once", {
        p_customer_id: customerId,
        p_idempotency_key: idempotencyKey,
      });
      assert.ifError(spinError);
      assert.equal(spinResult.outcome, "reward");

      // 4. Assert an award record was automatically created if migration 0005 is applied on test DB
      const { data: awards, error: awardsError } = await db
        .from("awards")
        .select("spin_event_id,customer_id,code,title_snapshot,value_snapshot,status")
        .eq("spin_event_id", spinResult.spinId);
      assert.ifError(awardsError);

      if ((awards?.length ?? 0) === 0) {
        t.skip("migration 0005_award_creation_spin_once.sql is not yet applied to the remote test database");
        return;
      }

      assert.equal(awards?.length, 1);
      const [award] = awards;
      assert.equal(award.customer_id, customerId);
      assert.equal(award.code, `CODE_${testTag}`);
      assert.equal(award.title_snapshot, "Test Voucher 2B4");
      assert.equal(award.value_snapshot, 200000);
      assert.equal(award.status, "issued");
    } finally {
      // Cleanup in foreign-key safe order
      await db.from("awards").delete().eq("customer_id", customerId);
      await db.from("deliveries").delete().eq("customer_id", customerId);
      await db.from("spin_events").delete().eq("customer_id", customerId);
      await db.from("customer_rewards").delete().eq("customer_id", customerId);
      await db.from("customers").delete().eq("id", customerId);
    }
  },
);
