function deliveryError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function claimDeliveryBatch({ db, workerId, limit = 10 }) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 10, 100));
  const { data, error } = await db.rpc("claim_deliveries", {
    p_worker_id: workerId,
    p_limit: boundedLimit,
  });
  if (error) throw error;
  return data || [];
}

async function selectSingle(db, table, fields, filters, method = "single") {
  let query = db.from(table).select(fields);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const result = await query[method]();
  if (result.error) throw result.error;
  return result.data;
}

function normalizeZbsPhone(value) {
  const compact = String(value || "").replace(/[^\d]/g, "");
  if (compact.startsWith("0")) return `84${compact.slice(1)}`;
  if (compact.startsWith("+84")) return compact.slice(1);
  return compact;
}

export async function loadDeliveryContext({ db, delivery }) {
  const customer = await selectSingle(db, "customers", "phone,name", { id: delivery.customer_id });
  const event = await selectSingle(db, "spin_events", "reward_code,reward_id", { id: delivery.spin_event_id });
  if (!event?.reward_code && !event?.reward_id) throw deliveryError("Spin has no reward snapshot", 422);

  let reward = null;
  if (event.reward_code) {
    reward = await selectSingle(db, "customer_rewards", "code,title,value,description", {
      customer_id: delivery.customer_id,
      code: event.reward_code,
    }, "maybeSingle");
  }
  if (!reward && event.reward_id) {
    reward = await selectSingle(db, "reward_catalog", "id,code_prefix,title,value,description", { id: event.reward_id });
  }
  if (!customer?.phone || !reward) throw deliveryError("Delivery data is not available", 422);
  return { customer, reward, phone: normalizeZbsPhone(customer.phone) };
}

export async function sendDelivery({ delivery, db, fetchImpl = fetch, config }) {
  if (delivery.status === "sent") return { messageId: delivery.provider_message_id || "" };
  if (delivery.channel && delivery.channel !== "zbs") throw deliveryError("Unsupported delivery channel", 422);
  if (!config?.zbsApiKey || !config?.zbsTemplateId) throw deliveryError("ZBS is not configured", 503);

  const { customer, reward, phone } = await loadDeliveryContext({ db, delivery });
  const response = await fetchImpl(`${String(config.zbsBaseUrl || "").replace(/\/$/, "")}/v1/send`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": config.zbsApiKey,
      "X-Idempotency-Key": delivery.id,
    },
    body: JSON.stringify({
      phone,
      template_id: config.zbsTemplateId,
      template_data: {
        customer_name: customer.name,
        voucher_name: reward.title,
        voucher_code: reward.code,
        voucher_value: String(reward.value),
        expiry_date: "",
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success !== true) {
    throw deliveryError(body.message || `ZBS returned ${response.status}`, response.status >= 500 ? 502 : 422);
  }
  return { messageId: String(body.msg_id || body.message_id || body.id || "") };
}

export async function finishDelivery({ db, deliveryId, status, messageId, error, nextAttemptAt }) {
  const { data, error: rpcError } = await db.rpc("finish_delivery", {
    p_delivery_id: deliveryId,
    p_status: status,
    p_message_id: messageId || null,
    p_error: error || null,
    p_next_attempt_at: nextAttemptAt || null,
  });
  if (rpcError) throw rpcError;
  return data;
}

export { normalizeZbsPhone };
