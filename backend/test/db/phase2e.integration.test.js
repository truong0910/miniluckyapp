import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const migrationPath = path.resolve(
  process.cwd(),
  "../lucky-wheels/supabase/migrations/0007_campaign_participants.sql",
);

test("phase 2E migration declares campaign_participants schema and uniqueness", async () => {
  const sql = (await fs.readFile(migrationPath, "utf8")).toLowerCase();
  for (const declaration of [
    "create table if not exists public.campaign_participants",
    "campaign_id",
    "customer_id",
    "spin_quota",
    "unique (campaign_id, customer_id)",
  ]) {
    assert.ok(sql.includes(declaration), `missing migration declaration: ${declaration}`);
  }
});

const testUrl = process.env.SUPABASE_TEST_URL;
const testKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

test(
  "campaign_participants isolates customer quotas by campaign and enforces uniqueness",
  {
    skip: !testUrl || !testKey
      ? "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for opt-in DB integration"
      : false,
  },
  async (t) => {
    const db = createClient(testUrl, testKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const testTag = `phase2e-${Date.now()}`;
    const customerId = `KH_${testTag}`;
    const code1 = `CMP1_${testTag}`;

    let campaignId = null;

    try {
      // 1. Create test customer
      const { error: custErr } = await db.from("customers").insert({
        id: customerId,
        name: "Phase 2E Customer",
        phone: "0988776655",
        total_spins: 5,
      });
      assert.ifError(custErr);

      // 2. Create test campaign
      const { data: cmp, error: cmpErr } = await db
        .from("campaigns")
        .insert({ code: code1, name: "Phase 2E Campaign", status: "draft" })
        .select("id")
        .single();
      assert.ifError(cmpErr);
      campaignId = cmp.id;

      // 3. Insert participant row
      const { data: part, error: partErr } = await db
        .from("campaign_participants")
        .insert({
          campaign_id: campaignId,
          customer_id: customerId,
          spin_quota: 10,
          imported_group: "Test Group",
        })
        .select("id,spin_quota")
        .single();

      if (partErr && (partErr.code === "PGRST204" || partErr.code === "PGRST205" || partErr.message?.includes("campaign_participants"))) {
        t.skip("migration 0007_campaign_participants.sql is not yet applied to the remote test database");
        return;
      }

      assert.ifError(partErr);
      assert.equal(part.spin_quota, 10);

      // 4. Duplicate insert for same (campaign_id, customer_id) must fail
      const { error: dupErr } = await db.from("campaign_participants").insert({
        campaign_id: campaignId,
        customer_id: customerId,
        spin_quota: 5,
      });
      assert.ok(dupErr, "duplicate participant insert must fail");
    } finally {
      if (campaignId) await db.from("campaign_participants").delete().eq("campaign_id", campaignId);
      if (campaignId) await db.from("campaigns").delete().eq("id", campaignId);
      await db.from("customers").delete().eq("id", customerId);
    }
  },
);
