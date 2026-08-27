import { publicError } from "./utils.js";

export async function listGroups({ db, search = "" }) {
  let query = db
    .from("customer_groups")
    .select("id,name,created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data: groups, error } = await query;
  if (error) throw error;

  const { data: members } = await db.from("customer_group_members").select("group_id");
  const { data: rules } = await db.from("group_rule_assignments").select("group_id");

  const memberCounts = {};
  for (const m of members || []) {
    memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
  }

  const ruleCounts = {};
  for (const r of rules || []) {
    ruleCounts[r.group_id] = (ruleCounts[r.group_id] || 0) + 1;
  }

  const items = (groups || []).map((g) => ({
    id: g.id,
    name: g.name,
    createdAt: g.created_at,
    memberCount: memberCounts[g.id] || 0,
    ruleCount: ruleCounts[g.id] || 0,
  }));

  return { items };
}

export async function createGroup({ db, name }) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw publicError("Tên nhóm không được để trống");
  }

  const { data: existing } = await db
    .from("customer_groups")
    .select("id")
    .eq("name", cleanName)
    .maybeSingle();

  if (existing) {
    throw publicError(`Tên nhóm '${cleanName}' đã tồn tại`);
  }

  const { data: created, error } = await db
    .from("customer_groups")
    .insert({ name: cleanName })
    .select("id,name,created_at")
    .single();

  if (error) throw error;
  return created;
}

export async function renameGroup({ db, id, name }) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw publicError("Tên nhóm không được để trống");
  }

  const { data: existing } = await db
    .from("customer_groups")
    .select("id")
    .eq("name", cleanName)
    .maybeSingle();

  if (existing && existing.id !== id) {
    throw publicError(`Tên nhóm '${cleanName}' đã tồn tại`);
  }

  const { data: updated, error } = await db
    .from("customer_groups")
    .update({ name: cleanName })
    .eq("id", id)
    .select("id,name,created_at")
    .single();

  if (error) throw error;
  return updated;
}

export async function deleteGroup({ db, id }) {
  // Delete metadata assignments only (preserve customers and historical data)
  await db.from("group_rule_assignments").delete().eq("group_id", id);
  await db.from("customer_group_members").delete().eq("group_id", id);
  const { error } = await db.from("customer_groups").delete().eq("id", id);
  if (error) throw error;
  return { success: true, id };
}

export async function listGroupMembers({ db, groupId, page = 1, limit = 20, search = "" }) {
  const cleanSearch = String(search || "").trim();
  const selectClause = cleanSearch
    ? "group_id,customer_id,created_at,customers!inner(id,name,phone)"
    : "group_id,customer_id,created_at,customers(id,name,phone)";

  let query = db
    .from("customer_group_members")
    .select(selectClause, { count: "exact" })
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (cleanSearch) {
    query = query.or(
      `customer_id.ilike.%${cleanSearch}%,customers.name.ilike.%${cleanSearch}%,customers.phone.ilike.%${cleanSearch}%`
    );
  }

  const start = (page - 1) * limit;
  query = query.range(start, start + limit - 1);

  const { data: rows, count, error } = await query;
  if (error) throw error;

  const items = (rows || []).map((r) => ({
    groupId: r.group_id,
    customerId: r.customer_id,
    customerName: r.customers?.name || r.customer_id,
    customerPhone: r.customers?.phone || "",
    createdAt: r.created_at,
  }));

  return {
    items,
    page,
    limit,
    total: count || 0,
  };
}

export async function addGroupMember({ db, groupId, customerId }) {
  if (!customerId) throw publicError("customerId là bắt buộc");
  await db.from("customer_group_members").insert({ group_id: groupId, customer_id: customerId });
  return { success: true, groupId, customerId };
}

export async function removeGroupMember({ db, groupId, customerId }) {
  await db
    .from("customer_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("customer_id", customerId);
  return { success: true, groupId, customerId };
}

export async function replaceGroupMembers({ db, groupId, customerIds = [] }) {
  await db.from("customer_group_members").delete().eq("group_id", groupId);
  if (Array.isArray(customerIds) && customerIds.length > 0) {
    const rows = customerIds.map((cid) => ({ group_id: groupId, customer_id: cid }));
    await db.from("customer_group_members").insert(rows);
  }
  return { success: true, groupId, count: customerIds.length };
}

export async function listGroupRules({ db, groupId, campaignId = "" }) {
  const { data: assignments, error } = await db
    .from("group_rule_assignments")
    .select("group_id,rule_id,created_at,campaign_rules(id,name,code,campaign_id,active)")
    .eq("group_id", groupId);

  if (error) throw error;

  let items = (assignments || []).map((a) => ({
    groupId: a.group_id,
    ruleId: a.rule_id,
    ruleName: a.campaign_rules?.name || a.rule_id,
    ruleCode: a.campaign_rules?.code || "",
    campaignId: a.campaign_rules?.campaign_id || "",
    active: a.campaign_rules?.active ?? true,
    createdAt: a.created_at,
  }));

  if (campaignId) {
    items = items.filter((item) => item.campaignId === campaignId);
  }

  return { items };
}

export async function assignRuleToGroup({ db, groupId, ruleId }) {
  if (!ruleId) throw publicError("ruleId là bắt buộc");
  await db.from("group_rule_assignments").insert({ group_id: groupId, rule_id: ruleId });
  return { success: true, groupId, ruleId };
}

export async function removeRuleFromGroup({ db, groupId, ruleId }) {
  await db
    .from("group_rule_assignments")
    .delete()
    .eq("group_id", groupId)
    .eq("rule_id", ruleId);
  return { success: true, groupId, ruleId };
}

export async function replaceGroupRules({ db, groupId, ruleIds = [], campaignId = "" }) {
  const cleanCampaignId = String(campaignId || "").trim();

  if (cleanCampaignId) {
    const { data: campaignRules } = await db
      .from("campaign_rules")
      .select("id")
      .eq("campaign_id", cleanCampaignId);

    const targetRuleIds = (campaignRules || []).map((r) => r.id);
    if (targetRuleIds.length > 0) {
      for (const rid of targetRuleIds) {
        await db
          .from("group_rule_assignments")
          .delete()
          .eq("group_id", groupId)
          .eq("rule_id", rid);
      }
    }
  } else {
    await db.from("group_rule_assignments").delete().eq("group_id", groupId);
  }

  if (Array.isArray(ruleIds) && ruleIds.length > 0) {
    const rows = ruleIds.map((rid) => ({ group_id: groupId, rule_id: rid }));
    await db.from("group_rule_assignments").insert(rows);
  }

  return { success: true, groupId, count: ruleIds.length };
}
