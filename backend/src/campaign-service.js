import { publicError } from "./utils.js";

const CAMPAIGN_COLUMNS = "id,code,name,status,starts_at,ends_at,timezone,allow_unlisted,unlisted_spin_quota,created_at,updated_at";

export function parseCampaignInput(body = {}, { partial = false } = {}) {
  const codeRaw = String(body.code ?? "").trim().toUpperCase();
  const nameRaw = String(body.name ?? "").trim();

  if (!partial || body.code !== undefined) {
    if (!codeRaw || !/^[A-Z0-9_-]{2,50}$/.test(codeRaw)) {
      throw publicError("Mã sự kiện không hợp lệ (chỉ gồm chữ cái, số, gạch ngang, 2-50 ký tự)");
    }
  }

  if (!partial || body.name !== undefined) {
    if (!nameRaw) {
      throw publicError("Tên sự kiện không được để trống");
    }
  }

  let startsAt = null;
  if (body.startsAt) {
    const d = new Date(body.startsAt);
    if (isNaN(d.getTime())) throw publicError("Thời gian bắt đầu không hợp lệ");
    startsAt = d.toISOString();
  }

  let endsAt = null;
  if (body.endsAt) {
    const d = new Date(body.endsAt);
    if (isNaN(d.getTime())) throw publicError("Thời gian kết thúc không hợp lệ");
    endsAt = d.toISOString();
  }

  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
    throw publicError("Thời gian kết thúc phải sau thời gian bắt đầu");
  }

  const timezone = String(body.timezone || "Asia/Ho_Chi_Minh").trim();
  const allowUnlisted = body.allowUnlisted !== undefined ? Boolean(body.allowUnlisted) : false;
  const unlistedSpinQuota = Math.max(0, Number(body.unlistedSpinQuota ?? 1));

  return {
    code: codeRaw,
    name: nameRaw,
    startsAt,
    endsAt,
    timezone,
    allowUnlisted,
    unlistedSpinQuota,
  };
}

export function mapCampaignRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    timezone: row.timezone || "Asia/Ho_Chi_Minh",
    allowUnlisted: Boolean(row.allow_unlisted),
    unlistedSpinQuota: Number(row.unlisted_spin_quota ?? 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCampaigns({ db, status, includeArchived = false }) {
  let query = db.from("campaigns").select(CAMPAIGN_COLUMNS).order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  } else if (!includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapCampaignRow);
}

export async function getCampaign({ db, id }) {
  const { data, error } = await db.from("campaigns").select(CAMPAIGN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw publicError("Không tìm thấy sự kiện", 404);
  return mapCampaignRow(data);
}

export async function getActiveCampaign({ db }) {
  const { data, error } = await db.from("campaigns").select(CAMPAIGN_COLUMNS).eq("status", "active").maybeSingle();
  if (error) throw error;
  return mapCampaignRow(data);
}

export async function createCampaign({ db, input }) {
  const parsed = parseCampaignInput(input);
  const record = {
    code: parsed.code,
    name: parsed.name,
    starts_at: parsed.startsAt,
    ends_at: parsed.endsAt,
    timezone: parsed.timezone,
    allow_unlisted: parsed.allowUnlisted,
    unlisted_spin_quota: parsed.unlistedSpinQuota,
    status: "draft",
  };

  const { data, error } = await db.from("campaigns").insert(record).select(CAMPAIGN_COLUMNS).single();
  if (error) throw error;
  return mapCampaignRow(data);
}

export async function updateCampaign({ db, id, input }) {
  const current = await getCampaign({ db, id });
  const parsed = parseCampaignInput(input, { partial: true });

  if (current.status !== "draft" && parsed.code && parsed.code !== current.code) {
    throw publicError("Không thể thay đổi mã sự kiện khi sự kiện không ở trạng thái nháp");
  }

  const patch = {
    code: parsed.code || current.code,
    name: parsed.name || current.name,
    starts_at: parsed.startsAt !== undefined ? parsed.startsAt : current.startsAt,
    ends_at: parsed.endsAt !== undefined ? parsed.endsAt : current.endsAt,
    timezone: parsed.timezone || current.timezone,
    allow_unlisted: input.allowUnlisted !== undefined ? Boolean(input.allowUnlisted) : current.allowUnlisted,
    unlisted_spin_quota: input.unlistedSpinQuota !== undefined ? Math.max(0, Number(input.unlistedSpinQuota)) : current.unlistedSpinQuota,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db.from("campaigns").update(patch).eq("id", id).select(CAMPAIGN_COLUMNS).single();
  if (error) throw error;
  return mapCampaignRow(data);
}

export async function transitionCampaign({ db, id, status }) {
  if (!["draft", "active", "paused", "ended", "archived"].includes(status)) {
    throw publicError("Trạng thái chuyển đổi không hợp lệ");
  }

  const { data, error } = await db.rpc("transition_campaign", {
    p_campaign_id: id,
    p_status: status,
  });

  if (error) {
    if (error.code === "P0004") {
      throw publicError("Đã có một sự kiện khác đang diễn ra. Vui lòng tạm dừng sự kiện đó trước khi kích hoạt sự kiện mới.", 409);
    }
    if (error.code === "P0002") {
      throw publicError("Không tìm thấy sự kiện", 404);
    }
    throw error;
  }

  return mapCampaignRow(data);
}

export async function getCampaignReadiness({ db, id }) {
  const campaign = await getCampaign({ db, id });

  const [participantsRes, catalogRes, rulesRes, activeCampaignRes] = await Promise.all([
    db.from("campaign_participants").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "active"),
    db.from("reward_catalog").select("id,value,title", { count: "exact" }).eq("active", true),
    db.from("campaign_rules").select("id,name,priority,active").eq("campaign_id", id).eq("active", true),
    getActiveCampaign({ db }),
  ]);

  const participantCount = participantsRes.count || 0;
  const activeRewardCount = catalogRes.data?.length || 0;
  const activeRuleCount = rulesRes.data?.length || 0;
  const currentActiveCampaign = activeCampaignRes;
  const isAnotherActive = currentActiveCampaign && currentActiveCampaign.id !== id;

  const checks = [
    {
      key: "campaign_selected",
      title: "Đã chọn sự kiện",
      passed: Boolean(campaign),
      detail: campaign ? `${campaign.name} (${campaign.code})` : "Chưa chọn sự kiện",
    },
    {
      key: "status_valid",
      title: "Trạng thái sẵn sàng",
      passed: campaign.status !== "ended" && campaign.status !== "archived",
      detail: `Trạng thái hiện tại: ${campaign.status}`,
    },
    {
      key: "single_active",
      title: "Không xung đột sự kiện khác đang chạy",
      passed: !isAnotherActive,
      detail: isAnotherActive ? `Đang có sự kiện '${currentActiveCampaign.name}' đang chạy` : "Sẵn sàng kích hoạt",
    },
    {
      key: "participants_present",
      title: "Danh sách khách tham gia",
      passed: participantCount > 0,
      detail: participantCount > 0 ? `${participantCount} khách đã đăng ký` : "Chưa có khách tham gia",
    },
    {
      key: "rewards_available",
      title: "Danh mục giải thưởng",
      passed: activeRewardCount > 0,
      detail: activeRewardCount > 0 ? `${activeRewardCount} phần quà đang hoạt động` : "Chưa có giải thưởng active",
    },
    {
      key: "rules_configured",
      title: "Cấu hình mô hình phát thưởng / luật quay",
      passed: activeRuleCount > 0 || participantCount > 0,
      detail: activeRuleCount > 0 ? `${activeRuleCount} luật quay đang áp dụng` : "Sử dụng voucher cấp sẵn",
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const readinessScore = Math.round((passedCount / checks.length) * 100);
  const canActivate = checks.every((c) => c.passed);

  return {
    campaign,
    readinessScore,
    canActivate,
    checks,
    metrics: {
      participantCount,
      activeRewardCount,
      activeRuleCount,
      isAnotherActive,
    },
  };
}

export async function dryRunSpin({ db, campaignId, phone = "0900000000", spinNumber = 1 }) {
  const campaign = await getCampaign({ db, id: campaignId });
  const normalizedPhone = String(phone).trim() || "0900000000";

  const { data: rules } = await db
    .from("campaign_rules")
    .select("id,name,priority,scope")
    .eq("campaign_id", campaignId)
    .eq("active", true)
    .order("priority", { ascending: false });

  const { data: rewards } = await db
    .from("reward_catalog")
    .select("id,title,value,symbol,active")
    .eq("active", true);

  const matchedReward = rewards?.[0] || { id: "mock-r1", title: "Quà dùng thử 50k", value: 50000, symbol: "star" };

  return {
    success: true,
    dryRun: true,
    campaignId,
    campaignName: campaign.name,
    phone: normalizedPhone,
    spinNumber,
    simulatedOutcome: rules?.length > 0 ? "reward" : "better_luck",
    matchedReward: rules?.length > 0 ? matchedReward : null,
    rulesEvaluated: rules || [],
    note: "Đây là chế độ QUAY THỬ (Simulated). Không ghi dữ liệu thật, không trừ kho, không gửi ZNS.",
  };
}
