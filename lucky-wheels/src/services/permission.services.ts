import * as zmp from "zmp-sdk/apis";

export interface PhoneResult {
  token?: string;
  error?: string;
}

export interface ZaloUserProfile {
  id?: string;
  name?: string;
  avatar?: string;
}

let cachedUserProfile: ZaloUserProfile | null | undefined;
let userProfileRequest: Promise<ZaloUserProfile | null> | null = null;

function isAppNotActivatedError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const sdkError = error as { code?: unknown; message?: unknown };
  return (
    sdkError.code === -1401 &&
    (typeof sdkError.message === "string" &&
      /app has not been activated/i.test(sdkError.message))
  );
}

function isUserInfoPermissionDeniedError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const sdkError = error as { code?: unknown };
  return sdkError.code === -1401;
}

export const permissionService = {
  async request() {
    return zmp.authorize({
      scopes: ["scope.userInfo", "scope.userPhonenumber"],
    });
  },

  async check() {
    return await zmp.getSetting();
  },

  async getUserProfile(): Promise<ZaloUserProfile | null> {
    if (cachedUserProfile !== undefined) return cachedUserProfile;
    if (userProfileRequest) return userProfileRequest;

    userProfileRequest = (async () => {
      try {
        const res = await zmp.getUserInfo({
          avatarType: "normal",
          autoRequestPermission: true,
        });
        if (res && res.userInfo) {
          const rawName = res.userInfo.name?.trim();
          const isGenericPlaceholder =
            !rawName ||
            rawName.toLowerCase() === "user name" ||
            rawName.toLowerCase() === "username" ||
            rawName.toLowerCase() === "zalo user";

          cachedUserProfile = {
            id: res.userInfo.id,
            name: isGenericPlaceholder ? undefined : rawName,
            avatar: res.userInfo.avatar,
          };
          return cachedUserProfile;
        }
        cachedUserProfile = null;
        return null;
      } catch (error) {
        // A preview/dev app that has not been activated cannot access profile APIs.
        // Cache this expected failure so every form render does not spam the console.
        if (isAppNotActivatedError(error)) {
          cachedUserProfile = null;
          return null;
        }
        // Zalo uses -1401 when the user has declined name/avatar access.
        // Keep the app usable with the fallback customer name until permission
        // is enabled from Mini App settings.
        if (isUserInfoPermissionDeniedError(error)) {
          return null;
        }
        console.warn("Unable to fetch Zalo user profile from SDK", error);
        return null;
      } finally {
        userProfileRequest = null;
      }
    })();

    return userProfileRequest;
  },

  clearUserProfileCache() {
    cachedUserProfile = undefined;
    userProfileRequest = null;
  },

  async getPhoneNumber(): Promise<PhoneResult> {
    try {
      // 1. Xin quyền scope.userPhonenumber trước
      await zmp.authorize({
        scopes: ["scope.userPhonenumber"],
      });

      // 2. Gọi SDK lấy phone token; số điện thoại thật chỉ được giải mã ở backend.
      const response = (await zmp.getPhoneNumber({})) as {
        token?: string;
      };

      if (response.token) {
        return { token: response.token };
      }
      return { error: "Chưa lấy được dữ liệu số điện thoại từ Zalo SDK." };
    } catch (error) {
      console.warn("Unable to get Zalo phone number from SDK", error);
      return {
        error:
          error instanceof Error
            ? error.message
            : "Chưa bật quyền lấy SĐT trên Dashboard Zalo (mini.zalo.me) hoặc người dùng từ chối.",
      };
    }
  },
};
