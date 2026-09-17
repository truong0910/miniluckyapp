import test from "node:test";
import assert from "node:assert/strict";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); },
    value(key) { return values.get(key) ?? null; },
  };
}

const localStorage = createStorage();
const sessionStorage = createStorage();
globalThis.window = { localStorage, sessionStorage };
globalThis.__API_BASE_URL__ = "https://admin-api.test/api/v1";
const { api, auth, login } = await import("./api.js");

test("protected requests refresh an expiring remembered session and retain the new refresh token", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  auth.save({
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: Math.floor(Date.now() / 1000),
    local: false,
  }, true);
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/admin/auth/refresh")) {
      return new Response(JSON.stringify({ accessToken: "new-access", refreshToken: "new-refresh", expiresAt: Math.floor(Date.now() / 1000) + 3600, local: false }), { status: 200 });
    }
    return new Response(JSON.stringify({ user: { email: "admin@example.com" } }), { status: 200 });
  };

  try {
    const result = await api("/admin/auth/me");

    assert.equal(result.user.email, "admin@example.com");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://admin-api.test/api/v1/admin/auth/refresh");
    assert.equal(JSON.parse(calls[0].options.body).refreshToken, "old-refresh");
    assert.equal(calls[1].options.headers.get("authorization"), "Bearer new-access");
    assert.equal(auth.session.refreshToken, "new-refresh");
    assert.equal(auth.session.rememberMe, true);
    assert.equal(localStorage.has("lucky-wheels-admin-session"), true);
  } finally {
    auth.clear();
    globalThis.fetch = originalFetch;
  }
});

test("login keeps the session in tab storage when remember is unchecked", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ accessToken: "tab-access", refreshToken: "tab-refresh", expiresAt: Math.floor(Date.now() / 1000) + 3600, local: false }), { status: 200 });

  try {
    await login("admin@example.com", "dont-store-this", false);

    assert.equal(auth.token, "tab-access");
    assert.equal(sessionStorage.has("lucky-wheels-admin-session"), true);
    assert.equal(localStorage.has("lucky-wheels-admin-session"), false);
    assert.doesNotMatch(sessionStorage.value("lucky-wheels-admin-session"), /dont-store-this/);
  } finally {
    auth.clear();
    globalThis.fetch = originalFetch;
  }
});

test("an invalid refresh token clears the remembered session", async () => {
  const originalFetch = globalThis.fetch;
  auth.save({
    accessToken: "expired-access",
    refreshToken: "revoked-refresh",
    expiresAt: Math.floor(Date.now() / 1000),
  }, true);
  globalThis.fetch = async (url) => String(url).endsWith("/admin/auth/refresh")
    ? new Response(JSON.stringify({ error: "refresh expired" }), { status: 401 })
    : new Response(JSON.stringify({ error: "invalid token" }), { status: 401 });

  try {
    await assert.rejects(api("/admin/auth/me"), /invalid token/i);
    assert.equal(auth.session, null);
    assert.equal(localStorage.has("lucky-wheels-admin-session"), false);
  } finally {
    auth.clear();
    globalThis.fetch = originalFetch;
  }
});
