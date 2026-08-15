export function normalizePhone(value) {
  const compact = String(value || "").trim().replace(/[.\s-]/g, "");
  return compact.startsWith("+84") ? `0${compact.slice(3)}` : compact;
}

export function isValidVietnamesePhone(phone) {
  return /^(0)(3|5|7|8|9)\d{8}$/.test(normalizePhone(phone));
}

export function publicError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function mapReward(row) {
  return {
    id: row.id,
    codePrefix: row.code_prefix,
    title: row.title,
    value: Number(row.value),
    description: row.description || "",
    wheelLabel: row.wheel_label,
    symbol: row.symbol,
    active: row.active,
  };
}

export function mapBanner(row) {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    linkUrl: row.link_url || undefined,
    active: row.active,
    order: row.display_order,
  };
}

export function mapAssignment(row) {
  return {
    result: Array.isArray(row.result) ? row.result : ["star", "star", "star"],
    reward: {
      code: row.code,
      title: row.title,
      value: Number(row.value),
      description: row.description || "",
      wheelLabel: row.wheel_label || undefined,
    },
  };
}

export function mapCustomer(row, rewards = []) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    sex: row.sex,
    job: row.job,
    totalSpins: Number(row.total_spins || 0),
    rewards,
  };
}
