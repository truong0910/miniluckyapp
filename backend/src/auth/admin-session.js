import { createSignedDevToken, verifySignedDevToken } from "./token.js";

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createDevelopmentAdminToken(user, secret, nowMs = Date.now(), ttlMs = DEFAULT_TTL_MS) {
  return createSignedDevToken({
    id: user.id,
    email: user.email,
    role: user.role || "admin",
    iat: nowMs,
    exp: nowMs + ttlMs,
  }, secret, nowMs);
}

export function verifyDevelopmentAdminToken(token, secret, nowMs = Date.now()) {
  const payload = verifySignedDevToken(token, secret, nowMs);
  if (payload.tokenUse === "refresh") throw new Error("Invalid development admin access token");
  if (payload.role !== "admin") throw new Error("Invalid development admin role");
  return payload;
}

export function createDevelopmentAdminRefreshToken(user, secret, nowMs = Date.now(), ttlMs = DEFAULT_REFRESH_TTL_MS) {
  return createSignedDevToken({
    id: user.id,
    email: user.email,
    role: user.role || "admin",
    tokenUse: "refresh",
    iat: nowMs,
    exp: nowMs + ttlMs,
  }, secret, nowMs);
}

export function refreshDevelopmentAdminSession(token, secret, nowMs = Date.now()) {
  const payload = verifySignedDevToken(token, secret, nowMs);
  if (payload.tokenUse !== "refresh" || payload.role !== "admin") {
    throw new Error("Invalid development admin refresh token");
  }

  const user = { id: payload.id, email: payload.email, role: payload.role };
  return {
    accessToken: createDevelopmentAdminToken(user, secret, nowMs),
    refreshToken: createDevelopmentAdminRefreshToken(user, secret, nowMs),
    expiresAt: Math.floor((nowMs + DEFAULT_TTL_MS) / 1000),
    user: { id: user.id, email: user.email },
    local: true,
  };
}
