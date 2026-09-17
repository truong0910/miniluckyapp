const SESSION_KEY = "lucky-wheels:participant-session";

export interface ParticipantSessionStorage {
  token: string;
  expiresAt: string;
}

let currentSession: ParticipantSessionStorage | null = null;

function storage() {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

// Remove sessions saved by older versions; new sessions stay in memory only.
storage()?.removeItem(SESSION_KEY);

function isExpired(expiresAt: string, now: Date) {
  const timestamp = Date.parse(expiresAt);
  return !Number.isFinite(timestamp) || timestamp <= now.getTime();
}

export const participantSession = {
  save(value: ParticipantSessionStorage) {
    currentSession = { token: value.token, expiresAt: value.expiresAt };
  },

  getToken(now = new Date()): string | null {
    const value = currentSession;
    if (!value) return null;
    if (isExpired(value.expiresAt, now)) {
      participantSession.clear();
      return null;
    }
    return value.token;
  },

  getExpiresAt(now = new Date()): string | null {
    const value = currentSession;
    if (!value || isExpired(value.expiresAt, now)) {
      if (value) participantSession.clear();
      return null;
    }
    return value.expiresAt;
  },

  clear() {
    currentSession = null;
    storage()?.removeItem(SESSION_KEY);
    try {
      storage()?.removeItem("lucky-wheels:spin-history");
      storage()?.removeItem("lucky-wheels:last-spin");
    } catch {}
  },

  key: SESSION_KEY,
};
