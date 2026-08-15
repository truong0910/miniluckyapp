import test from "node:test";
import assert from "node:assert/strict";
import { spinOnce } from "../src/spin-service.js";

test("spinOnce takes customer identity from the participant session and forwards idempotency", async () => {
  const calls = [];
  const db = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: { spinId: "spin-1", outcome: "better_luck" }, error: null };
    },
  };
  const result = await spinOnce({
    db,
    participant: { customerId: "customer-from-session" },
    idempotencyKey: "request-123",
    oaFollowed: true,
  });
  assert.deepEqual(result, { spinId: "spin-1", outcome: "better_luck" });
  assert.deepEqual(calls, [{
    name: "spin_once",
    args: {
      p_customer_id: "customer-from-session",
      p_idempotency_key: "request-123",
      p_oa_followed: true,
      p_source: "participant",
    },
  }]);
});

test("spinOnce maps database business errors to safe HTTP errors", async () => {
  const db = { rpc: async () => ({ data: null, error: { code: "P0001", message: "no spins remaining" } }) };
  await assert.rejects(
    () => spinOnce({ db, participant: { customerId: "customer-1" }, idempotencyKey: "request-1" }),
    (error) => error.status === 409 && error.message === "No spins remaining",
  );
});

test("spinOnce rejects missing idempotency keys before calling the database", async () => {
  let called = false;
  const db = { rpc: async () => { called = true; return { data: null, error: null }; } };
  await assert.rejects(
    () => spinOnce({ db, participant: { customerId: "customer-1" }, idempotencyKey: "" }),
    (error) => error.status === 400,
  );
  assert.equal(called, false);
});
