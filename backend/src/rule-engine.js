import { supabase } from "./supabase.js";

function isWithinWindow(rule) {
  const now = Date.now();
  if (rule.starts_at && now < Date.parse(rule.starts_at)) return false;
  if (rule.ends_at && now > Date.parse(rule.ends_at)) return false;
  return true;
}

async function activeRulesForCustomer(customerId) {
  const [direct, memberships, defaults] = await Promise.all([
    supabase.from("customer_rule_assignments").select("rule_id").eq("customer_id", customerId),
    supabase.from("customer_group_members").select("group_id").eq("customer_id", customerId),
    supabase.from("campaign_rules").select("*").eq("scope", "default").eq("active", true),
  ]);
  for (const result of [direct, memberships, defaults]) if (result.error) throw result.error;

  const directIds = (direct.data || []).map((item) => item.rule_id);
  const groupIds = (memberships.data || []).map((item) => item.group_id);
  let groupRuleIds = [];
  if (groupIds.length) {
    const result = await supabase.from("group_rule_assignments").select("rule_id").in("group_id", groupIds);
    if (result.error) throw result.error;
    groupRuleIds = (result.data || []).map((item) => item.rule_id);
  }

  const ids = [...new Set([...directIds, ...groupRuleIds])];
  const assigned = ids.length
    ? await supabase.from("campaign_rules").select("*").in("id", ids).eq("active", true)
    : { data: [], error: null };
  if (assigned.error) throw assigned.error;

  return [
    ...(assigned.data || []).map((rule) => ({ rule, scopeRank: rule.scope === "user" ? 3 : 2 })),
    ...(defaults.data || []).map((rule) => ({ rule, scopeRank: 1 })),
  ]
    .filter(({ rule }) => isWithinWindow(rule))
    .sort((a, b) => Number(b.rule.priority || 0) - Number(a.rule.priority || 0) || b.scopeRank - a.scopeRank);
}

async function chooseFromRule(rule, customer, spinNumber, oaFollowed) {
  if (rule.oa_required && !oaFollowed) return null;
  const { data: spinConfig, error: configError } = await supabase
    .from("rule_spin_configs")
    .select("*")
    .eq("rule_id", rule.id)
    .eq("spin_number", spinNumber)
    .maybeSingle();
  if (configError) throw configError;
  if (!spinConfig) return null;

  if (rule.max_total_wins != null) {
    const { count, error } = await supabase.from("spin_events").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).eq("outcome", "reward");
    if (error) throw error;
    if (Number(count || 0) >= Number(rule.max_total_wins)) return { outcome: "better_luck" };
  }
  if (spinConfig.max_wins != null) {
    const { count, error } = await supabase.from("spin_events").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).eq("rule_id", rule.id).eq("outcome", "reward");
    if (error) throw error;
    if (Number(count || 0) >= Number(spinConfig.max_wins)) return { outcome: "better_luck" };
  }
  if (Math.random() * 100 >= Number(spinConfig.win_rate || 0)) return { outcome: "better_luck" };

  const { data: configuredRewards, error: rewardError } = await supabase
    .from("rule_spin_rewards")
    .select("id,reward_id,probability,remaining_quantity")
    .eq("spin_config_id", spinConfig.id)
    .gt("remaining_quantity", 0);
  if (rewardError) throw rewardError;
  if (!configuredRewards?.length) return { outcome: "better_luck" };

  const rewardIds = configuredRewards.map((item) => item.reward_id);
  const { data: catalog, error: catalogError } = await supabase.from("reward_catalog").select("id,code_prefix,title,value,description,wheel_label,symbol,active").in("id", rewardIds).eq("active", true);
  if (catalogError) throw catalogError;
  const catalogById = new Map((catalog || []).map((item) => [item.id, item]));
  const choices = configuredRewards.map((item) => ({ config: item, reward: catalogById.get(item.reward_id) })).filter((item) => item.reward);
  if (!choices.length) return { outcome: "better_luck" };
  const total = choices.reduce((sum, item) => sum + Math.max(0, Number(item.config.probability || 0)), 0);
  if (total <= 0) return { outcome: "better_luck" };
  let cursor = Math.random() * total;
  const selected = choices.find((item) => (cursor -= Math.max(0, Number(item.config.probability || 0))) <= 0) || choices[choices.length - 1];
  const remaining = Math.max(0, Number(selected.config.remaining_quantity || 0) - 1);
  const { error: updateError } = await supabase.from("rule_spin_rewards").update({ remaining_quantity: remaining }).eq("id", selected.config.id).gt("remaining_quantity", 0);
  if (updateError) throw updateError;

  const reward = selected.reward;
  return {
    outcome: "reward",
    rewardId: reward.id,
    reward: {
      code: `RULE_${reward.code_prefix}_${customer.phone}_${spinNumber}_${Date.now()}`,
      title: reward.title,
      value: Number(reward.value),
      description: reward.description || "",
      wheelLabel: reward.wheel_label,
      symbol: reward.symbol,
    },
    result: [reward.symbol, reward.symbol, reward.symbol],
  };
}

export async function chooseRuleOutcome(customer, spinNumber, oaFollowed) {
  const candidates = await activeRulesForCustomer(customer.id);
  for (const { rule } of candidates) {
    const outcome = await chooseFromRule(rule, customer, spinNumber, oaFollowed);
    if (outcome) return { ...outcome, ruleId: rule.id };
  }
  return null;
}
