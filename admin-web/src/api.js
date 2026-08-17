const API_BASE_URL = String(__API_BASE_URL__ || "http://localhost:8787/api/v1").replace(/\/$/, "");
const TOKEN_KEY = "lucky-wheels-admin-token";

export const auth = {
  get token() { return sessionStorage.getItem(TOKEN_KEY) || ""; },
  set token(value) { if (value) sessionStorage.setItem(TOKEN_KEY, value); else sessionStorage.removeItem(TOKEN_KEY); },
};

let onUnauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  onUnauthorizedHandler = fn;
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set("content-type", "application/json");
  if (auth.token) headers.set("authorization", `Bearer ${auth.token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    auth.token = "";
    if (onUnauthorizedHandler) onUnauthorizedHandler();
    throw new Error(payload.error || "Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.");
  }
  if (!response.ok) throw new Error(payload.error || `API lỗi ${response.status}`);
  return payload;
}

export async function downloadFile(path, filename) {
  const headers = new Headers();
  if (auth.token) headers.set("authorization", `Bearer ${auth.token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (response.status === 401) {
    auth.token = "";
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

export async function login(email, password) {
  const result = await api("/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  auth.token = result.accessToken;
  return result;
}

export function logout() { auth.token = ""; }

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
