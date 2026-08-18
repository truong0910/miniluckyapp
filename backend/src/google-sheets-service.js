function syncError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseResponseBody(response) {
  return response.text().then((text) => {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  });
}

export function buildGoogleSheetsPayload({ spin, customer, award, campaign }) {
  const reward = spin?.reward && typeof spin.reward === "object" ? spin.reward : null;
  const outcome = String(spin?.outcome || "better_luck");

  return {
    spinId: String(spin?.spinId || ""),
    awardId: award?.id ? String(award.id) : "",
    campaignId: campaign?.id ? String(campaign.id) : (spin?.campaignId ? String(spin.campaignId) : ""),
    campaignCode: campaign?.code ? String(campaign.code) : "",
    campaignName: campaign?.name ? String(campaign.name) : (spin?.campaignName ? String(spin.campaignName) : ""),
    timestamp: spin?.timestamp || new Date().toISOString(),
    customerName: String(customer?.name || "Khách hàng"),
    phone: String(customer?.phone || ""),
    outcome,
    rewardValue: reward ? Number(reward.value || 0) : 0,
    rewardTitle: String(reward?.title || "May Mắn Lần Sau"),
    rewardCode: String(reward?.code || "N/A"),
    status: String(award?.status || (outcome === "reward" ? "issued" : "")),
    deliveredAt: award?.delivered_at || null,
    redeemedAt: award?.redeemed_at || null,
  };
}

export async function loadGoogleSheetsSyncContext({ db, spin, customerId }) {
  const customerResult = await db
    .from("customers")
    .select("name,phone")
    .eq("id", customerId)
    .maybeSingle();
  if (customerResult.error) throw customerResult.error;

  const awardResult = await db
    .from("awards")
    .select("id,status,delivered_at,redeemed_at,campaign_id")
    .eq("spin_event_id", spin.spinId)
    .maybeSingle();
  if (awardResult.error) throw awardResult.error;

  let campaign = null;
  const campaignId = awardResult.data?.campaign_id || spin?.campaignId || spin?.campaign_id;
  if (campaignId) {
    const campaignResult = await db
      .from("campaigns")
      .select("id,code,name")
      .eq("id", campaignId)
      .maybeSingle();
    if (!campaignResult.error) campaign = campaignResult.data;
  }

  return { customer: customerResult.data, award: awardResult.data, campaign };
}

export async function postSpinToGoogleSheets({ payload, webhookUrl, webhookSecret = "", fetchImpl = fetch, timeoutMs = 5000 }) {
  const url = String(webhookUrl || "").trim();
  if (!url) return { status: "disabled" };
  if (!payload?.spinId) throw syncError("Google Sheets sync requires spinId", 422);

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Idempotency-Key": payload.spinId,
  };
  if (webhookSecret) {
    headers["X-Webhook-Secret"] = webhookSecret;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(250, Number(timeoutMs) || 5000));
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await parseResponseBody(response);
    if (!response.ok || body.status === "error" || body.success === false) {
      throw syncError(body.message || `Google Sheets webhook returned ${response.status}`);
    }
    return { status: "sent", body };
  } catch (error) {
    if (error?.name === "AbortError") throw syncError("Google Sheets webhook timed out", 504);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncSpinToGoogleSheets({ db, spin, customerId, config, fetchImpl = fetch }) {
  if (!String(config?.googleSheetsWebhookUrl || "").trim()) return { status: "disabled" };
  const { customer, award, campaign } = await loadGoogleSheetsSyncContext({ db, spin, customerId });
  const payload = buildGoogleSheetsPayload({ spin, customer, award, campaign });
  return postSpinToGoogleSheets({
    payload,
    webhookUrl: config.googleSheetsWebhookUrl,
    webhookSecret: config.googleSheetsWebhookSecret || "",
    fetchImpl,
    timeoutMs: config.googleSheetsWebhookTimeoutMs,
  });
}

