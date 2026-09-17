import test from "node:test";
import assert from "node:assert/strict";
import { validateRuntimeConfig } from "../src/config.js";
import {
  createDevelopmentAdminToken,
  verifyDevelopmentAdminToken,
} from "../src/auth/admin-session.js";

test("production keeps Supabase admin auth and permits runtime secrets from system settings", () => {
  assert.doesNotThrow(() => validateRuntimeConfig({ appEnv: "production", adminAuthMode: "supabase", zaloAppSecret: "", participantSessionTtlSeconds: 1800 }));
  assert.throws(
    () => validateRuntimeConfig({ appEnv: "production", adminAuthMode: "development", zaloAppSecret: "secret", devAuthSecret: "secret", participantSessionTtlSeconds: 1800 }),
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
