import { apiRequest } from "./api.client";
import { permissionService } from "./permission.services";

export async function authenticateParticipant<T>(): Promise<T> {
  const phoneResult = await permissionService.getPhoneNumber();
  if (!phoneResult.token) {
    throw new Error(phoneResult.error || "Zalo chưa xác minh được số điện thoại.");
  }

  const profile = await permissionService.getUserProfile();
  const { getAccessToken } = await import("zmp-sdk/apis");
  const accessToken = await getAccessToken();

  return apiRequest<T>("/participant/sessions/zalo", {
    method: "POST",
    body: JSON.stringify({ accessToken, phoneToken: phoneResult.token, zaloName: profile?.name }),
  });
}
