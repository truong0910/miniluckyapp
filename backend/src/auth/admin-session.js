import { createSignedDevToken, verifySignedDevToken } from "./token.js";

const DEFAULT_TTL_MS = 30 * 60 * 1000;

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
  if (payload.role !== "admin") throw new Error("Invalid development admin role");
  return payload;
}
