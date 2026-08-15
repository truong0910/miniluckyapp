import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signatureFor(encodedPayload, secret) {
  return createHmac("sha256", String(secret)).update(encodedPayload).digest("base64url");
}

export function createOpaqueToken(bytes = 32) {
  if (!Number.isInteger(bytes) || bytes < 32) {
    throw new Error("Opaque token length must be at least 32 bytes");
  }
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function timingSafeTokenEqual(leftHash, rightHash) {
  const left = Buffer.from(String(leftHash), "utf8");
  const right = Buffer.from(String(rightHash), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSignedDevToken(payload, secret, nowMs = Date.now()) {
  if (!secret) throw new Error("Signing secret is required");
  if (!payload || typeof payload !== "object") throw new Error("Token payload must be an object");
  const value = { ...payload };
  if (value.exp == null) value.exp = nowMs + 30 * 60 * 1000;
  const encodedPayload = encode(JSON.stringify(value));
  return `${encodedPayload}.${signatureFor(encodedPayload, secret)}`;
}

export function verifySignedDevToken(token, secret, nowMs = Date.now()) {
  if (!secret) throw new Error("Signing secret is required");
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("Malformed token");

  const expected = signatureFor(parts[0], secret);
  if (!timingSafeTokenEqual(parts[1], expected)) throw new Error("Invalid signature");

  let payload;
  try {
    payload = JSON.parse(decode(parts[0]));
  } catch {
    throw new Error("Malformed token payload");
  }
  if (!payload || Number(payload.exp) <= nowMs) throw new Error("Token expired");
  return payload;
}
