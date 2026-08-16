const OA_FOLLOWED_KEY = "lucky-wheels:oa-followed";

function parseFollowStatus(status: unknown): boolean {
  if (typeof status === "boolean") return status;

  if (status && typeof status === "object") {
    const value = status as Record<string, unknown>;
    if (typeof value.followed === "boolean") return value.followed;
    if (typeof value.isFollowed === "boolean") return value.isFollowed;
  }

  return false;
}

export const oaService = {
  isFollowed() {
    const oaId = import.meta.env.VITE_ZALO_OA_ID?.trim();
    // If no OA ID is configured in .env, automatically auto-pass and consider as followed!
    if (!oaId) {
      return true;
    }
    const stored = window.sessionStorage.getItem(OA_FOLLOWED_KEY);
    return stored === "false" ? false : true;
  },

  setFollowed(followed: boolean) {
    window.sessionStorage.setItem(OA_FOLLOWED_KEY, String(followed));
  },

  updateFromWidgetStatus(status: unknown) {
    const followed = parseFollowStatus(status);
    this.setFollowed(followed);
    return followed;
  },
};
