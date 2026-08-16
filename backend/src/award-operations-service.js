import { publicError } from "./utils.js";

export function validateAwardStatusTransition(currentStatus, targetStatus, reason = "") {
  if (currentStatus === "redeemed") {
    throw publicError("Không thể chuyển trạng thái voucher đã đổi (redeemed)");
  }

  if (targetStatus === "void" || targetStatus === "expired") {
    if (!String(reason || "").trim()) {
      throw publicError("Lý do không được để trống khi hủy (void) hoặc chuyển hết hạn (expired)");
    }
  }

  const validTransitions = {
    issued: ["delivering", "delivered", "redeemed", "void", "expired"],
    delivering: ["delivered", "failed", "redeemed", "void", "expired"],
    delivered: ["redeemed", "void", "expired"],
    failed: ["delivering", "delivered", "void", "expired"],
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw publicError(`Không thể chuyển trạng thái từ '${currentStatus}' sang '${targetStatus}'`);
  }

  return true;
}

export function calculateInventorySummary(rewards = [], awards = []) {
  const awardCounts = {};

  for (const a of awards) {
    const rid = a.reward_id || a.rewardId;
    if (!rid) continue;
    if (!awardCounts[rid]) {
      awardCounts[rid] = { total: 0, delivered: 0, redeemed: 0 };
    }
    awardCounts[rid].total++;
    if (a.status === "delivered") awardCounts[rid].delivered++;
    if (a.status === "redeemed") awardCounts[rid].redeemed++;
  }

  return (rewards || []).map((r) => {
    const counts = awardCounts[r.id] || { total: 0, delivered: 0, redeemed: 0 };
    const planned = Number(r.quantity || 0);
    const issued = counts.total;
    const remaining = Math.max(0, planned - issued);

    return {
      rewardId: r.id,
      rewardTitle: r.title,
      codePrefix: r.code_prefix || r.codePrefix,
      value: Number(r.value || 0),
      plannedQuantity: planned,
      issuedCount: issued,
      deliveredCount: counts.delivered,
      redeemedCount: counts.redeemed,
      remainingQuantity: remaining,
    };
  });
}

export async function redeemAward({ db, awardId, redeemedBy = "admin" }) {
  const { data: award, error: fetchErr } = await db
    .from("awards")
    .select("id,status,redeemed_at")
    .eq("id", awardId)
    .single();

  if (fetchErr || !award) throw publicError("Voucher không tồn tại");

  validateAwardStatusTransition(award.status, "redeemed");

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await db
    .from("awards")
    .update({ status: "redeemed", redeemed_at: now })
    .eq("id", awardId)
    .select("*")
    .single();

  if (updateErr) throw updateErr;
  return updated;
}

export async function resendAwardDelivery({ db, awardId }) {
  const { data: award, error: fetchErr } = await db
    .from("awards")
    .select("id,status,spin_event_id")
    .eq("id", awardId)
    .single();

  if (fetchErr || !award) throw publicError("Voucher không tồn tại");
  if (award.status === "redeemed") throw publicError("Không thể resend voucher đã đổi");

  // Update outbox delivery record using spin_event_id
  if (award.spin_event_id) {
    await db.from("deliveries").update({ status: "pending", attempt_count: 0 }).eq("spin_event_id", award.spin_event_id);
  }

  // Update award status to delivering
  const { data: updated, error: updateErr } = await db
    .from("awards")
    .update({ status: "delivering" })
    .eq("id", awardId)
    .select("*")
    .single();

  if (updateErr) throw updateErr;
  return updated;
}

export async function updateAwardStatus({ db, awardId, status, reason = "" }) {
  const { data: award, error: fetchErr } = await db
    .from("awards")
    .select("id,status")
    .eq("id", awardId)
    .single();

  if (fetchErr || !award) throw publicError("Voucher không tồn tại");

  validateAwardStatusTransition(award.status, status, reason);

  const { data: updated, error: updateErr } = await db
    .from("awards")
    .update({ status })
    .eq("id", awardId)
    .select("*")
    .single();

  if (updateErr) throw updateErr;
  return { ...updated, reason };
}

export async function getCampaignInventorySummary({ db, campaignId }) {
  const { data: rewards } = await db.from("reward_catalog").select("id,title,code_prefix,value");

  // Calculate planned quantities per reward for campaign rules
  const { data: rules } = await db.from("campaign_rules").select("id").eq("campaign_id", campaignId);
  const ruleIds = (rules || []).map((r) => r.id);

  let plannedQuantities = {};
  if (ruleIds.length > 0) {
    const { data: configs } = await db.from("rule_spin_configs").select("id").in("rule_id", ruleIds);
    const configIds = (configs || []).map((c) => c.id);
    if (configIds.length > 0) {
      const { data: spinRewards } = await db.from("rule_spin_rewards").select("reward_id,quantity").in("spin_config_id", configIds);
      for (const sr of spinRewards || []) {
        plannedQuantities[sr.reward_id] = (plannedQuantities[sr.reward_id] || 0) + (Number(sr.quantity) || 0);
      }
    }
  }

  const { data: awards } = await db.from("awards").select("reward_id,status").eq("campaign_id", campaignId);

  const rewardsWithQuantity = (rewards || []).map((r) => ({
    ...r,
    quantity: plannedQuantities[r.id] || 0,
  }));

  return calculateInventorySummary(rewardsWithQuantity, awards || []);
}
