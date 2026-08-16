import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCampaignInput,
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  transitionCampaign,
  getActiveCampaign,
} from "../src/campaign-service.js";

test("parseCampaignInput normalizes code and defaults timezone", () => {
  assert.deepEqual(
    parseCampaignInput({ code: "  SPRING-2026 ", name: " Spring Campaign " }),
    {
      code: "SPRING-2026",
      name: "Spring Campaign",
      startsAt: null,
      endsAt: null,
      timezone: "Asia/Ho_Chi_Minh",
    },
  );
});

test("parseCampaignInput accepts valid ISO date range", () => {
  const input = parseCampaignInput({
    code: "SUMMER-2026",
    name: "Summer",
    startsAt: "2026-06-01T00:00:00Z",
    endsAt: "2026-08-31T23:59:59Z",
    timezone: "Asia/Ho_Chi_Minh",
  });
  assert.equal(input.startsAt, "2026-06-01T00:00:00.000Z");
  assert.equal(input.endsAt, "2026-08-31T23:59:59.000Z");
});

test("parseCampaignInput rejects invalid code, empty name, and inverted date window", () => {
  assert.throws(() => parseCampaignInput({ code: "bad code!", name: "Test" }), /Mã sự kiện/);
  assert.throws(() => parseCampaignInput({ code: "VALID", name: "   " }), /Tên sự kiện/);
  assert.throws(
    () =>
      parseCampaignInput({
        code: "VALID",
        name: "Test",
        startsAt: "2026-08-20T00:00:00Z",
        endsAt: "2026-08-10T00:00:00Z",
      }),
    /Thời gian kết thúc/,
  );
});

test("getActiveCampaign queries status = 'active'", async () => {
  let queriedTable = "";
  let queriedFilter = {};

  const fakeDb = {
    from(table) {
      queriedTable = table;
      return {
        select() {
          return {
            eq(col, val) {
              queriedFilter[col] = val;
              return {
                maybeSingle: async () => ({
                  data: { id: "active-id", code: "ACTIVE", status: "active" },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  };

  const active = await getActiveCampaign({ db: fakeDb });
  assert.equal(queriedTable, "campaigns");
  assert.equal(queriedFilter.status, "active");
  assert.equal(active.code, "ACTIVE");
});

test("transitionCampaign calls transition_campaign RPC and maps P0004 to HTTP 409", async () => {
  const fakeDbP0004 = {
    rpc: async (fn, args) => {
      assert.equal(fn, "transition_campaign");
      assert.equal(args.p_campaign_id, "target-id");
      assert.equal(args.p_status, "active");
      return { data: null, error: { code: "P0004", message: "another active" } };
    },
  };

  await assert.rejects(
    () => transitionCampaign({ db: fakeDbP0004, id: "target-id", status: "active" }),
    (err) => {
      assert.equal(err.status, 409);
      assert.match(err.message, /Đã có một sự kiện khác đang diễn ra/);
      return true;
    },
  );
});
