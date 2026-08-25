import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { finishDelivery, loadDeliveryContext } from "../../src/delivery-service.js";

const servicePath = path.resolve(process.cwd(), "src/delivery-service.js");

test("phase 2C delivery service reads awards table and updates award delivery status", async () => {
  const code = await fs.readFile(servicePath, "utf8");
  assert.ok(code.includes('from("awards")'), "loadDeliveryContext must query awards table");
  assert.ok(code.includes("status: \"delivered\""), "finishDelivery must sync award status to delivered");
});

const testUrl = process.env.SUPABASE_TEST_URL;
const testKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

test(
  "delivery process updates public.awards status to delivered upon success",
  {
    skip: !testUrl || !testKey
      ? "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for opt-in DB integration"
      : false,
  },
  async (t) => {
    const db = createClient(testUrl, testKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const testTag = `phase2c-test-${Date.now()}`;
    const customerId = `KH_${testTag}`;
    const spinId = `00000000-0000-0000-0000-${Date.now().toString(16).padStart(12, "0")}`;
    const deliveryId = `00000000-0000-0000-0001-${Date.now().toString(16).padStart(12, "0")}`;

    try {
      // 1. Create test customer
      const { error: custErr } = await db.from("customers").insert({
        id: customerId,
        name: "Phase 2C Customer",
        phone: "0911223344",
        total_spins: 1,
      });
      if (custErr && (custErr.code === "PGRST303" || custErr.message?.includes("future"))) {
        t.skip("remote Supabase clock skew (JWT issued at future)");
        return;
      }
      assert.ifError(custErr);

      // 2. Insert spin event
      const { error: spinErr } = await db.from("spin_events").insert({
        id: spinId,
        customer_id: customerId,
        spin_number: 1,
        outcome: "reward",
        reward_code: `VOUCHER_${testTag}`,
      });
      assert.ifError(spinErr);

      // 3. Insert award record
      const { error: awardErr } = await db.from("awards").insert({
        spin_event_id: spinId,
        customer_id: customerId,
        campaign_id: "00000000-0000-0000-0000-000000000001",
        code: `VOUCHER_${testTag}`,
        title_snapshot: "Phase 2C Voucher Title",
        value_snapshot: 150000,
        status: "issued",
      });
      assert.ifError(awardErr);

      // 4. Insert processing delivery
      const { error: delErr } = await db.from("deliveries").insert({
        id: deliveryId,
        spin_event_id: spinId,
        customer_id: customerId,
        channel: "zbs",
        status: "processing",
      });
      assert.ifError(delErr);

      // 5. Test loadDeliveryContext reads from awards table
      const context = await loadDeliveryContext({
        db,
        delivery: { customer_id: customerId, spin_event_id: spinId },
      });
      assert.equal(context.reward.code, `VOUCHER_${testTag}`);
      assert.equal(context.reward.title, "Phase 2C Voucher Title");
      assert.equal(context.reward.value, 150000);

      // 6. Test finishDelivery syncs award status to delivered
      await finishDelivery({
        db,
        deliveryId,
        status: "sent",
        messageId: "zbs-msg-phase2c",
      });

      const { data: updatedAward, error: getAwardErr } = await db
        .from("awards")
        .select("status,delivered_at")
        .eq("spin_event_id", spinId)
        .single();
      assert.ifError(getAwardErr);
      assert.equal(updatedAward.status, "delivered");
      assert.ok(updatedAward.delivered_at);
    } finally {
      // Cleanup
      await db.from("deliveries").delete().eq("customer_id", customerId);
      await db.from("awards").delete().eq("customer_id", customerId);
      await db.from("spin_events").delete().eq("customer_id", customerId);
      await db.from("customers").delete().eq("id", customerId);
    }
  },
);
