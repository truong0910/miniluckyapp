import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { changeAdminPassword, refreshSupabaseAdminSession } from "../src/admin-auth-service.js";

function createAdminDb({ profile = { user_id: "admin-1", role: "admin" } } = {}) {
  const calls = { updates: [] };
  return {
    calls,
    from(table) {
      assert.equal(table, "admin_profiles");
      return {
        select() { return this; },
        eq(column, value) {
          assert.equal(column, "user_id");
          assert.equal(value, "admin-1");
          return this;
        },
        maybeSingle: async () => ({ data: profile, error: null }),
      };
    },
    auth: { admin: { updateUserById: async (...args) => {
      calls.updates.push(args);
      return { data: { user: { id: "admin-1" } }, error: null };
    } } },
  };
}

test("password change verifies the current password and admin role before updating", async () => {
  const authClient = { auth: { signInWithPassword: async (credentials) => ({
    data: { user: { id: "admin-1", email: credentials.email } },
    error: null,
  }) } };
  const adminDb = createAdminDb();

  const result = await changeAdminPassword({
    authClient,
    adminDb,
    email: "admin@example.com",
    currentPassword: "old-password",
    newPassword: "new-password-123",
    confirmPassword: "new-password-123",
  });

  assert.equal(result.email, "admin@example.com");
  assert.deepEqual(adminDb.calls.updates, [["admin-1", { password: "new-password-123" }]]);
});

test("password change rejects a wrong current password without updating the account", async () => {
  const authClient = { auth: { signInWithPassword: async () => ({ data: { user: null }, error: new Error("bad credentials") }) } };
  const adminDb = createAdminDb();

  await assert.rejects(
    changeAdminPassword({ authClient, adminDb, email: "admin@example.com", currentPassword: "wrong", newPassword: "new-password-123", confirmPassword: "new-password-123" }),
    (error) => error.status === 401,
  );
  assert.deepEqual(adminDb.calls.updates, []);
});

test("password change rejects non-admin accounts and mismatched or short new passwords", async () => {
  const authClient = { auth: { signInWithPassword: async (credentials) => ({ data: { user: { id: "admin-1", email: credentials.email } }, error: null }) } };
  const nonAdminDb = createAdminDb({ profile: null });

  await assert.rejects(changeAdminPassword({ authClient, adminDb: nonAdminDb, email: "admin@example.com", currentPassword: "old-password", newPassword: "new-password-123", confirmPassword: "new-password-123" }), (error) => error.status === 403);
  await assert.rejects(changeAdminPassword({ authClient, adminDb: createAdminDb(), email: "admin@example.com", currentPassword: "old-password", newPassword: "short", confirmPassword: "short" }), (error) => error.status === 400);
  await assert.rejects(changeAdminPassword({ authClient, adminDb: createAdminDb(), email: "admin@example.com", currentPassword: "old-password", newPassword: "new-password-123", confirmPassword: "other-password-123" }), (error) => error.status === 400);
});

test("refresh returns a rotated session only for an admin user", async () => {
  const authClient = { auth: { refreshSession: async ({ refresh_token }) => ({
    data: { session: { access_token: "new-access", refresh_token: `${refresh_token}-rotated`, expires_at: 2_000_000_000 }, user: { id: "admin-1", email: "admin@example.com" } },
    error: null,
  }) } };
  const session = await refreshSupabaseAdminSession({ authClient, adminDb: createAdminDb(), refreshToken: "old-refresh" });

  assert.deepEqual(session, {
    accessToken: "new-access",
    refreshToken: "old-refresh-rotated",
    expiresAt: 2_000_000_000,
    user: { id: "admin-1", email: "admin@example.com" },
  });
});

test("admin auth routes expose refresh and verified password-change handlers", async () => {
  const routesPath = fileURLToPath(new URL("../src/routes/admin.routes.js", import.meta.url));
  const source = await readFile(routesPath, "utf8");
  const changeRouteStart = source.indexOf('router.post("/auth/change-password"');
  const changeRouteEnd = source.indexOf("\n}));", changeRouteStart);
  const changeRoute = source.slice(changeRouteStart, changeRouteEnd + 5);

  assert.match(source, /router\.post\("\/auth\/refresh"/);
  assert.match(source, /refreshSupabaseAdminSession/);
  assert.match(source, /refreshDevelopmentAdminSession/);
  assert.match(source, /router\.post\("\/auth\/change-password"/);
  assert.match(source, /changeAdminPassword/);
  assert.doesNotMatch(changeRoute, /requireAdmin/);
});
