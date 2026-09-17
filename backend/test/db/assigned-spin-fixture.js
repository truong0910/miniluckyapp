import { randomUUID } from "node:crypto";

const LEGACY_CAMPAIGN_ID = "00000000-0000-0000-0000-000000000001";
const MAX_FIXTURE_SPINS = 50;

function isSchemaUnavailable(error) {
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205" ||
    /(?:relation|table|schema cache|column).*?(?:campaigns|campaign_rules|campaign_participants|rule_spin_configs|registration_source)/i.test(String(error?.message || ""));
}

/**
 * Prepare an assigned-reward spin after every configured default-rule spin.
 * This lets RPC integration tests exercise the reward/award path without
 * decrementing inventory configured on the live active campaign.
 */
export async function prepareAssignedRewardSpin({
  db,
  t,
  customerId,
  fixtureTag,
  customerName,
  rewardTitle,
  rewardValue,
  rewardDescription,
}) {
  const { data: activeCampaigns, error: campaignError } = await db
    .from("campaigns")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (campaignError && isSchemaUnavailable(campaignError)) {
    t.skip("campaign migrations are not applied to the remote Supabase database");
    return null;
  }
  if (campaignError) throw campaignError;

  const campaignId = activeCampaigns?.[0]?.id ?? LEGACY_CAMPAIGN_ID;
  const { data: defaultRules, error: rulesError } = await db
    .from("campaign_rules")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("scope", "default")
    .eq("active", true);

  if (rulesError && isSchemaUnavailable(rulesError)) {
    t.skip("campaign rule migrations are not applied to the remote Supabase database");
    return null;
  }
  if (rulesError) throw rulesError;

  let lastConfiguredSpin = 0;
  if (defaultRules?.length) {
    const { data: configs, error: configsError } = await db
      .from("rule_spin_configs")
      .select("spin_number")
      .in("rule_id", defaultRules.map((rule) => rule.id));
    if (configsError && isSchemaUnavailable(configsError)) {
      t.skip("spin rule migrations are not applied to the remote Supabase database");
      return null;
    }
    if (configsError) throw configsError;
    lastConfiguredSpin = Math.max(0, ...(configs ?? []).map((config) => config.spin_number));
  }

  const spinNumber = lastConfiguredSpin + 1;
  if (spinNumber > MAX_FIXTURE_SPINS) {
    t.skip(`safe fixture would require ${spinNumber} spins; refusing to seed that many rows`);
    return null;
  }

  const { error: customerError } = await db.from("customers").insert({
    id: customerId,
    phone: `09${randomUUID().replace(/\D/g, "").slice(0, 8)}`,
    name: customerName,
    sex: "other",
    job: "other",
    total_spins: spinNumber,
  });
  if (customerError?.code === "PGRST303" || customerError?.message?.includes("future")) {
    t.skip("remote Supabase clock skew (JWT issued at future)");
    return null;
  }
  if (customerError) throw customerError;

  if (campaignId !== LEGACY_CAMPAIGN_ID) {
    const { error: participantError } = await db.from("campaign_participants").insert({
      campaign_id: campaignId,
      customer_id: customerId,
      status: "active",
      spin_quota: spinNumber,
      registration_source: "admin",
    });
    if (participantError && isSchemaUnavailable(participantError)) {
      t.skip("campaign participant migrations are not applied to the remote Supabase database");
      return null;
    }
    if (participantError) throw participantError;
  }

  const now = Date.now();
  const fillerEvents = Array.from({ length: spinNumber - 1 }, (_, index) => ({
    campaign_id: campaignId,
    customer_id: customerId,
    spin_number: index + 1,
    outcome: "better_luck",
    idempotency_key: `${fixtureTag}-prefill-${index + 1}`,
    metadata: { source: "integration-test-prefill" },
    created_at: new Date(now - (spinNumber - index) * 1000).toISOString(),
  }));
  if (fillerEvents.length) {
    const { error: fillerError } = await db.from("spin_events").insert(fillerEvents);
    if (fillerError) throw fillerError;
  }

  const rewards = Array.from({ length: spinNumber }, (_, index) => {
    const isTargetReward = index === spinNumber - 1;
    return {
      campaign_id: campaignId,
      customer_id: customerId,
      code: `${fixtureTag}-reward-${index + 1}`,
      title: isTargetReward ? rewardTitle : `Fixture filler ${index + 1}`,
      value: isTargetReward ? rewardValue : 1,
      description: isTargetReward ? rewardDescription : "Integration fixture",
      wheel_label: isTargetReward ? rewardTitle : `Filler ${index + 1}`,
      result: isTargetReward ? ["star", "star", "star"] : ["cherry", "lemon", "bell"],
      created_at: new Date(now - (spinNumber - index) * 1000).toISOString(),
    };
  });
  const { error: rewardError } = await db.from("customer_rewards").insert(rewards);
  if (rewardError) throw rewardError;

  return {
    campaignId,
    spinNumber,
    rewardCode: `${fixtureTag}-reward-${spinNumber}`,
  };
}
