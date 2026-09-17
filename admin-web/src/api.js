import {
  clearAdminSession,
  isAdminSessionExpiring,
  loadAdminSession,
  saveAdminSession,
} from "./auth-session.js";

const API_BASE_URL = String(__API_BASE_URL__ || "http://localhost:8787/api/v1").replace(/\/$/, "");

function browserStorage() {
  return { localStorage: window.localStorage, sessionStorage: window.sessionStorage };
}

export const auth = {
  get session() { return loadAdminSession(browserStorage()); },
  get token() { return this.session?.accessToken || ""; },
  save(session, rememberMe) { saveAdminSession(browserStorage(), session, rememberMe); },
  clear() { clearAdminSession(browserStorage()); },
};

let onUnauthorizedHandler = null;
let refreshPromise = null;

export function setUnauthorizedHandler(fn) {
  onUnauthorizedHandler = fn;
}

async function refreshAdminSession() {
  const current = auth.session;
  if (!current?.refreshToken) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken, local: current.local }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.accessToken) throw new Error(result.error || "Phiên đăng nhập đã hết hạn");
      auth.save(result, current.rememberMe);
      return true;
    } catch {
      auth.clear();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function fetchWithAdminSession(path, options = {}) {
  const isAuthRequest = path.startsWith("/admin/auth/login")
    || path.startsWith("/admin/auth/refresh")
    || path.startsWith("/admin/auth/change-password");
  if (!isAuthRequest && isAdminSessionExpiring(auth.session)) await refreshAdminSession();

  const send = () => {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData)) headers.set("content-type", "application/json");
    if (auth.token) headers.set("authorization", `Bearer ${auth.token}`);
    return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  };

  let response = await send();
  if (response.status === 401 && !isAuthRequest && auth.session?.refreshToken) {
    if (await refreshAdminSession()) response = await send();
  }
  return response;
}

export async function api(path, options = {}) {
  const response = await fetchWithAdminSession(path, options);
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    auth.clear();
    if (onUnauthorizedHandler) onUnauthorizedHandler();
    throw new Error(payload.error || "Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.");
  }
  if (!response.ok) throw new Error(payload.error || `API lỗi ${response.status}`);
  return payload;
}

export async function downloadFile(path, filename) {
  const response = await fetchWithAdminSession(path);
  if (response.status === 401) {
    auth.clear();
    if (onUnauthorizedHandler) onUnauthorizedHandler();
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `API lỗi ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export async function login(email, password, rememberMe = false) {
  const result = await api("/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  auth.save(result, rememberMe);
  return result;
}

export async function changeAdminPassword({ email, currentPassword, newPassword, confirmPassword }) {
  return api("/admin/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ email, currentPassword, newPassword, confirmPassword }),
  });
}

export function logout() { auth.clear(); }

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
