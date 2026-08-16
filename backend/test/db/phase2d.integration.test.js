import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const migrationPath = path.resolve(
  process.cwd(),
  "../lucky-wheels/supabase/migrations/0006_campaign_control.sql",
);

test("phase 2D migration declares lifecycle and single-active guards", async () => {
  const sql = (await fs.readFile(migrationPath, "utf8")).toLowerCase();
  for (const declaration of [
    "campaigns_status_check",
    "ended",
    "unique index",
    "status = 'active'",
    "transition_campaign",
    "for update",
  ]) {
    assert.ok(sql.includes(declaration), `missing migration declaration: ${declaration}`);
  }
});

const testUrl = process.env.SUPABASE_TEST_URL;
const testKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

test(
  "transition_campaign enforces single-active constraint and state machine",
  {
    skip: !testUrl || !testKey
      ? "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for opt-in DB integration"
      : false,
  },
  async (t) => {
    const db = createClient(testUrl, testKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const testTag = `phase2d-${Date.now()}`;
    const code1 = `TEST_CMP_1_${testTag}`;
    const code2 = `TEST_CMP_2_${testTag}`;

    let firstId = null;
    let secondId = null;

    try {
      // Create two draft campaigns
      const { data: cmp1, error: err1 } = await db
        .from("campaigns")
        .insert({ code: code1, name: "Test Campaign 1", status: "draft" })
        .select("id")
        .single();
      assert.ifError(err1);
      firstId = cmp1.id;

      const { data: cmp2, error: err2 } = await db
        .from("campaigns")
        .insert({ code: code2, name: "Test Campaign 2", status: "draft" })
        .select("id")
        .single();
      assert.ifError(err2);
      secondId = cmp2.id;

      // 1. Activate first campaign
      const { data: active1, error: actErr1 } = await db.rpc("transition_campaign", {
        p_campaign_id: firstId,
        p_status: "active",
      });

      if (actErr1 && actErr1.code === "PGRST202") {
        t.skip("migration 0006_campaign_control.sql is not yet applied to the remote test database");
        return;
      }

      assert.ifError(actErr1);
      assert.equal(active1.status, "active");

      // 2. Attempting to activate second campaign must fail with P0004
      const { data: conflict, error: conflictError } = await db.rpc("transition_campaign", {
        p_campaign_id: secondId,
        p_status: "active",
      });
      assert.equal(conflict, null);
      assert.ok(conflictError);
      assert.equal(conflictError.code, "P0004");

      // 3. Pause first campaign
      const { data: paused1, error: pauseErr } = await db.rpc("transition_campaign", {
        p_campaign_id: firstId,
        p_status: "paused",
      });
      assert.ifError(pauseErr);
      assert.equal(paused1.status, "paused");

      // 4. Now second campaign can be activated
      const { data: active2, error: actErr2 } = await db.rpc("transition_campaign", {
        p_campaign_id: secondId,
        p_status: "active",
      });
      assert.ifError(actErr2);
      assert.equal(active2.status, "active");
    } finally {
      if (firstId) await db.from("campaigns").delete().eq("id", firstId);
      if (secondId) await db.from("campaigns").delete().eq("id", secondId);
    }
  },
);
