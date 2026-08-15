const SESSION_KEY = "lucky-wheels:participant-session";

export interface ParticipantSessionStorage {
  token: string;
  expiresAt: string;
}

function storage() {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

function read(): ParticipantSessionStorage | null {
  const value = storage()?.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ParticipantSessionStorage>;
    if (!parsed.token || !parsed.expiresAt) return null;
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    storage()?.removeItem(SESSION_KEY);
    return null;
  }
}

function isExpired(expiresAt: string, now: Date) {
  const timestamp = Date.parse(expiresAt);
  return !Number.isFinite(timestamp) || timestamp <= now.getTime();
}

export const participantSession = {
  save(value: ParticipantSessionStorage) {
    storage()?.setItem(SESSION_KEY, JSON.stringify({ token: value.token, expiresAt: value.expiresAt }));
  },

  getToken(now = new Date()): string | null {
    const value = read();
    if (!value) return null;
    if (isExpired(value.expiresAt, now)) {
      participantSession.clear();
      return null;
    }
    return value.token;
  },

  getExpiresAt(now = new Date()): string | null {
    const value = read();
    if (!value || isExpired(value.expiresAt, now)) {
      if (value) participantSession.clear();
      return null;
    }
    return value.expiresAt;
  },

  clear() {
    storage()?.removeItem(SESSION_KEY);
  },

  key: SESSION_KEY,
};
