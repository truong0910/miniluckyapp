import test from "node:test";
import assert from "node:assert/strict";
import { validateRuntimeConfig } from "../src/config.js";
import {
  createDevelopmentAdminToken,
  verifyDevelopmentAdminToken,
} from "../src/auth/admin-session.js";

test("production rejects preview participant auth and development admin auth", () => {
  assert.throws(
    () => validateRuntimeConfig({ appEnv: "production", participantAuthMode: "preview", adminAuthMode: "supabase", zaloAppSecret: "secret" }),
    /preview/i,
  );
  assert.throws(
    () => validateRuntimeConfig({ appEnv: "production", participantAuthMode: "zalo", adminAuthMode: "development", zaloAppSecret: "secret" }),
    /development admin/i,
  );
});

test("development admin session is signed and expires", () => {
  const token = createDevelopmentAdminToken({ id: "admin-1", email: "admin@example.com", role: "admin" }, "secret", 0, 1000);
  assert.deepEqual(verifyDevelopmentAdminToken(token, "secret", 500), {
    id: "admin-1",
    email: "admin@example.com",
    role: "admin",
    iat: 0,
    exp: 1000,
  });
  assert.throws(() => verifyDevelopmentAdminToken(token, "secret", 1001), /expired/i);
  assert.throws(() => verifyDevelopmentAdminToken(`${token}x`, "secret", 500), /signature/i);
});
