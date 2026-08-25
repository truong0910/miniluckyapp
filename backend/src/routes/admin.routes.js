import { Router } from "express";
import { authClient, supabase } from "../supabase.js";
import { requireAdmin } from "../middleware.js";
import { config } from "../config.js";
import { createDevelopmentAdminToken } from "../auth/admin-session.js";
import { asyncRoute, mapAssignment, mapBanner, mapCustomer, mapReward, normalizePhone, publicError } from "../utils.js";
import {
  createCampaign,
  dryRunSpin,
  getCampaign,
  getCampaignReadiness,
  listCampaigns,
  transitionCampaign,
  updateCampaign,
} from "../campaign-service.js";
import {
  checkImportCampaignParticipants,
  clearCustomerPreassignedRewards,
  cloneCampaign,
  createManualCampaignParticipant,
  deleteCampaignParticipant,
  ensureCampaignParticipant,
  getParticipantDetail,
  getParticipantPlannedRewards,
  importCampaignParticipants,
  issueManualAward,
  listCampaignParticipants,
  updateParticipantPlannedRewards,
  updateParticipantQuotaStatus,
} from "../campaign-reuse-service.js";
import {
  getCampaignInventorySummary,
  redeemAward,
  resendAwardDelivery,
  updateAwardStatus,
} from "../award-operations-service.js";
import {
  generateCampaignExportCsv,
  getCampaignAnalytics,
} from "../campaign-reporting-service.js";
import {
  addGroupMember,
  assignRuleToGroup,
  createGroup,
  deleteGroup,
  listGroupMembers,
  listGroupRules,
  listGroups,
  removeGroupMember,
  removeRuleFromGroup,
  renameGroup,
  replaceGroupMembers,
  replaceGroupRules,
} from "../customer-group-service.js";

const router = Router();

router.post("/auth/login", asyncRoute(async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");
  if (!email || !password) throw publicError("Vui lòng nhập email và mật khẩu");

  let session;
  let user;
  const authResult = await authClient.auth.signInWithPassword({ email, password });
  if (!authResult.error && authResult.data.session) {
    session = authResult.data.session;
    user = authResult.data.user;
  } else if (config.appEnv === "development" && config.adminAuthMode === "development" && config.adminEmail && config.adminPassword && email === config.adminEmail && password === config.adminPassword) {
    // Local fallback only for development. Production should use Supabase Auth.
    const accessToken = createDevelopmentAdminToken({ id: "local-development-admin", email, role: "admin" }, config.devAuthSecret);
    res.json({ accessToken, refreshToken: "", expiresAt: Date.now() + 30 * 60 * 1000, user: { email }, local: true });
    return;
  } else {
    throw publicError("Email hoặc mật khẩu không đúng", 401);
  }

  const { data: profile } = await supabase.from("admin_profiles").select("user_id,role").eq("user_id", user.id).maybeSingle();
  if (!profile) throw publicError("Tài khoản chưa được cấp quyền Admin", 403);
  res.json({ accessToken: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at, user: { id: user.id, email: user.email }, local: false });
}));

router.get("/auth/me", requireAdmin, (req, res) => {
  res.json({ user: req.admin.user, role: req.admin.profile.role });
});

const storageBucket = "campaign-assets";
async function resolveImageUrl(imageUrl, imageData) {
  if (!imageData) return String(imageUrl || "").trim();
  const match = String(imageData).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw publicError("Ảnh tải lên không hợp lệ");
  const [, contentType, encoded] = match;
  const extension = contentType.split("/")[1].replace("jpeg", "jpg");
  const path = `banners/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(storageBucket).upload(path, Buffer.from(encoded, "base64"), { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw publicError(`Không thể tải ảnh lên: ${error.message}`, 502);
  const { data } = supabase.storage.from(storageBucket).getPublicUrl(path);
  return data.publicUrl;
}

router.get("/banners", requireAdmin, asyncRoute(async (_req, res) => {
  const { data, error } = await supabase.from("banners").select("id,title,image_url,link_url,active,display_order,created_at,updated_at").order("display_order", { ascending: true });
  if (error) throw error;
  res.json({ items: (data || []).map(mapBanner) });
}));

router.post("/banners", requireAdmin, asyncRoute(async (req, res) => {
  const body = req.body || {};
  const imageUrl = await resolveImageUrl(body.imageUrl, body.imageData);
  if (!imageUrl) throw publicError("Banner cần có URL hoặc file ảnh");
  const record = { id: String(body.id || `banner-${crypto.randomUUID()}`), title: String(body.title || "Banner chương trình").trim(), image_url: imageUrl, link_url: String(body.linkUrl || "").trim() || null, active: body.active !== false, display_order: Number(body.order || 0) };
  const { data, error } = await supabase.from("banners").upsert(record).select("id,title,image_url,link_url,active,display_order").single();
  if (error) throw error;
  res.status(201).json(mapBanner(data));
}));

router.put("/banners/:id", requireAdmin, asyncRoute(async (req, res) => {
  const body = req.body || {};
  const patch = { title: String(body.title || "Banner chương trình").trim(), link_url: String(body.linkUrl || "").trim() || null, active: body.active !== false, display_order: Number(body.order || 0) };
  if (body.imageUrl || body.imageData) patch.image_url = await resolveImageUrl(body.imageUrl, body.imageData);
  const { data, error } = await supabase.from("banners").update(patch).eq("id", req.params.id).select("id,title,image_url,link_url,active,display_order").single();
  if (error) throw error;
  res.json(mapBanner(data));
}));

router.delete("/banners/:id", requireAdmin, asyncRoute(async (req, res) => {
  const { error } = await supabase.from("banners").delete().eq("id", req.params.id);
  if (error) throw error;
  res.status(204).end();
}));

router.get("/rewards", requireAdmin, asyncRoute(async (_req, res) => {
  const { data, error } = await supabase.from("reward_catalog").select("id,code_prefix,title,value,description,wheel_label,symbol,active,applicable_products,discount_rate").order("value", { ascending: false });
  if (error) throw error;
  res.json({ items: (data || []).map(mapReward) });
}));

router.post("/rewards", requireAdmin, asyncRoute(async (req, res) => {
  const body = req.body || {};
  const value = Number(body.value || 0);
  if (!body.title || !body.codePrefix || value <= 0) throw publicError("Tên, mã và giá trị quà là bắt buộc");
  const record = {
    id: String(body.id || `reward-${crypto.randomUUID()}`),
    code_prefix: String(body.codePrefix).trim().toUpperCase(),
    title: String(body.title).trim(),
    value,
    description: String(body.description || ""),
    wheel_label: String(body.wheelLabel || `${value.toLocaleString("vi-VN")}đ`),
    symbol: String(body.symbol || "star"),
    active: body.active !== false,
    applicable_products: String(body.applicableProducts || body.description || "Tất cả sản phẩm Kính Hồng Phúc").trim(),
    discount_rate: String(body.discountRate || "100").trim(),
  };
  const { data, error } = await supabase.from("reward_catalog").upsert(record).select("id,code_prefix,title,value,description,wheel_label,symbol,active,applicable_products,discount_rate").single();
  if (error) throw error;
  res.status(201).json(mapReward(data));
}));

router.put("/rewards/:id", requireAdmin, asyncRoute(async (req, res) => {
  const body = req.body || {};
  const value = Number(body.value || 0);
  if (!body.title || !body.codePrefix || value <= 0) throw publicError("Tên, mã và giá trị quà là bắt buộc");
  const record = {
    code_prefix: String(body.codePrefix).trim().toUpperCase(),
    title: String(body.title).trim(),
    value,
    description: String(body.description || ""),
    wheel_label: String(body.wheelLabel || `${value.toLocaleString("vi-VN")}đ`),
    symbol: String(body.symbol || "star"),
    active: body.active !== false,
    applicable_products: String(body.applicableProducts || body.description || "Tất cả sản phẩm Kính Hồng Phúc").trim(),
    discount_rate: String(body.discountRate || "100").trim(),
  };
  const { data, error } = await supabase.from("reward_catalog").update(record).eq("id", req.params.id).select("id,code_prefix,title,value,description,wheel_label,symbol,active,applicable_products,discount_rate").single();
  if (error) throw error;
  res.json(mapReward(data));
}));

router.delete("/rewards/:id", requireAdmin, asyncRoute(async (req, res) => {
  const { error } = await supabase.from("reward_catalog").delete().eq("id", req.params.id);
  if (error) throw publicError(`Không thể xóa quà: ${error.message}`, 409);
  res.status(204).end();
}));

async function loadAdminCustomer(id) {
  const { data: customer, error } = await supabase.from("customers").select("id,name,phone,sex,job,total_spins,deleted_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!customer) throw publicError("Không tìm thấy khách hàng", 404);

  const idsToMatch = [...new Set([customer.id, customer.phone, customer.phone ? `customer-${customer.phone}` : null].filter(Boolean))];

  const [legacyRes, awardsRes, spinsRes, awardsCountRes] = await Promise.all([
    supabase.from("customer_rewards").select("code,title,value,description,wheel_label,result,created_at").in("customer_id", idsToMatch).order("created_at", { ascending: true }),
    supabase.from("awards").select("code,title_snapshot,value_snapshot,description_snapshot,result,issued_at").in("customer_id", idsToMatch).order("issued_at", { ascending: true }),
    supabase.from("spin_events").select("id", { count: "exact", head: true }).in("customer_id", idsToMatch),
    supabase.from("awards").select("id", { count: "exact", head: true }).in("customer_id", idsToMatch),
  ]);

  if (legacyRes.error) throw legacyRes.error;
  if (awardsRes.error) throw awardsRes.error;

  const legacyList = (legacyRes.data || []).map(mapAssignment);
  const awardList = (awardsRes.data || []).map((row) => ({
    code: row.code,
    title: row.title_snapshot || row.code,
    value: Number(row.value_snapshot || 0),
    description: row.description_snapshot || "",
    wheelLabel: row.title_snapshot,
    result: row.result || ["star", "star", "star"],
    createdAt: row.issued_at,
  }));

  const allRewards = [...legacyList, ...awardList];
  const spinsFromEvents = spinsRes?.count || 0;
  const spinsFromAwards = awardsCountRes?.count || 0;
  const usedSpins = Math.max(spinsFromEvents, spinsFromAwards);
  const totalSpins = Number(customer.total_spins || 0);
  const remainingSpins = Math.max(0, totalSpins - usedSpins);

  return {
    ...mapCustomer(customer, allRewards),
    usedSpins,
    remainingSpins,
  };
}

router.get("/customers", requireAdmin, asyncRoute(async (req, res) => {
  const search = String(req.query.search || "").trim();
  let query = supabase.from("customers").select("id,name,phone,sex,job,total_spins,deleted_at,created_at").is("deleted_at", null).order("created_at", { ascending: false });
  if (search) query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  const items = await Promise.all((data || []).map((row) => loadAdminCustomer(row.id)));
  res.json({ items });
}));

router.post("/customers", requireAdmin, asyncRoute(async (req, res) => {
  const body = req.body || {};
  const phone = normalizePhone(body.phone);
  if (!/^0(3|5|7|8|9)\d{8}$/.test(phone)) throw publicError("Số điện thoại không hợp lệ");

  const { data: existingCust } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
  const id = existingCust?.id || String(body.id || `customer-${phone}`);
  const record = { id, phone, name: String(body.name || `Khách hàng ${phone}`).trim(), sex: body.sex || "other", job: body.job || "other", total_spins: Math.max(0, Number(body.totalSpins || 0)), deleted_at: null };
  const { error } = await supabase.from("customers").upsert(record);
  if (error) throw error;
  if (Array.isArray(body.rewards)) {
    const { error: delErr } = await supabase.from("customer_rewards").delete().eq("customer_id", id);
    if (delErr) throw delErr;

    const assignments = body.rewards.map((item, idx) => {
      const baseCode = String(item.code || item.reward?.code || item.codePrefix || item.reward?.codePrefix || item.id || "VOUCHER");
      const code = `${baseCode}-${Date.now()}-${idx}`;
      const title = String(item.title || item.reward?.title || "Voucher quà tặng").trim();
      const value = Math.max(1, Number(item.value ?? item.reward?.value ?? 1));
      const description = String(item.description || item.reward?.description || "");
      return {
        customer_id: id,
        code,
        title,
        value,
        description,
        wheel_label: title,
        result: ["star", "star", "star"],
      };
    }).filter((item) => item.title.length > 0);

    if (assignments.length > 0) {
      const { error: insErr } = await supabase.from("customer_rewards").insert(assignments);
      if (insErr) throw publicError(`Lỗi lưu Voucher: ${insErr.message}`);
    }
  }
  res.status(201).json(await loadAdminCustomer(id));
}));

router.put("/customers/:id", requireAdmin, asyncRoute(async (req, res) => {
  const body = req.body || {};
  const patch = { name: String(body.name || "").trim(), phone: normalizePhone(body.phone), sex: body.sex || "other", job: body.job || "other", total_spins: Math.max(0, Number(body.totalSpins || 0)) };
  if (!patch.name || !/^0(3|5|7|8|9)\d{8}$/.test(patch.phone)) throw publicError("Tên hoặc số điện thoại không hợp lệ");
  const { error } = await supabase.from("customers").update(patch).eq("id", req.params.id);
  if (error) throw error;
  if (Array.isArray(body.rewards)) {
    const { error: delErr } = await supabase.from("customer_rewards").delete().eq("customer_id", req.params.id);
    if (delErr) throw delErr;

    const assignments = body.rewards.map((item, idx) => {
      const baseCode = String(item.code || item.reward?.code || item.codePrefix || item.reward?.codePrefix || item.id || "VOUCHER");
      const code = `${baseCode}-${Date.now()}-${idx}`;
      const title = String(item.title || item.reward?.title || "Voucher quà tặng").trim();
      const value = Math.max(1, Number(item.value ?? item.reward?.value ?? 1));
      const description = String(item.description || item.reward?.description || "");
      return {
        customer_id: req.params.id,
        code,
        title,
        value,
        description,
        wheel_label: title,
        result: ["star", "star", "star"],
      };
    }).filter((item) => item.title.length > 0);

    if (assignments.length > 0) {
      const { error: insErr } = await supabase.from("customer_rewards").insert(assignments);
      if (insErr) throw publicError(`Lỗi lưu Voucher: ${insErr.message}`);
    }
  }
  res.json(await loadAdminCustomer(req.params.id));
}));

router.delete("/customers/:id", requireAdmin, asyncRoute(async (req, res) => {
  const { error } = await supabase.from("customers").update({ deleted_at: new Date().toISOString() }).eq("id", req.params.id);
  if (error) throw error;
  res.status(204).end();
}));

router.get("/rules", requireAdmin, asyncRoute(async (_req, res) => {
  const { data, error } = await supabase.from("program_settings").select("value").eq("key", "program_rules").maybeSingle();
  if (error) throw error;
  res.json({ rules: data?.value || null });
}));

router.put("/rules", requireAdmin, asyncRoute(async (req, res) => {
  const { data, error } = await supabase.from("program_settings").upsert({ key: "program_rules", value: req.body || {} }).select("key,value").single();
  if (error) throw error;
  res.json({ rules: data.value });
}));

router.get("/campaigns", requireAdmin, asyncRoute(async (req, res) => {
  const items = await listCampaigns({
    db: supabase,
    status: req.query.status,
    includeArchived: req.query.includeArchived === "true",
  });
  res.json({ items });
}));

router.post("/campaigns", requireAdmin, asyncRoute(async (req, res) => {
  const item = await createCampaign({ db: supabase, input: req.body || {} });
  res.status(201).json(item);
}));

router.get("/campaigns/:id", requireAdmin, asyncRoute(async (req, res) => {
  const item = await getCampaign({ db: supabase, id: req.params.id });
  res.json(item);
}));

router.put("/campaigns/:id", requireAdmin, asyncRoute(async (req, res) => {
  const item = await updateCampaign({ db: supabase, id: req.params.id, input: req.body || {} });
  res.json(item);
}));

router.post("/campaigns/:id/status", requireAdmin, asyncRoute(async (req, res) => {
  const item = await transitionCampaign({ db: supabase, id: req.params.id, status: req.body?.status });
  res.json(item);
}));

router.post("/campaigns/:id/clone", requireAdmin, asyncRoute(async (req, res) => {
  const item = await cloneCampaign({
    db: supabase,
    sourceCampaignId: req.params.id,
    newCode: req.body?.code,
    newName: req.body?.name,
    cloneMode: req.body?.cloneMode || "config_only",
  });
  res.status(201).json(item);
}));

router.get("/campaigns/:id/participants", requireAdmin, asyncRoute(async (req, res) => {
  const result = await listCampaignParticipants({
    db: supabase,
    campaignId: req.params.id,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    search: String(req.query.search || ""),
  });
  res.json(result);
}));

router.post("/campaigns/:id/participants", requireAdmin, asyncRoute(async (req, res) => {
  const result = await importCampaignParticipants({
    db: supabase,
    campaignId: req.params.id,
    rows: Array.isArray(req.body?.rows) ? req.body.rows : [],
    importMode: req.body?.importMode || "voucher",
  });
  res.json(result);
}));

router.post("/campaigns/:id/participants/check-import", requireAdmin, asyncRoute(async (req, res) => {
  const result = await checkImportCampaignParticipants({
    db: supabase,
    campaignId: req.params.id,
    rows: Array.isArray(req.body?.rows) ? req.body.rows : [],
    importMode: req.body?.importMode || "voucher",
  });
  res.json(result);
}));

router.post("/campaigns/:id/participants/import", requireAdmin, asyncRoute(async (req, res) => {
  const result = await importCampaignParticipants({
    db: supabase,
    campaignId: req.params.id,
    rows: Array.isArray(req.body?.rows) ? req.body.rows : [],
    importMode: req.body?.importMode || "voucher",
    rowActions: req.body?.rowActions || {},
    duplicateMode: req.body?.duplicateMode || "skip",
  });
  res.json(result);
}));

router.post("/campaigns/:id/participants/manual", requireAdmin, asyncRoute(async (req, res) => {
  const item = await createManualCampaignParticipant({
    db: supabase,
    campaignId: req.params.id,
    name: req.body?.name,
    phone: req.body?.phone,
    spinQuota: req.body?.spinQuota,
    status: req.body?.status,
    groupName: req.body?.groupName || req.body?.importedGroup || "",
    groupId: req.body?.groupId || null,
    note: req.body?.note || "",
    selectedRewardIds: Array.isArray(req.body?.selectedRewardIds) ? req.body.selectedRewardIds : [],
  });
  res.status(201).json(item);
}));

router.get("/campaigns/:campaignId/participants/:customerId", requireAdmin, asyncRoute(async (req, res) => {
  const item = await getParticipantDetail({
    db: supabase,
    campaignId: req.params.campaignId,
    customerId: req.params.customerId,
  });
  res.json(item);
}));

router.put("/campaigns/:campaignId/participants/:customerId", requireAdmin, asyncRoute(async (req, res) => {
  const item = await updateParticipantQuotaStatus({
    db: supabase,
    campaignId: req.params.campaignId,
    customerId: req.params.customerId,
    status: req.body?.status,
    spinQuota: req.body?.spinQuota,
    name: req.body?.name,
    groupName: req.body?.groupName || req.body?.importedGroup || "",
    groupId: req.body?.groupId || null,
    note: req.body?.note || "",
    selectedRewardIds: req.body?.selectedRewardIds,
  });
  res.json(item);
}));

router.delete("/campaigns/:campaignId/participants/:customerId/rewards", requireAdmin, asyncRoute(async (req, res) => {
  const result = await clearCustomerPreassignedRewards({
    db: supabase,
    campaignId: req.params.campaignId,
    customerId: req.params.customerId,
  });
  res.json(result);
}));

router.delete("/campaigns/:campaignId/participants/:customerId", requireAdmin, asyncRoute(async (req, res) => {
  const result = await deleteCampaignParticipant({
    db: supabase,
    campaignId: req.params.campaignId,
    customerId: req.params.customerId,
  });
  res.json(result);
}));

router.get("/campaigns/:campaignId/participants/:customerId/rewards", requireAdmin, asyncRoute(async (req, res) => {
  const items = await getParticipantPlannedRewards({
    db: supabase,
    campaignId: req.params.campaignId,
    customerId: req.params.customerId,
  });
  res.json({ items });
}));

router.put("/campaigns/:campaignId/participants/:customerId/rewards", requireAdmin, asyncRoute(async (req, res) => {
  const items = await updateParticipantPlannedRewards({
    db: supabase,
    campaignId: req.params.campaignId,
    customerId: req.params.customerId,
    assignments: Array.isArray(req.body?.assignments) ? req.body.assignments : [],
  });
  res.json({ items });
}));

router.post("/campaigns/:campaignId/participants/:customerId/manual-awards", requireAdmin, asyncRoute(async (req, res) => {
  const item = await issueManualAward({
    db: supabase,
    campaignId: req.params.campaignId,
    customerId: req.params.customerId,
    rewardId: req.body?.rewardId,
    code: req.body?.code,
    reason: req.body?.reason,
    issuedBy: req.admin?.email || "admin",
  });
  res.status(201).json(item);
}));

router.post("/awards/:id/redeem", requireAdmin, asyncRoute(async (req, res) => {
  const item = await redeemAward({ db: supabase, awardId: req.params.id, redeemedBy: req.admin?.email || "admin" });
  res.json(item);
}));

router.post("/awards/:id/resend", requireAdmin, asyncRoute(async (req, res) => {
  const item = await resendAwardDelivery({ db: supabase, awardId: req.params.id });
  res.json(item);
}));

router.post("/awards/:id/status", requireAdmin, asyncRoute(async (req, res) => {
  const item = await updateAwardStatus({
    db: supabase,
    awardId: req.params.id,
    status: req.body?.status,
    reason: req.body?.reason,
  });
  res.json(item);
}));

router.get("/campaigns/:id/inventory", requireAdmin, asyncRoute(async (req, res) => {
  const summary = await getCampaignInventorySummary({ db: supabase, campaignId: req.params.id });
  res.json({ items: summary });
}));

router.get("/campaigns/:id/analytics", requireAdmin, asyncRoute(async (req, res) => {
  const result = await getCampaignAnalytics({ db: supabase, campaignId: req.params.id });
  res.json(result);
}));

router.get("/campaigns/:id/readiness", requireAdmin, asyncRoute(async (req, res) => {
  const readiness = await getCampaignReadiness({ db: supabase, id: req.params.id });
  res.json(readiness);
}));

router.post("/campaigns/:id/dry-run-spin", requireAdmin, asyncRoute(async (req, res) => {
  const result = await dryRunSpin({
    db: supabase,
    campaignId: req.params.id,
    phone: req.body?.phone,
    spinNumber: req.body?.spinNumber,
  });
  res.json(result);
}));

router.get("/campaigns/:id/export", requireAdmin, asyncRoute(async (req, res) => {
  const csv = await generateCampaignExportCsv({ db: supabase, campaignId: req.params.id });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="campaign-${req.params.id}-export.csv"`);
  res.send(csv);
}));

router.get("/groups", requireAdmin, asyncRoute(async (req, res) => {
  const result = await listGroups({ db: supabase, search: req.query.search || "" });
  res.json(result);
}));

router.get("/customer-groups", requireAdmin, asyncRoute(async (req, res) => {
  const result = await listGroups({ db: supabase, search: req.query.search || "" });
  res.json(result);
}));

router.post("/groups", requireAdmin, asyncRoute(async (req, res) => {
  const group = await createGroup({ db: supabase, name: req.body?.name });
  res.status(201).json(group);
}));

router.put("/groups/:id", requireAdmin, asyncRoute(async (req, res) => {
  const group = await renameGroup({ db: supabase, id: req.params.id, name: req.body?.name });
  res.json(group);
}));

router.delete("/groups/:id", requireAdmin, asyncRoute(async (req, res) => {
  const result = await deleteGroup({ db: supabase, id: req.params.id });
  res.json(result);
}));

router.get("/groups/:id/members", requireAdmin, asyncRoute(async (req, res) => {
  const page = parseInt(String(req.query.page || 1), 10) || 1;
  const limit = parseInt(String(req.query.limit || 20), 10) || 20;
  const result = await listGroupMembers({
    db: supabase,
    groupId: req.params.id,
    page,
    limit,
    search: req.query.search || "",
  });
  res.json(result);
}));

router.post("/groups/:id/members", requireAdmin, asyncRoute(async (req, res) => {
  if (Array.isArray(req.body?.customerIds)) {
    const result = await replaceGroupMembers({ db: supabase, groupId: req.params.id, customerIds: req.body.customerIds });
    return res.json(result);
  }
  const result = await addGroupMember({ db: supabase, groupId: req.params.id, customerId: req.body?.customerId });
  res.json(result);
}));

router.post("/groups/:id/members/:customerId", requireAdmin, asyncRoute(async (req, res) => {
  const result = await addGroupMember({ db: supabase, groupId: req.params.id, customerId: req.params.customerId });
  res.json(result);
}));

router.delete("/groups/:id/members/:customerId", requireAdmin, asyncRoute(async (req, res) => {
  const result = await removeGroupMember({ db: supabase, groupId: req.params.id, customerId: req.params.customerId });
  res.json(result);
}));

router.get("/groups/:id/rules", requireAdmin, asyncRoute(async (req, res) => {
  const result = await listGroupRules({ db: supabase, groupId: req.params.id, campaignId: req.query.campaignId || "" });
  res.json(result);
}));

router.post("/groups/:id/rules", requireAdmin, asyncRoute(async (req, res) => {
  if (Array.isArray(req.body?.ruleIds)) {
    const result = await replaceGroupRules({
      db: supabase,
      groupId: req.params.id,
      ruleIds: req.body.ruleIds,
      campaignId: req.body?.campaignId || req.query?.campaignId || "",
    });
    return res.json(result);
  }
  const result = await assignRuleToGroup({ db: supabase, groupId: req.params.id, ruleId: req.body?.ruleId });
  res.json(result);
}));

router.post("/groups/:id/rules/:ruleId", requireAdmin, asyncRoute(async (req, res) => {
  const result = await assignRuleToGroup({ db: supabase, groupId: req.params.id, ruleId: req.params.ruleId });
  res.json(result);
}));

router.delete("/groups/:id/rules/:ruleId", requireAdmin, asyncRoute(async (req, res) => {
  const result = await removeRuleFromGroup({ db: supabase, groupId: req.params.id, ruleId: req.params.ruleId });
  res.json(result);
}));

async function loadCampaignRule(id) {
  const { data: rule, error } = await supabase.from("campaign_rules").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: spins, error: spinError } = await supabase.from("rule_spin_configs").select("id,spin_number,spin_count,win_rate,max_wins,special_conditions").eq("rule_id", id).order("spin_number", { ascending: true });
  if (spinError) throw spinError;
  const spinIds = (spins || []).map((spin) => spin.id);
  const rewards = spinIds.length ? await supabase.from("rule_spin_rewards").select("spin_config_id,reward_id,probability,quantity,remaining_quantity").in("spin_config_id", spinIds) : { data: [], error: null };
  if (rewards.error) throw rewards.error;

  const mappedSpins = (spins || []).map((spin) => {
    const spinRewards = (rewards.data || [])
      .filter((item) => item.spin_config_id === spin.id)
      .map((item) => ({
        ...item,
        rewardId: item.reward_id,
        spinConfigId: item.spin_config_id,
        remainingQuantity: item.remaining_quantity,
      }));
    return {
      ...spin,
      spinNumber: spin.spin_number,
      spinCount: spin.spin_count,
      winRate: spin.win_rate,
      maxWins: spin.max_wins,
      specialConditions: spin.special_conditions,
      rewards: spinRewards,
    };
  });

  return {
    ...rule,
    campaignId: rule.campaign_id,
    oaRequired: rule.oa_required,
    allowUnlisted: rule.allow_unlisted,
    spins: mappedSpins,
  };
}

const LEGACY_CAMPAIGN_ID = "00000000-0000-0000-0000-000000000001";

async function saveCampaignRule(body, id) {
  const campaignId = String(body.campaignId || body.campaign_id || "").trim();
  const ruleRecord = {
    ...(id ? { id } : {}),
    name: String(body.name || "Rule mới").trim(),
    code: String(body.code || `RULE_${crypto.randomUUID()}`).trim(),
    scope: body.scope || "default",
    priority: Number(body.priority || 0),
    active: body.active !== false,
    allow_unlisted: body.allowUnlisted === true || body.allow_unlisted === true,
    oa_required: body.oaRequired === true || body.oa_required === true,
    allow_refollow: body.allowRefollow !== false && body.allow_refollow !== false,
    max_total_wins: body.maxTotalWins == null && body.max_total_wins == null ? null : Number(body.maxTotalWins ?? body.max_total_wins),
    starts_at: body.startsAt || body.starts_at || null,
    ends_at: body.endsAt || body.ends_at || null,
    ...(campaignId ? { campaign_id: campaignId } : (!id ? { campaign_id: LEGACY_CAMPAIGN_ID } : {})),
  };
  const { data: rule, error } = await supabase.from("campaign_rules").upsert(ruleRecord).select("*").single();
  if (error) throw error;
  await supabase.from("rule_spin_configs").delete().eq("rule_id", rule.id);
  for (const spin of Array.isArray(body.spins) ? body.spins : []) {
    const spinNumber = Number(spin.spinNumber ?? spin.spin_number ?? 1);
    const spinCount = Number(spin.spinCount ?? spin.spin_count ?? 1);
    const winRate = Number(spin.winRate ?? spin.win_rate ?? 100);
    const maxWins = spin.maxWins == null && spin.max_wins == null ? null : Number(spin.maxWins ?? spin.max_wins);
    const specialConditions = spin.specialConditions || spin.special_conditions || {};

    const { data: configRow, error: configError } = await supabase
      .from("rule_spin_configs")
      .insert({
        rule_id: rule.id,
        spin_number: spinNumber,
        spin_count: spinCount,
        win_rate: winRate,
        max_wins: maxWins,
        special_conditions: specialConditions,
      })
      .select("id")
      .single();

    if (configError) throw configError;

    const rows = (Array.isArray(spin.rewards) ? spin.rewards : [])
      .map((reward) => ({
        spin_config_id: configRow.id,
        reward_id: reward.rewardId || reward.reward_id || "",
        probability: Number(reward.probability ?? 100),
        quantity: Number(reward.quantity ?? 1),
        remaining_quantity: Number(reward.remainingQuantity ?? reward.remaining_quantity ?? reward.quantity ?? 1),
      }))
      .filter((reward) => reward.reward_id && reward.quantity > 0);

    if (rows.length) {
      const { error: rewardError } = await supabase.from("rule_spin_rewards").insert(rows);
      if (rewardError) throw rewardError;
    }
  }
  return loadCampaignRule(rule.id);
}

router.get("/campaign-rules", requireAdmin, asyncRoute(async (_req, res) => {
  const campaignId = String(_req.query.campaignId || "").trim();
  let query = supabase.from("campaign_rules").select("id").order("priority", { ascending: false });
  if (campaignId) query = query.eq("campaign_id", campaignId);
  const { data, error } = await query;
  if (error) throw error;
  res.json({ items: await Promise.all((data || []).map((row) => loadCampaignRule(row.id))) });
}));

router.post("/campaign-rules", requireAdmin, asyncRoute(async (req, res) => {
  res.status(201).json(await saveCampaignRule(req.body || {}, null));
}));

router.put("/campaign-rules/:id", requireAdmin, asyncRoute(async (req, res) => {
  res.json(await saveCampaignRule(req.body || {}, req.params.id));
}));

router.delete("/campaign-rules/:id", requireAdmin, asyncRoute(async (req, res) => {
  const { error } = await supabase.from("campaign_rules").delete().eq("id", req.params.id);
  if (error) throw error;
  res.status(204).end();
}));


router.post("/campaign-rules/:id/assign-customers", requireAdmin, asyncRoute(async (req, res) => {
  const customerIds = Array.isArray(req.body?.customerIds) ? req.body.customerIds : [];
  await supabase.from("customer_rule_assignments").delete().eq("rule_id", req.params.id);
  if (customerIds.length) {
    const { error } = await supabase.from("customer_rule_assignments").insert(customerIds.map((customerId) => ({ customer_id: customerId, rule_id: req.params.id })));
    if (error) throw error;
  }
  res.json({ ok: true });
}));

router.post("/campaign-rules/:id/assign-groups", requireAdmin, asyncRoute(async (req, res) => {
  const groupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds : [];
  await supabase.from("group_rule_assignments").delete().eq("rule_id", req.params.id);
  if (groupIds.length) {
    const { error } = await supabase.from("group_rule_assignments").insert(groupIds.map((groupId) => ({ group_id: groupId, rule_id: req.params.id })));
    if (error) throw error;
  }
  res.json({ ok: true });
}));

router.get("/analytics", requireAdmin, asyncRoute(async (_req, res) => {
  const [customers, spins, winners] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("spin_events").select("id", { count: "exact", head: true }),
    supabase.from("spin_events").select("id", { count: "exact", head: true }).eq("outcome", "reward"),
  ]);
  for (const result of [customers, spins, winners]) if (result.error) throw result.error;
  res.json({ customers: customers.count || 0, spins: spins.count || 0, winners: winners.count || 0 });
}));

router.get("/awards", requireAdmin, asyncRoute(async (req, res) => {
  const page = Math.max(1, Math.min(Number(req.query.page) || 1, 100));
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
  const status = String(req.query.status || "").trim();
  const search = String(req.query.search || "").trim();

  let query = supabase
    .from("awards")
    .select("id,campaign_id,spin_event_id,customer_id,reward_id,code,title_snapshot,value_snapshot,description_snapshot,result,status,issued_at,delivered_at,redeemed_at,expires_at,created_at", { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }
  if (search) {
    query = query.or(`code.ilike.%${search}%,title_snapshot.ilike.%${search}%`);
  }

  const start = (page - 1) * limit;
  query = query
    .order("created_at", { ascending: false })
    .range(start, start + limit - 1);

  const { data: rows, count, error } = await query;
  if (error) throw error;

  const customerIds = [...new Set((rows || []).map((row) => row.customer_id))];
  const customersMap = new Map();
  if (customerIds.length > 0) {
    const { data: custRows } = await supabase
      .from("customers")
      .select("id,name,phone")
      .in("id", customerIds);
    for (const c of custRows || []) {
      customersMap.set(c.id, c);
    }
  }

  const items = (rows || []).map((row) => {
    const cust = customersMap.get(row.customer_id);
    return {
      id: row.id,
      campaignId: row.campaign_id,
      spinEventId: row.spin_event_id,
      customerId: row.customer_id,
      customerName: cust?.name || row.customer_id,
      customerPhone: cust?.phone || "",
      rewardId: row.reward_id ?? null,
      code: row.code,
      title: row.title_snapshot,
      value: Number(row.value_snapshot),
      description: row.description_snapshot || "",
      result: row.result,
      status: row.status,
      issuedAt: row.issued_at ?? null,
      deliveredAt: row.delivered_at ?? null,
      redeemedAt: row.redeemed_at ?? null,
      expiresAt: row.expires_at ?? null,
      createdAt: row.created_at,
    };
  });

  res.json({
    items,
    page,
    limit,
    total: count || 0,
    hasMore: start + items.length < (count || 0),
  });
}));

router.get("/system-config", requireAdmin, asyncRoute(async (_req, res) => {
  const { data, error } = await supabase
    .from("program_settings")
    .select("value")
    .eq("key", "system_env_config")
    .maybeSingle();
  if (error) throw error;

  const saved = data?.value || {};
  res.json({
    appEnv: saved.appEnv || config.appEnv || "development",
    participantAuthMode: saved.participantAuthMode || config.participantAuthMode || "preview",
    adminAuthMode: saved.adminAuthMode || config.adminAuthMode || "development",
    apiBaseUrl: saved.apiBaseUrl || process.env.VITE_API_BASE_URL || "http://localhost:8787/api/v1",
    zaloAppSecret: saved.zaloAppSecret ? "*****" : (process.env.ZALO_APP_SECRET ? "*****" : ""),
    zaloOaId: saved.zaloOaId || process.env.VITE_ZALO_OA_ID || "",
    zbsApiKey: saved.zbsApiKey ? "*****" : (process.env.ZBS_API_KEY ? "*****" : ""),
    zbsTemplateId: saved.zbsTemplateId || process.env.ZBS_TEMPLATE_ID || "",
    googleSheetsWebhookUrl: saved.googleSheetsWebhookUrl || process.env.GOOGLE_SHEETS_WEBHOOK_URL || "",
    allowUnlisted: saved.allowUnlisted ?? false,
    unlistedSpinQuota: saved.unlistedSpinQuota ?? 1,
    oaRequired: saved.oaRequired ?? false,
  });
}));

router.put("/system-config", requireAdmin, asyncRoute(async (req, res) => {
  const input = req.body || {};
  const { data: currentSetting } = await supabase
    .from("program_settings")
    .select("value")
    .eq("key", "system_env_config")
    .maybeSingle();

  const prevValue = currentSetting?.value || {};
  const newValue = {
    ...prevValue,
    appEnv: input.appEnv || "development",
    participantAuthMode: input.participantAuthMode || "preview",
    adminAuthMode: input.adminAuthMode || "development",
    apiBaseUrl: input.apiBaseUrl || "http://localhost:8787/api/v1",
    zaloOaId: input.zaloOaId || "",
    zbsTemplateId: input.zbsTemplateId || "",
    googleSheetsWebhookUrl: input.googleSheetsWebhookUrl || "",
    allowUnlisted: Boolean(input.allowUnlisted),
    unlistedSpinQuota: Math.max(0, Number(input.unlistedSpinQuota || 1)),
    oaRequired: Boolean(input.oaRequired),
    updatedAt: new Date().toISOString(),
  };

  if (input.zaloAppSecret && input.zaloAppSecret !== "*****") {
    newValue.zaloAppSecret = input.zaloAppSecret;
  }
  if (input.zbsApiKey && input.zbsApiKey !== "*****") {
    newValue.zbsApiKey = input.zbsApiKey;
  }

  const { error } = await supabase
    .from("program_settings")
    .upsert({ key: "system_env_config", value: newValue });

  if (error) throw error;
  res.json({ success: true, config: newValue });
}));

export default router;
