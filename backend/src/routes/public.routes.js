import { Router } from "express";
import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { requireAdmin, requireParticipant } from "../middleware.js";
import { assertPreviewAuthAllowed, createParticipantSession, resolveZaloPhone } from "../participant-auth.js";
import { spinOnce } from "../spin-service.js";
import { asyncRoute, isValidVietnamesePhone, mapAssignment, mapBanner, mapCustomer, mapReward, normalizePhone, publicError } from "../utils.js";

const router = Router();

async function loadCustomer(customer) {
  const { data: rewardRows, error } = await supabase
    .from("customer_rewards")
    .select("code,title,value,description,wheel_label,result,created_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return mapCustomer(customer, (rewardRows || []).map(mapAssignment));
}

function buildWheelSegments(customer, catalog) {
  const segments = new Map();
  for (const reward of catalog.filter((item) => item.active)) {
    segments.set(`reward-value-${reward.value}`, {
      id: `reward-value-${reward.value}`,
      label: reward.wheelLabel,
      type: "reward",
    });
  }
  for (const assignment of customer.rewards) {
    const value = assignment.reward.value;
    if (value > 0 && !segments.has(`reward-value-${value}`)) {
      segments.set(`reward-value-${value}`, {
        id: `reward-value-${value}`,
        label: assignment.reward.wheelLabel || `${value.toLocaleString("vi-VN")}đ`,
        type: "reward",
      });
    }
  }
  segments.set("better-luck", { id: "better-luck", label: "MAY MẮN", type: "better_luck" });
  return [...segments.values()];
}

async function loadParticipantResponse(row, session) {
  const customer = await loadCustomer(row);
  const { count, error: countError } = await supabase
    .from("spin_events")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", row.id);
  if (countError) throw countError;
  const catalogResult = await supabase
    .from("reward_catalog")
    .select("id,code_prefix,title,value,description,wheel_label,symbol,active")
    .eq("active", true)
    .order("value", { ascending: false });
  if (catalogResult.error) throw catalogResult.error;
  const participant = {
    ...customer,
    spinsTotal: customer.totalSpins,
    rewardsTotal: customer.rewards.length,
    spinsRemaining: Math.max(0, customer.totalSpins - Number(count || 0)),
    wheelSegments: buildWheelSegments(customer, (catalogResult.data || []).map(mapReward)),
  };
  return { ...participant, session: session ? { token: session.token, expiresAt: session.expiresAt } : undefined };
}

router.get("/content", asyncRoute(async (_req, res) => {
  const [banners, rewards, settings] = await Promise.all([
    supabase.from("banners").select("id,title,image_url,link_url,active,display_order").eq("active", true).order("display_order", { ascending: true }),
    supabase.from("reward_catalog").select("id,code_prefix,title,value,description,wheel_label,symbol,active").eq("active", true).order("value", { ascending: false }),
    supabase.from("program_settings").select("key,value").eq("key", "program_rules").maybeSingle(),
  ]);
  for (const result of [banners, rewards, settings]) if (result.error) throw result.error;
  res.json({
    banners: (banners.data || []).map(mapBanner),
    rewards: (rewards.data || []).map(mapReward),
    rules: settings.data?.value || null,
    // Only expose a boolean; never expose the ZBS credentials to the Mini App.
    zbsConfigured: Boolean(config.zbsApiKey && config.zbsTemplateId),
  });
}));

async function findParticipantCustomer(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!isValidVietnamesePhone(normalizedPhone)) throw publicError("Invalid phone number");
  const { data: row, error } = await supabase
    .from("customers")
    .select("id,name,phone,sex,job,total_spins,deleted_at")
    .eq("phone", normalizedPhone)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw publicError("Phone number is not eligible", 404);
  return row;
}

router.post("/participant/sessions/preview", asyncRoute(async (req, res) => {
  assertPreviewAuthAllowed(config);
  const row = await findParticipantCustomer(req.body?.phone);
  const session = await createParticipantSession({ db: supabase, customerId: row.id, authMethod: "preview", ttlSeconds: config.participantSessionTtlSeconds });
  res.status(201).json(await loadParticipantResponse(row, session));
}));

router.post("/participant/sessions/zalo", asyncRoute(async (req, res) => {
  if (config.participantAuthMode !== "zalo") throw publicError("Zalo authentication is not enabled", 404);
  const phone = await resolveZaloPhone({
    accessToken: req.body?.accessToken,
    phoneToken: req.body?.phoneToken,
    appSecret: config.zaloAppSecret,
    baseUrl: config.zaloGraphBaseUrl,
  });
  const row = await findParticipantCustomer(phone);
  const zaloName = String(req.body?.zaloName || "").trim();
  if (zaloName && /^(khach hang|khach moi|customer|new customer)\s/i.test(String(row.name || ""))) {
    const { error } = await supabase.from("customers").update({ name: zaloName }).eq("id", row.id);
    if (error) throw error;
    row.name = zaloName;
  }
  const session = await createParticipantSession({ db: supabase, customerId: row.id, authMethod: "zalo", ttlSeconds: config.participantSessionTtlSeconds });
  res.status(201).json(await loadParticipantResponse(row, session));
}));

router.get("/participant/me", requireParticipant, asyncRoute(async (req, res) => {
  const { data: row, error } = await supabase
    .from("customers")
    .select("id,name,phone,sex,job,total_spins,deleted_at")
    .eq("id", req.participant.customerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw publicError("Participant is not available", 404);
  res.json(await loadParticipantResponse(row));
}));

router.get("/participant/me/spins", requireParticipant, asyncRoute(async (req, res) => {
  const { data, error } = await supabase
    .from("spin_events")
    .select("id,outcome,reward_id,reward_code,metadata,created_at")
    .eq("customer_id", req.participant.customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  res.json({ items: data || [] });
}));

router.post("/customers/lookup", asyncRoute(async (req, res) => {
  throw publicError("This endpoint was replaced by participant sessions", 410);
  const phone = normalizePhone(req.body?.phone);
  if (!isValidVietnamesePhone(phone)) throw publicError("Số điện thoại không hợp lệ");

  const { data: row, error } = await supabase
    .from("customers")
    .select("id,name,phone,sex,job,total_spins,deleted_at")
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw publicError("Số điện thoại không nằm trong danh sách được cấp lượt quay", 404);

  const zaloName = String(req.body?.zaloName || "").trim();
  if (zaloName && /^(khách hàng|khách mới|khach hang|khach moi)\s/i.test(row.name || "")) {
    await supabase.from("customers").update({ name: zaloName }).eq("id", row.id);
    row.name = zaloName;
  }

  const customer = await loadCustomer(row);
  const { count, error: countError } = await supabase
    .from("spin_events")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", row.id);
  if (countError) throw countError;
  const catalogResult = await supabase
    .from("reward_catalog")
    .select("id,code_prefix,title,value,description,wheel_label,symbol,active")
    .eq("active", true)
    .order("value", { ascending: false });
  if (catalogResult.error) throw catalogResult.error;
  const spinsRemaining = Math.max(0, customer.totalSpins - Number(count || 0));
  res.json({ ...customer, spinsTotal: customer.totalSpins, rewardsTotal: customer.rewards.length, spinsRemaining, wheelSegments: buildWheelSegments(customer, (catalogResult.data || []).map(mapReward)) });
}));

router.get("/customers/:id", asyncRoute(async (req, res) => {
  throw publicError("This endpoint was replaced by participant sessions", 410);
  const { data: row, error } = await supabase
    .from("customers")
    .select("id,name,phone,sex,job,total_spins,deleted_at")
    .eq("id", req.params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw publicError("Không tìm thấy khách hàng", 404);
  const customer = await loadCustomer(row);
  const { count, error: countError } = await supabase.from("spin_events").select("id", { count: "exact", head: true }).eq("customer_id", row.id);
  if (countError) throw countError;
  const { data: catalog, error: catalogError } = await supabase.from("reward_catalog").select("id,code_prefix,title,value,description,wheel_label,symbol,active").eq("active", true).order("value", { ascending: false });
  if (catalogError) throw catalogError;
  res.json({ ...customer, spinsTotal: customer.totalSpins, rewardsTotal: customer.rewards.length, spinsRemaining: Math.max(0, customer.totalSpins - Number(count || 0)), wheelSegments: buildWheelSegments(customer, (catalog || []).map(mapReward)) });
}));

router.get("/customers/:id/spins", asyncRoute(async (req, res) => {
  throw publicError("This endpoint was replaced by participant sessions", 410);
  const { data, error } = await supabase.from("spin_events").select("id,outcome,reward_id,reward_code,metadata,created_at").eq("customer_id", req.params.id).order("created_at", { ascending: false });
  if (error) throw error;
  res.json({ items: data || [] });
}));

router.post("/spins", requireParticipant, asyncRoute(async (req, res) => {
  const idempotencyKey = String(req.headers["idempotency-key"] || "").trim();
  // OA follow status is server-owned until a verified OA adapter is enabled.
  const result = await spinOnce({
    db: supabase,
    participant: req.participant,
    idempotencyKey,
    oaFollowed: false,
    source: "participant",
  });
  res.json(result);
}));

router.post("/spins-legacy-disabled", asyncRoute(async (req, res) => {
  throw publicError("This endpoint was replaced by participant sessions", 410);
  const customerId = String(req.body?.customerId || "").trim();
  if (!customerId) throw publicError("Thiếu customerId");

  const { data: row, error } = await supabase.from("customers").select("id,name,phone,sex,job,total_spins,deleted_at").eq("id", customerId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!row) throw publicError("Không tìm thấy khách hàng", 404);

  const { data: events, error: eventError } = await supabase.from("spin_events").select("id").eq("customer_id", customerId);
  if (eventError) throw eventError;
  const nextSpinIndex = events?.length || 0;
  if (nextSpinIndex >= Number(row.total_spins || 0)) throw publicError("Bạn đã hết lượt quay", 409);

  const customer = await loadCustomer(row);
  const assignment = customer.rewards[nextSpinIndex] || null;
  const ruleOutcome = await chooseRuleOutcome(customer, nextSpinIndex + 1, Boolean(req.body?.oaFollowed));
  const outcome = ruleOutcome?.outcome || (assignment ? "reward" : "better_luck");
  const reward = ruleOutcome?.reward || assignment?.reward || null;
  const spin = {
    customer_id: customerId,
    rule_id: ruleOutcome?.ruleId || null,
    spin_number: nextSpinIndex + 1,
    outcome,
    reward_id: ruleOutcome?.rewardId || null,
    reward_code: reward?.code || null,
    metadata: { source: "backend", phone: row.phone },
  };
  if (reward && !spin.reward_id) {
    const { data: rewardRow } = await supabase.from("reward_catalog").select("id").eq("value", reward.value).limit(1).maybeSingle();
    spin.reward_id = rewardRow?.id || null;
  }
  const { data: inserted, error: insertError } = await supabase.from("spin_events").insert(spin).select("id,created_at").single();
  if (insertError) throw insertError;

  res.json({
    spinId: inserted.id,
    timestamp: inserted.created_at,
    outcome,
    wheelSegmentId: reward ? `reward-value-${reward.value}` : "better-luck",
    result: ruleOutcome?.result || assignment?.result || ["cherry", "lemon", "bell"],
    reward,
    spinsRemaining: Math.max(0, Number(row.total_spins || 0) - nextSpinIndex - 1),
  });
}));

router.post("/delivery/zbs", requireParticipant, asyncRoute(async (req, res) => {
  const spinId = String(req.body?.spinId || "").trim();
  if (!spinId) throw publicError("Missing spin id");
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .select("id,spin_event_id,customer_id,status,provider_message_id")
    .eq("spin_event_id", spinId)
    .eq("customer_id", req.participant.customerId)
    .eq("channel", "zbs")
    .maybeSingle();
  if (error) throw error;
  if (!delivery) throw publicError("Delivery is not available", 404);
  res.status(202).json({ spinId, deliveryId: delivery.id, status: delivery.status, messageId: delivery.provider_message_id || undefined });
}));

router.post("/delivery/zbs-legacy-disabled", asyncRoute(async (req, res) => {
  throw publicError("This endpoint was replaced by the delivery outbox", 410);
  const spinId = String(req.body?.spinId || "");
  if (!spinId || !phone || !reward?.code) throw publicError("Thiếu thông tin gửi Voucher");
  if (!config.zbsApiKey || !config.zbsTemplateId) throw publicError("Backend chưa cấu hình ZBS WIFIM", 503);

  const compact = String(phone).trim().replace(/[.\s+-]/g, "");
  const normalizedPhone = compact.startsWith("0") ? `84${compact.slice(1)}` : compact;
  const response = await fetch(`${config.zbsBaseUrl.replace(/\/$/, "")}/v1/send`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-API-Key": config.zbsApiKey },
    body: JSON.stringify({
      phone: normalizedPhone,
      template_id: config.zbsTemplateId,
      template_data: {
        customer_name: customerName || "Khách hàng",
        voucher_name: reward.title,
        voucher_code: reward.code,
        voucher_value: String(reward.value),
        expiry_date: reward.expiresAt || "",
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success !== true) throw publicError(body.message || `ZBS trả về lỗi ${response.status}`, 502);
  res.json({ spinId, status: "sent", message: body.message, messageId: body.msg_id });
}));

router.get("/delivery/zbs/templates", requireAdmin, asyncRoute(async (_req, res) => {
  if (!config.zbsApiKey) throw publicError("Backend chưa cấu hình ZBS WIFIM", 503);
  const response = await fetch(`${config.zbsBaseUrl.replace(/\/$/, "")}/v1/templates`, { headers: { Accept: "application/json", "X-API-Key": config.zbsApiKey } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success !== true) throw publicError(body.message || `ZBS trả về lỗi ${response.status}`, 502);
  res.json(body.data || []);
}));

export default router;
