import { Router } from "express";
import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { requireAdmin, requireParticipant } from "../middleware.js";
import { createParticipantSession, normalizeParticipantPhone, resolveZaloPhone } from "../participant-auth.js";
import { parseAwardsPagination, listParticipantAwards } from "../award-service.js";
import { getActiveCampaign } from "../campaign-service.js";
import { syncSpinToGoogleSheets } from "../google-sheets-service.js";
import { spinOnce } from "../spin-service.js";
import { getEffectiveRuntimeConfig } from "../runtime-system-config.js";
import { asyncRoute, isValidVietnamesePhone, mapAssignment, mapBanner, mapCustomer, mapReward, normalizePhone, publicError } from "../utils.js";

import { ensureCampaignParticipant } from "../campaign-reuse-service.js";

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
  const [customer, activeCampaign, catalogResult] = await Promise.all([
    loadCustomer(row),
    getActiveCampaign({ db: supabase }),
    supabase
      .from("reward_catalog")
      .select("id,code_prefix,title,value,description,wheel_label,symbol,active")
      .eq("active", true)
      .order("value", { ascending: false }),
  ]);

  if (catalogResult.error) throw catalogResult.error;

  let spinsTotal = customer.totalSpins;
  let spinCount = 0;

  if (activeCampaign?.id) {
    const [partResult, countResult] = await Promise.all([
      supabase
        .from("campaign_participants")
        .select("spin_quota,status")
        .eq("campaign_id", activeCampaign.id)
        .eq("customer_id", row.id)
        .maybeSingle(),
      supabase
        .from("spin_events")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", row.id)
        .eq("campaign_id", activeCampaign.id),
    ]);

    if (partResult.error) throw partResult.error;
    if (countResult.error) throw countResult.error;

    if (partResult.data) {
      spinsTotal = Number(partResult.data.spin_quota || 0);
    } else if (activeCampaign.id !== "00000000-0000-0000-0000-000000000001") {
      spinsTotal = 0;
    }
    spinCount = Number(countResult.count || 0);
  } else {
    const { count, error: countError } = await supabase
      .from("spin_events")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", row.id);
    if (countError) throw countError;
    spinCount = Number(count || 0);
  }

  const participant = {
    ...customer,
    spinsTotal,
    rewardsTotal: customer.rewards.length,
    spinsRemaining: Math.max(0, spinsTotal - spinCount),
    wheelSegments: buildWheelSegments(customer, (catalogResult.data || []).map(mapReward)),
  };
  return { ...participant, session: session ? { token: session.token, expiresAt: session.expiresAt } : undefined };
}

router.get("/content", asyncRoute(async (_req, res) => {
  const [banners, rewards, settings, activeCampaign, runtimeConfig] = await Promise.all([
    supabase.from("banners").select("id,title,image_url,link_url,active,display_order").eq("active", true).order("display_order", { ascending: true }),
    supabase.from("reward_catalog").select("id,code_prefix,title,value,description,wheel_label,symbol,active").eq("active", true).order("value", { ascending: false }),
    supabase.from("program_settings").select("key,value").eq("key", "program_rules").maybeSingle(),
    getActiveCampaign({ db: supabase }),
    getEffectiveRuntimeConfig({ db: supabase, config }),
  ]);
  for (const result of [banners, rewards, settings]) if (result.error) throw result.error;
  res.json({
    banners: (banners.data || []).map(mapBanner),
    rewards: (rewards.data || []).map(mapReward),
    rules: settings.data?.value || null,
    campaign: activeCampaign ? {
      id: activeCampaign.id,
      code: activeCampaign.code,
      name: activeCampaign.name,
      status: activeCampaign.status,
      startsAt: activeCampaign.startsAt,
      endsAt: activeCampaign.endsAt,
      timezone: activeCampaign.timezone,
    } : null,
    // Only expose a boolean; never expose the ZBS credentials to the Mini App.
    zbsConfigured: Boolean(runtimeConfig.zbsApiKey && runtimeConfig.zbsTemplateId),
  });
}));

async function findParticipantCustomer(phone, registrationSource = "zalo_guest") {
  const normalizedPhone = normalizePhone(phone);
  if (!isValidVietnamesePhone(normalizedPhone)) throw publicError("Số điện thoại không hợp lệ");

  let { data: row, error } = await supabase
    .from("customers")
    .select("id,name,phone,sex,job,total_spins,deleted_at")
    .eq("phone", normalizedPhone)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;

  const activeCampaign = await getActiveCampaign({ db: supabase });

  if (!row) {
    // Check if customer exists under any ID (including soft-deleted)
    const { data: existingAny } = await supabase
      .from("customers")
      .select("id,name,phone,sex,job,total_spins,deleted_at")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (existingAny) {
      if (existingAny.deleted_at) {
        await supabase.from("customers").update({ deleted_at: null }).eq("id", existingAny.id);
      }
      row = { ...existingAny, deleted_at: null };
    } else {
      if (!activeCampaign || !activeCampaign.allowUnlisted) {
        throw publicError("Khách chưa được đăng ký trong sự kiện này", 403, "P0003");
      }

      const id = `customer-${normalizedPhone}`;
      const newRecord = {
        id,
        phone: normalizedPhone,
        name: `Khách hàng ${normalizedPhone}`,
        sex: "other",
        job: "other",
        total_spins: 0,
        deleted_at: null,
      };

      const { data: created, error: createError } = await supabase
        .from("customers")
        .upsert(newRecord)
        .select("id,name,phone,sex,job,total_spins,deleted_at")
        .single();

      if (createError) {
        if (createError.code === "23505" || String(createError.message).includes("customers_phone_key")) {
          const { data: fallbackRow } = await supabase
            .from("customers")
            .select("id,name,phone,sex,job,total_spins,deleted_at")
            .eq("phone", normalizedPhone)
            .maybeSingle();
          if (fallbackRow) {
            row = fallbackRow;
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      } else {
        row = created;
      }
    }
  }

  if (activeCampaign?.id) {
    await ensureCampaignParticipant({
      db: supabase,
      campaignId: activeCampaign.id,
      customerId: row.id,
      registrationSource,
    });
  }

  return row;
}

router.post("/participant/sessions/phone", asyncRoute(async (req, res) => {
  const phone = normalizeParticipantPhone(req.body?.phone);
  const row = await findParticipantCustomer(phone, "phone_guest");
  const session = await createParticipantSession({ db: supabase, customerId: row.id, authMethod: "phone", ttlSeconds: config.participantSessionTtlSeconds });
  res.status(201).json(await loadParticipantResponse(row, session));
}));

router.post("/participant/sessions/zalo", asyncRoute(async (req, res) => {
  const runtimeConfig = await getEffectiveRuntimeConfig({ db: supabase, config });
  const phone = await resolveZaloPhone({
    accessToken: req.body?.accessToken,
    phoneToken: req.body?.phoneToken,
    appSecret: runtimeConfig.zaloAppSecret,
    baseUrl: runtimeConfig.zaloGraphBaseUrl,
  });
  const row = await findParticipantCustomer(phone, "zalo_guest");
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

router.get("/participant/me/awards", requireParticipant, asyncRoute(async (req, res) => {
  const { page, limit } = parseAwardsPagination(req.query);
  const customerId = req.participant.customerId;
  res.json(await listParticipantAwards({ db: supabase, customerId, page, limit }));
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
  const result = await spinOnce({
    db: supabase,
    participant: req.participant,
    idempotencyKey,
    source: "participant",
  });
  // Google Sheets is a reporting sink: a webhook failure must never undo a committed spin.
  void syncSpinToGoogleSheets({
    db: supabase,
    spin: result,
    customerId: req.participant.customerId,
    config,
  }).catch((error) => console.error("Google Sheets sync failed", error));
  res.json(result);
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

router.get("/delivery/zbs/templates", requireAdmin, asyncRoute(async (_req, res) => {
  const runtimeConfig = await getEffectiveRuntimeConfig({ db: supabase, config });
  if (!runtimeConfig.zbsApiKey) throw publicError("Backend chưa cấu hình ZBS WIFIM", 503);
  const response = await fetch(`${runtimeConfig.zbsBaseUrl.replace(/\/$/, "")}/v1/templates`, { headers: { Accept: "application/json", "X-API-Key": runtimeConfig.zbsApiKey } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success !== true) throw publicError(body.message || `ZBS trả về lỗi ${response.status}`, 502);
  res.json(body.data || []);
}));

export default router;
