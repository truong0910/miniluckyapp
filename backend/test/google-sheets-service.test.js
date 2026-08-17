import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { buildGoogleSheetsPayload, postSpinToGoogleSheets, syncSpinToGoogleSheets } from "../src/google-sheets-service.js";

test("Apps Script appends campaign context columns", async () => {
  const script = await fs.readFile(path.resolve(process.cwd(), "../docs/google-sheets-webhook-doPost.gs"), "utf8");
  assert.match(script, /data\.campaignId/);
  assert.match(script, /data\.campaignName/);
});

test("buildGoogleSheetsPayload matches the Apps Script doPost contract", () => {
  const payload = buildGoogleSheetsPayload({
    spin: {
      spinId: "spin-1",
      timestamp: "2026-08-16T07:00:00.000Z",
      outcome: "reward",
      reward: { value: 5000000, title: "Voucher 5M", code: "V-1" },
    },
    customer: { name: "Nguyễn Văn A", phone: "0900000000" },
    award: { id: "award-1", status: "issued", delivered_at: null, redeemed_at: null },
    campaign: { id: "camp-1", code: "SUMMER_2026", name: "Sự kiện Hè 2026" },
  });

  assert.deepEqual(payload, {
    spinId: "spin-1",
    awardId: "award-1",
    campaignId: "camp-1",
    campaignCode: "SUMMER_2026",
    campaignName: "Sự kiện Hè 2026",
    timestamp: "2026-08-16T07:00:00.000Z",
    customerName: "Nguyễn Văn A",
    phone: "0900000000",
    outcome: "reward",
    rewardValue: 5000000,
    rewardTitle: "Voucher 5M",
    rewardCode: "V-1",
    status: "issued",
    deliveredAt: null,
    redeemedAt: null,
  });
});

test("postSpinToGoogleSheets sends JSON with an idempotency key", async () => {
  const calls = [];
  const result = await postSpinToGoogleSheets({
    webhookUrl: "https://script.google.com/macros/s/test/exec",
    payload: { spinId: "spin-1", outcome: "better_luck" },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ status: "success" }), { status: 200 });
    },
  });

  assert.equal(result.status, "sent");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["X-Idempotency-Key"], "spin-1");
  assert.deepEqual(JSON.parse(calls[0].options.body), { spinId: "spin-1", outcome: "better_luck" });
});

test("syncSpinToGoogleSheets loads server-owned customer and award fields", async () => {
  const calls = [];
  const db = {
    from(table) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        async maybeSingle() {
          if (table === "customers") return { data: { name: "Customer", phone: "0912345678" }, error: null };
          return { data: { id: "award-1", status: "issued", delivered_at: null, redeemed_at: null }, error: null };
        },
      };
      return chain;
    },
  };
  await syncSpinToGoogleSheets({
    db,
    spin: { spinId: "spin-1", outcome: "better_luck", timestamp: "2026-08-16T07:00:00.000Z" },
    customerId: "customer-1",
    config: { googleSheetsWebhookUrl: "https://script.google.com/macros/s/test/exec", googleSheetsWebhookTimeoutMs: 1000 },
    fetchImpl: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ status: "success" }), { status: 200 });
    },
  });
  assert.equal(calls[0].customerName, "Customer");
  assert.equal(calls[0].phone, "0912345678");
  assert.equal(calls[0].awardId, "award-1");
});
