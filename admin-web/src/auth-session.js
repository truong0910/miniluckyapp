const SESSION_KEY = "lucky-wheels-admin-session";
const LEGACY_TOKEN_KEY = "lucky-wheels-admin-token";

function parseSession(storage) {
  try {
    const session = JSON.parse(storage.getItem(SESSION_KEY) || "null");
    if (!session || typeof session.accessToken !== "string" || !session.accessToken) return null;
    return {
      accessToken: session.accessToken,
      refreshToken: typeof session.refreshToken === "string" ? session.refreshToken : "",
      expiresAt: Number(session.expiresAt) || null,
      local: session.local === true,
      rememberMe: session.rememberMe === true,
    };
  } catch {
    storage.removeItem(SESSION_KEY);
    return null;
  }
}

export function loadAdminSession({ localStorage, sessionStorage }) {
  return parseSession(localStorage) || parseSession(sessionStorage) || (() => {
    const legacyToken = sessionStorage.getItem(LEGACY_TOKEN_KEY);
    return legacyToken ? { accessToken: legacyToken, refreshToken: "", expiresAt: null, rememberMe: false } : null;
  })();
}

export function saveAdminSession({ localStorage, sessionStorage }, session, rememberMe = false) {
  if (!session?.accessToken) throw new Error("Phiên đăng nhập không hợp lệ");
  const value = JSON.stringify({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken || "",
    expiresAt: Number(session.expiresAt) || null,
    local: session.local === true,
    rememberMe: Boolean(rememberMe),
  });
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  (rememberMe ? localStorage : sessionStorage).setItem(SESSION_KEY, value);
}

export function clearAdminSession({ localStorage, sessionStorage }) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function isAdminSessionExpiring(session, nowMs = Date.now(), skewMs = 60_000) {
  if (!session?.expiresAt) return false;
  const expiresAt = Number(session.expiresAt);
  const expiresAtMs = expiresAt < 100_000_000_000 ? expiresAt * 1000 : expiresAt;
  return expiresAtMs <= nowMs + skewMs;
}
