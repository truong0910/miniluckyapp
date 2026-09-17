import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { listParticipantAwards } from "../../src/award-service.js";

const OPT_IN_REASON = "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for opt-in DB integration";
const LEGACY_CAMPAIGN_ID = "00000000-0000-0000-0000-000000000001";
const testUrl = process.env.SUPABASE_TEST_URL;
const testKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

const servicePath = new URL("../../src/award-service.js", import.meta.url);
const routesPath = new URL("../../src/routes/public.routes.js", import.meta.url);

test("participant awards remains a participant-scoped read separate from spin and delivery", async () => {
  const [service, routes] = await Promise.all([
    readFile(servicePath, "utf8"),
    readFile(routesPath, "utf8"),
  ]);
  const routeStart = routes.indexOf('router.get("/participant/me/awards"');
  const routeEnd = routes.indexOf("router.", routeStart + 1);
  const route = routeStart >= 0 ? routes.slice(routeStart, routeEnd) : "";

  assert.match(service, /export async function listParticipantAwards/);
  assert.match(service, /\.from\("awards"\)[\s\S]*\.eq\("customer_id", customerId\)/);
  assert.match(service, /title_snapshot,value_snapshot,description_snapshot,result,status/);
  assert.ok(route, "expected GET /participant/me/awards route");
  assert.match(route, /requireParticipant\s*,\s*asyncRoute/);
  assert.match(route, /listParticipantAwards\(\{\s*db:\s*supabase,[\s\S]*customerId,[\s\S]*page,[\s\S]*limit[\s\S]*\}\)/);
  assert.doesNotMatch(service, /spin_once|delivery/i);
  assert.doesNotMatch(route, /spinOnce|spin_once|delivery/i);
});

function isAwardsUnavailable(error) {
  return error?.code === "42P01" || error?.code === "PGRST205" ||
    /(?:relation|table|schema cache).*awards/i.test(String(error?.message || ""));
}

function assertTimestamp(actual, expected) {
  assert.equal(new Date(actual).toISOString(), new Date(expected).toISOString());
}

function assertParticipantAward(response, fixture) {
  assert.deepEqual(
    { page: response.page, limit: response.limit, hasMore: response.hasMore },
    { page: 1, limit: 20, hasMore: false },
  );
  assert.equal(response.items.length, 1);

  const [award] = response.items;
  assert.deepEqual(
    {
      id: award.id,
      campaignId: award.campaignId,
      spinEventId: award.spinEventId,
      rewardId: award.rewardId,
      code: award.code,
      title: award.title,
      value: award.value,
      description: award.description,
      result: award.result,
      status: award.status,
      expiresAt: award.expiresAt,
    },
    {
      id: fixture.awardId,
      campaignId: LEGACY_CAMPAIGN_ID,
      spinEventId: fixture.spinEventId,
      rewardId: null,
      code: fixture.code,
      title: fixture.title,
      value: fixture.value,
      description: fixture.description,
      result: fixture.result,
      status: fixture.status,
      expiresAt: null,
    },
  );
  assertTimestamp(award.issuedAt, fixture.issuedAt);
  if (fixture.deliveredAt) {
    assertTimestamp(award.deliveredAt, fixture.deliveredAt);
  } else {
    assert.equal(award.deliveredAt, null);
  }
  assert.equal(award.redeemedAt, null);
}

test(
  "listParticipantAwards isolates award snapshots between generated customers",
  { skip: !testUrl || !testKey ? OPT_IN_REASON : false },
  async (t) => {
    const db = createClient(testUrl, testKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: availabilityError } = await db.from("awards").select("id").limit(1);
    if (isAwardsUnavailable(availabilityError) || availabilityError?.code === "PGRST303" || availabilityError?.message?.includes("future")) {
      t.skip(OPT_IN_REASON);
      return;
    }
    assert.ifError(availabilityError);

    const fixtureKey = `${Date.now()}-${process.pid}-${randomUUID().slice(0, 8)}`;
    const issuedAt = new Date().toISOString();
    const deliveredAt = new Date(Date.now() + 1_000).toISOString();
    const fixtures = [
      {
        customerId: `phase2b2-test-${fixtureKey}-a`,
        phone: `09${randomUUID().replace(/\D/g, "").slice(0, 8)}`,
        name: "Phase 2B.2 Integration Test A",
        code: `PHASE2B2_A_${fixtureKey}`,
        title: "Phase 2B.2 award A",
        value: 110_000,
        description: "Snapshot A",
        result: ["cherry", "cherry", "cherry"],
        status: "issued",
        issuedAt,
        deliveredAt: null,
        spinEventId: null,
        awardId: null,
      },
      {
        customerId: `phase2b2-test-${fixtureKey}-b`,
        phone: `09${randomUUID().replace(/\D/g, "").slice(0, 8)}`,
        name: "Phase 2B.2 Integration Test B",
        code: `PHASE2B2_B_${fixtureKey}`,
        title: "Phase 2B.2 award B",
        value: 220_000,
        description: "Snapshot B",
        result: ["bell", "bell", "bell"],
        status: "delivered",
        issuedAt: deliveredAt,
        deliveredAt,
        spinEventId: null,
        awardId: null,
      },
    ];
    const customerIds = fixtures.map((fixture) => fixture.customerId);
    let spinEventIds = [];
    let awardIds = [];

    try {
      const { error: customerError } = await db.from("customers").insert(
        fixtures.map((fixture) => ({
          id: fixture.customerId,
          phone: fixture.phone,
          name: fixture.name,
          sex: "other",
          job: "other",
          total_spins: 1,
        })),
      );
      assert.ifError(customerError);

      const { data: spinEvents, error: spinError } = await db
        .from("spin_events")
        .insert(fixtures.map((fixture) => ({
          campaign_id: LEGACY_CAMPAIGN_ID,
          customer_id: fixture.customerId,
          spin_number: 1,
          outcome: "reward",
          reward_code: fixture.code,
          metadata: { source: "phase2b2-integration-test" },
        })))
        .select("id,customer_id");
      assert.ifError(spinError);
      assert.equal(spinEvents?.length, fixtures.length);
      const spinEventByCustomer = new Map(spinEvents.map((event) => [event.customer_id, event.id]));
      for (const fixture of fixtures) {
        fixture.spinEventId = spinEventByCustomer.get(fixture.customerId);
        assert.ok(fixture.spinEventId);
      }
      spinEventIds = fixtures.map((fixture) => fixture.spinEventId);

      const { data: awards, error: awardError } = await db
        .from("awards")
        .insert(fixtures.map((fixture) => ({
          campaign_id: LEGACY_CAMPAIGN_ID,
          spin_event_id: fixture.spinEventId,
          customer_id: fixture.customerId,
          code: fixture.code,
          title_snapshot: fixture.title,
          value_snapshot: fixture.value,
          description_snapshot: fixture.description,
          result: fixture.result,
          status: fixture.status,
          issued_at: fixture.issuedAt,
          delivered_at: fixture.deliveredAt,
        })))
        .select("id,customer_id");
      assert.ifError(awardError);
      assert.equal(awards?.length, fixtures.length);
      const awardByCustomer = new Map(awards.map((award) => [award.customer_id, award.id]));
      for (const fixture of fixtures) {
        fixture.awardId = awardByCustomer.get(fixture.customerId);
        assert.ok(fixture.awardId);
      }
      awardIds = fixtures.map((fixture) => fixture.awardId);

      const customerAResponse = await listParticipantAwards({
        db,
        customerId: fixtures[0].customerId,
        page: 1,
        limit: 20,
      });
      const customerBResponse = await listParticipantAwards({
        db,
        customerId: fixtures[1].customerId,
        page: 1,
        limit: 20,
      });

      assertParticipantAward(customerAResponse, fixtures[0]);
      assertParticipantAward(customerBResponse, fixtures[1]);
      assert.ok(customerAResponse.items.every((award) => award.id !== fixtures[1].awardId && award.code !== fixtures[1].code));
      assert.ok(customerBResponse.items.every((award) => award.id !== fixtures[0].awardId && award.code !== fixtures[0].code));
    } finally {
      if (awardIds.length) {
        const { error } = await db.from("awards").delete().in("id", awardIds);
        assert.ifError(error);
      }
      if (spinEventIds.length) {
        const { error } = await db.from("spin_events").delete().in("id", spinEventIds);
        assert.ifError(error);
      }
      const { error } = await db.from("customers").delete().in("id", customerIds);
      assert.ifError(error);
    }
  },
);
