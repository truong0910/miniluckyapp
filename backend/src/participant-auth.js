import { createOpaqueToken, hashToken, timingSafeTokenEqual } from "./auth/token.js";
import { isValidVietnamesePhone, normalizePhone, publicError } from "./utils.js";

export function assertPreviewAuthAllowed(runtimeConfig) {
  if (runtimeConfig?.appEnv !== "development" || runtimeConfig?.participantAuthMode !== "preview") {
    throw publicError("Preview participant auth is only available in development", 403);
  }
}

export async function createParticipantSession({ db, customerId, authMethod, ttlSeconds = 1800, now = Date.now(), tokenFactory = createOpaqueToken }) {
  const token = tokenFactory();
  const expiresAt = new Date(now + Number(ttlSeconds) * 1000).toISOString();
  const { data, error } = await db
    .from("participant_sessions")
    .insert({
      customer_id: customerId,
      token_hash: hashToken(token),
      auth_method: authMethod,
      expires_at: expiresAt,
    })
    .select("id,expires_at")
    .single();
  if (error) throw error;
  return { sessionId: data.id, token, expiresAt: data.expires_at };
}

export async function findParticipantSession({ db, token, now = Date.now() }) {
  if (!token) return null;
  const { data, error } = await db
    .from("participant_sessions")
    .select("id,customer_id,auth_method,expires_at,revoked_at")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date(now).toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= now) return null;
  return {
    sessionId: data.id,
    customerId: data.customer_id,
    authMethod: data.auth_method,
    expiresAt: data.expires_at,
  };
}

export async function resolveZaloPhone({ accessToken, phoneToken, appSecret, baseUrl = "https://graph.zalo.me", fetchImpl = fetch }) {
  if (!accessToken || !phoneToken || !appSecret) throw publicError("Thiếu thông tin xác thực Zalo", 401);
  let response;
  try {
    response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v2.0/me/info`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        access_token: accessToken,
        code: phoneToken,
        secret_key: appSecret,
      },
    });
  } catch {
    throw publicError("Không thể xác minh số điện thoại với Zalo", 502);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || Number(body.error) !== 0 || !body.data?.number) {
    throw publicError(body.message || "Zalo không xác minh được số điện thoại", response.ok ? 401 : 502);
  }
  const raw = String(body.data.number).replace(/\D/g, "");
  const local = raw.startsWith("84") ? `0${raw.slice(2)}` : raw;
  const phone = normalizePhone(local);
  if (!isValidVietnamesePhone(phone)) throw publicError("Zalo trả về số điện thoại không hợp lệ", 422);
  return phone;
}

export function isSameSessionToken(leftToken, rightToken) {
  return timingSafeTokenEqual(hashToken(leftToken), hashToken(rightToken));
}
