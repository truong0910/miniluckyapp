function isZaloAuthMode() {
  return String(import.meta.env.VITE_PARTICIPANT_AUTH_MODE || "").toLowerCase() === "zalo";
}

async function getZmpApis() {
  if (!isZaloAuthMode()) return null;
  return await import("zmp-sdk/apis").catch(() => null);
}

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
    const zmp = await getZmpApis();
    if (!zmp) return {};
    return zmp.authorize({
      scopes: ["scope.userInfo", "scope.userPhonenumber"],
    }).catch(() => ({}));
  },

  async check() {
    const zmp = await getZmpApis();
    if (!zmp) return {};
    return await zmp.getSetting().catch(() => ({}));
  },

  async getUserProfile(): Promise<ZaloUserProfile | null> {
    if (!isZaloAuthMode()) return null;
    const zmp = await getZmpApis();
    if (!zmp) return null;
    if (cachedUserProfile !== undefined) return cachedUserProfile;
    if (userProfileRequest) return userProfileRequest;

    userProfileRequest = (async () => {
      try {
        const res = await Promise.resolve(
          zmp.getUserInfo({
            avatarType: "normal",
            autoRequestPermission: false,
          })
        ).catch(() => null);
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
        if (isAppNotActivatedError(error)) {
          cachedUserProfile = null;
          return null;
        }
        if (isUserInfoPermissionDeniedError(error)) {
          return null;
        }
        cachedUserProfile = null;
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
    if (!isZaloAuthMode()) return { error: "Xác minh SĐT Zalo không được hỗ trợ trong chế độ Web." };
    const zmp = await getZmpApis();
    if (!zmp) return { error: "Không thể nạp Zalo SDK." };
    try {
      await zmp.authorize({
        scopes: ["scope.userPhonenumber"],
      });

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
