import test from "node:test";
import assert from "node:assert/strict";
import {
  clearAdminSession,
  isAdminSessionExpiring,
  loadAdminSession,
  saveAdminSession,
} from "./auth-session.js";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); },
  };
}

test("remember login stores refresh session persistently without storing credentials", () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();

  saveAdminSession({ localStorage, sessionStorage }, {
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: 1_800_000_000,
  }, true);

  assert.deepEqual(loadAdminSession({ localStorage, sessionStorage }), {
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: 1_800_000_000,
    local: false,
    rememberMe: true,
  });
  assert.equal(localStorage.has("lucky-wheels-admin-session"), true);
  assert.equal(sessionStorage.has("lucky-wheels-admin-session"), false);
  assert.doesNotMatch(localStorage.getItem("lucky-wheels-admin-session"), /password/i);
});

test("unchecked remember option stores session only for the current browser tab", () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();

  saveAdminSession({ localStorage, sessionStorage }, {
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: 1_800_000_000,
  }, false);

  assert.equal(loadAdminSession({ localStorage, sessionStorage }).rememberMe, false);
  assert.equal(localStorage.has("lucky-wheels-admin-session"), false);
  assert.equal(sessionStorage.has("lucky-wheels-admin-session"), true);
});

test("development session mode survives refresh without being confused with Supabase refresh tokens", () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();

  saveAdminSession({ localStorage, sessionStorage }, {
    accessToken: "dev-access",
    refreshToken: "dev-refresh",
    expiresAt: 1_800_000_000,
    local: true,
  }, false);

  assert.equal(loadAdminSession({ localStorage, sessionStorage }).local, true);
});

test("logout clears both persistent and tab sessions", () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  saveAdminSession({ localStorage, sessionStorage }, { accessToken: "persistent", refreshToken: "r" }, true);
  saveAdminSession({ localStorage, sessionStorage }, { accessToken: "tab", refreshToken: "r" }, false);

  clearAdminSession({ localStorage, sessionStorage });

  assert.equal(loadAdminSession({ localStorage, sessionStorage }), null);
});

test("session refresh is requested shortly before an access token expires", () => {
  assert.equal(isAdminSessionExpiring({ expiresAt: 1_000 }, 999_500), true);
  assert.equal(isAdminSessionExpiring({ expiresAt: 2_000 }, 999_500), false);
});
