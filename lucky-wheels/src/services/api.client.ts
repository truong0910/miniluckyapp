import { participantSession } from "./participant-session";

const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8787/api/v1"
).replace(/\/$/, "");

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = participantSession.getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) participantSession.clear();
    const error = new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Backend trả về lỗi ${response.status}`
    );
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return payload as T;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}
