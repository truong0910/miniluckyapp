import { apiRequest } from "./api.client";

export function authenticateParticipant<T>(phone?: string): Promise<T> {
  const normalizedInput = String(phone || "").trim();
  if (!normalizedInput) throw new Error("Vui lòng nhập số điện thoại.");
  return apiRequest<T>("/participant/sessions/phone", {
    method: "POST",
    body: JSON.stringify({ phone: normalizedInput }),
  });
}
