import "dotenv/config";

const required = (name) => String(process.env[name] || "").trim();

const appEnv = required("APP_ENV") || "development";
const participantAuthMode = required("PARTICIPANT_AUTH_MODE") || (appEnv === "production" ? "zalo" : "preview");
const adminAuthMode = required("ADMIN_AUTH_MODE") || "supabase";

export const config = {
  appEnv,
  participantAuthMode,
  adminAuthMode,
  port: Number(process.env.PORT || 8787),
  participantSessionTtlSeconds: Number(process.env.PARTICIPANT_SESSION_TTL_SECONDS || 1800),
  devAuthSecret: required("DEV_AUTH_SECRET"),
  supabaseUrl: required("SUPABASE_URL"),
  serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  anonKey: required("SUPABASE_ANON_KEY"),
  adminEmail: required("ADMIN_EMAIL"),
  adminPassword: required("ADMIN_PASSWORD"),
  zbsApiKey: required("ZBS_API_KEY"),
  zbsTemplateId: required("ZBS_TEMPLATE_ID"),
  zbsBaseUrl: required("ZBS_API_BASE_URL") || "https://zbs.wifim.vn/api",
  zaloAppSecret: required("ZALO_APP_SECRET"),
  zaloGraphBaseUrl: required("ZALO_GRAPH_BASE_URL") || "https://graph.zalo.me",
  workerId: required("WORKER_ID") || `worker-${process.pid}`,
  deliveryPollMs: Number(process.env.DELIVERY_POLL_MS || 5000),
  deliveryBatchSize: Number(process.env.DELIVERY_BATCH_SIZE || 10),
  deliveryMaxAttempts: Number(process.env.DELIVERY_MAX_ATTEMPTS || 8),
  corsOrigins: String(process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export function validateRuntimeConfig(input = config) {
  if (!["development", "production"].includes(input.appEnv)) {
    throw new Error("APP_ENV must be development or production");
  }
  if (!["preview", "zalo"].includes(input.participantAuthMode)) {
    throw new Error("PARTICIPANT_AUTH_MODE must be preview or zalo");
  }
  if (!["supabase", "development"].includes(input.adminAuthMode)) {
    throw new Error("ADMIN_AUTH_MODE must be supabase or development");
  }
  if (input.appEnv === "production" && input.participantAuthMode === "preview") {
    throw new Error("Preview participant auth is not allowed in production");
  }
  if (input.appEnv === "production" && input.adminAuthMode === "development") {
    throw new Error("Development admin auth is not allowed in production");
  }
  if (input.adminAuthMode === "development" && !input.devAuthSecret) {
    throw new Error("Development admin auth requires DEV_AUTH_SECRET");
  }
  if (input.appEnv === "production" && input.participantAuthMode === "zalo" && !input.zaloAppSecret) {
    throw new Error("Production Zalo auth requires ZALO_APP_SECRET");
  }
  if (!Number.isFinite(input.participantSessionTtlSeconds) || input.participantSessionTtlSeconds <= 0) {
    throw new Error("PARTICIPANT_SESSION_TTL_SECONDS must be positive");
  }
  return true;
}

validateRuntimeConfig(config);

export function assertSupabaseConfig() {
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error("SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình");
  }
}
