import test from "node:test";
import assert from "node:assert/strict";
import { listParticipantAwards, parseAwardsPagination } from "../src/award-service.js";

test("parseAwardsPagination defaults page and limit", () => {
  assert.deepEqual(parseAwardsPagination({}), { page: 1, limit: 20 });
});

test("parseAwardsPagination rejects non-integers and out-of-range values", () => {
  for (const query of [
    { page: "1.5" },
    { limit: "2.5" },
    { page: "0" },
    { limit: "0" },
    { page: "-1" },
    { limit: "-1" },
    { page: "101" },
    { limit: "51" },
  ]) {
    assert.throws(() => parseAwardsPagination(query), (error) => error.status === 400);
  }
});

class FakeAwardsQuery {
  constructor(rows) {
    this.rows = rows;
    this.calls = [];
  }

  select(columns) {
    this.calls.push(["select", columns]);
    return this;
  }

  eq(column, value) {
    this.calls.push(["eq", column, value]);
    return this;
  }

  order(column, options) {
    this.calls.push(["order", column, options]);
    return this;
  }

  async range(start, end) {
    this.calls.push(["range", start, end]);
    return { data: this.rows, error: null };
  }
}

function fakeDb(rows) {
  const query = new FakeAwardsQuery(rows);
  return {
    query,
    from(table) {
      query.calls.push(["from", table]);
      return query;
    },
  };
}

const awardRow = (overrides = {}) => ({
  id: "award-1",
  campaign_id: "campaign-1",
  spin_event_id: "spin-1",
  reward_id: "reward-1",
  code: "VOUCHER-1",
  title_snapshot: "Free coffee",
  value_snapshot: "25000",
  description_snapshot: "One coffee",
  result: ["bell", "bell", "bell"],
  status: "issued",
  issued_at: "2026-08-16T00:00:00.000Z",
  delivered_at: null,
  redeemed_at: null,
  expires_at: "2026-09-16T00:00:00.000Z",
  ...overrides,
});

test("listParticipantAwards scopes, orders, pages, trims, and maps awards", async () => {
  const db = fakeDb([
    awardRow({ id: "award-1" }),
    awardRow({ id: "award-2", code: "VOUCHER-2" }),
    awardRow({ id: "award-3", code: "VOUCHER-3" }),
  ]);

  const result = await listParticipantAwards({ db, customerId: "customer-a", page: 1, limit: 2 });

  assert.deepEqual(db.query.calls, [
    ["from", "awards"],
    ["select", "id,campaign_id,spin_event_id,reward_id,code,title_snapshot,value_snapshot,description_snapshot,result,status,issued_at,delivered_at,redeemed_at,expires_at"],
    ["eq", "customer_id", "customer-a"],
    ["order", "issued_at", { ascending: false }],
    ["order", "id", { ascending: false }],
    ["range", 0, 2],
  ]);
  assert.deepEqual(result, {
    page: 1,
    limit: 2,
    hasMore: true,
    items: [
      {
        id: "award-1",
        campaignId: "campaign-1",
        spinEventId: "spin-1",
        rewardId: "reward-1",
        code: "VOUCHER-1",
        title: "Free coffee",
        value: 25000,
        description: "One coffee",
        result: ["bell", "bell", "bell"],
        status: "issued",
        issuedAt: "2026-08-16T00:00:00.000Z",
        deliveredAt: null,
        redeemedAt: null,
        expiresAt: "2026-09-16T00:00:00.000Z",
      },
      {
        id: "award-2",
        campaignId: "campaign-1",
        spinEventId: "spin-1",
        rewardId: "reward-1",
        code: "VOUCHER-2",
        title: "Free coffee",
        value: 25000,
        description: "One coffee",
        result: ["bell", "bell", "bell"],
        status: "issued",
        issuedAt: "2026-08-16T00:00:00.000Z",
        deliveredAt: null,
        redeemedAt: null,
        expiresAt: "2026-09-16T00:00:00.000Z",
      },
    ],
  });
});

test("listParticipantAwards requests the second page and reports no more rows", async () => {
  const db = fakeDb([awardRow({ id: "award-3", code: "VOUCHER-3" }), awardRow({ id: "award-4", code: "VOUCHER-4" })]);

  const result = await listParticipantAwards({ db, customerId: "customer-a", page: 2, limit: 2 });

  assert.deepEqual(db.query.calls.at(-1), ["range", 2, 4]);
  assert.equal(result.page, 2);
  assert.equal(result.limit, 2);
  assert.equal(result.hasMore, false);
  assert.deepEqual(result.items.map((item) => item.code), ["VOUCHER-3", "VOUCHER-4"]);
});
