async function getSystemSettingsValue(db) {
  const { data, error } = await db
    .from("program_settings")
    .select("value")
    .eq("key", "system_env_config")
    .maybeSingle();
  if (error) throw error;

  return data?.value && typeof data.value === "object" ? data.value : {};
}

export function normalizeGoogleSheetsWebhookUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";

  const invalid = (message) => {
    const error = new Error(message);
    error.status = 400;
    return error;
  };

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw invalid("Nhập URL Web App Google Apps Script hợp lệ");
  }

  if (parsed.protocol !== "https:") {
    throw invalid("URL Google Apps Script phải dùng HTTPS");
  }
  if (parsed.hostname !== "script.google.com" || !/^\/macros\/s\/[^/]+\/exec\/?$/.test(parsed.pathname)) {
    throw invalid("Dùng URL Web App Google Apps Script có dạng /macros/s/.../exec");
  }

  return url;
}

export async function saveGoogleSheetsWebhookUrl({ db, url }) {
  if (!db?.from) throw new Error("Google Sheets settings database is unavailable");
  const normalizedUrl = normalizeGoogleSheetsWebhookUrl(url);
  const saved = await getSystemSettingsValue(db);
  const value = {
    ...saved,
    googleSheetsWebhookUrl: normalizedUrl,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await db
    .from("program_settings")
    .upsert({ key: "system_env_config", value });
  if (error) throw error;
  return normalizedUrl;
}

export async function getEffectiveRuntimeConfig({ db, config }) {
  if (!db?.from) return config;

  const saved = await getSystemSettingsValue(db);
  return {
    ...config,
    zaloAppSecret: saved.zaloAppSecret || config.zaloAppSecret,
    zaloGraphBaseUrl: saved.zaloGraphBaseUrl || config.zaloGraphBaseUrl,
    zbsApiKey: saved.zbsApiKey || config.zbsApiKey,
    zbsTemplateId: saved.zbsTemplateId || config.zbsTemplateId,
    zbsBaseUrl: saved.zbsBaseUrl || config.zbsBaseUrl,
    googleSheetsWebhookUrl: Object.hasOwn(saved, "googleSheetsWebhookUrl")
      ? String(saved.googleSheetsWebhookUrl ?? "").trim()
      : config.googleSheetsWebhookUrl,
  };
}
