import test from "node:test";
import assert from "node:assert/strict";
import { claimDeliveryBatch, loadDeliveryContext, sendDelivery } from "../src/delivery-service.js";
import { processDelivery, retryDelayMs } from "../src/delivery-worker.js";

test("claimDeliveryBatch claims a bounded batch through the database RPC", async () => {
  const calls = [];
  const db = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: [{ id: "delivery-1", status: "processing" }], error: null };
    },
  };
  const result = await claimDeliveryBatch({ db, workerId: "worker-1", limit: 999 });
  assert.deepEqual(result, [{ id: "delivery-1", status: "processing" }]);
  assert.deepEqual(calls, [{ name: "claim_deliveries", args: { p_worker_id: "worker-1", p_limit: 100 } }]);
});

test("loadDeliveryContext prefers award snapshot from awards table when available", async () => {
  const db = {
    from(table) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        async single() {
          if (table === "customers") return { data: { phone: "0987654321", name: "Award Winner" }, error: null };
          return { data: null, error: null };
        },
        async maybeSingle() {
          if (table === "awards") {
            return {
              data: {
                code: "AWARD_SNAP_CODE",
                title_snapshot: "Voucher 500k Snapshot",
                value_snapshot: 500000,
                description_snapshot: "Mô tả award",
                expires_at: "2026-12-31T23:59:59.000Z",
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };

  const context = await loadDeliveryContext({
    db,
    delivery: { customer_id: "cust-1", spin_event_id: "spin-award-1" },
  });

  assert.equal(context.phone, "84987654321");
  assert.equal(context.customer.name, "Award Winner");
  assert.equal(context.reward.code, "AWARD_SNAP_CODE");
  assert.equal(context.reward.title, "Voucher 500k Snapshot");
  assert.equal(context.reward.value, 500000);
});

test("sendDelivery loads customer and reward from DB and sends a normalized phone", async () => {
  const fetchCalls = [];
  const db = {
    from(table) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        async single() {
          if (table === "customers") return { data: { phone: "0912345678", name: "Real Customer" }, error: null };
          if (table === "spin_events") return { data: { reward_code: "REAL_CODE", reward_id: "reward-1" }, error: null };
          return { data: { code: "REAL_CODE", title: "Real reward", value: 100000, description: "Real description" }, error: null };
        },
        async maybeSingle() {
          if (table === "awards") return { data: null, error: null };
          return this.single();
        },
      };
      return chain;
    },
  };
  const fetchImpl = async (url, options) => {
    fetchCalls.push({ url, options });
    return new Response(JSON.stringify({ success: true, msg_id: "msg-1" }), { status: 200 });
  };
  const result = await sendDelivery({
    db,
    fetchImpl,
    config: { zbsApiKey: "key", zbsTemplateId: "template", zbsBaseUrl: "https://zbs.test/api" },
    delivery: { id: "delivery-1", status: "processing", customer_id: "customer-1", spin_event_id: "spin-1", payload: { reward: { code: "FAKE_CLIENT_CODE" } } },
  });
  assert.deepEqual(result, { messageId: "msg-1" });
  const body = JSON.parse(fetchCalls[0].options.body);
  assert.equal(body.phone, "84912345678");
  assert.equal(body.template_data.voucher_code, "REAL_CODE");
  assert.equal(fetchCalls[0].options.headers["X-Idempotency-Key"], "delivery-1");
});

test("already-sent deliveries do not call the provider", async () => {
  let called = false;
  const result = await sendDelivery({
    db: {},
    fetchImpl: async () => { called = true; },
    config: {},
    delivery: { id: "delivery-1", status: "sent", provider_message_id: "msg-1" },
  });
  assert.deepEqual(result, { messageId: "msg-1" });
  assert.equal(called, false);
});

test("a failed provider call is rescheduled with exponential backoff", async () => {
  const calls = [];
  const db = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: {}, error: null };
    },
    from() {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        async single() { return { data: {}, error: null }; },
        async maybeSingle() { return { data: null, error: null }; },
      };
      return chain;
    },
  };
  const now = new Date("2030-01-01T00:00:00.000Z");
  await processDelivery({
    db,
    config: { zbsApiKey: "key", zbsTemplateId: "template", zbsBaseUrl: "https://zbs.test/api", deliveryMaxAttempts: 8 },
    fetchImpl: async () => new Response(JSON.stringify({ success: false, message: "bad gateway" }), { status: 502 }),
    delivery: { id: "delivery-1", status: "processing", attempt_count: 2, customer_id: "customer-1", spin_event_id: "spin-1" },
    now,
  });
  assert.equal(calls[0].name, "finish_delivery");
  assert.equal(calls[0].args.p_status, "pending");
  assert.equal(calls[0].args.p_next_attempt_at, new Date(now.getTime() + retryDelayMs(2)).toISOString());
});
