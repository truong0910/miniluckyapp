import { beforeEach, describe, expect, it, vi } from "vitest";
import { participantSession } from "./participant-session";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("participant session storage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: createStorage(),
    });
    participantSession.clear();
  });

  it("keeps the session in memory and loses it after a page reload", async () => {
    participantSession.save({ token: "opaque-token", expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(participantSession.getToken(new Date("2029-01-01T00:00:00.000Z"))).toBe("opaque-token");
    expect(sessionStorage.getItem("lucky-wheels:participant-session")).toBeNull();

    vi.resetModules();
    const { participantSession: reloadedSession } = await import("./participant-session");
    expect(reloadedSession.getToken(new Date("2029-01-01T00:00:00.000Z"))).toBeNull();
  });

  it("removes a previously saved browser session when the app loads", async () => {
    sessionStorage.setItem("lucky-wheels:participant-session", JSON.stringify({
      token: "legacy-token",
      expiresAt: "2030-01-01T00:00:00.000Z",
    }));
    vi.resetModules();

    const { participantSession: reloadedSession } = await import("./participant-session");
    expect(reloadedSession.getToken(new Date("2029-01-01T00:00:00.000Z"))).toBeNull();
    expect(sessionStorage.getItem("lucky-wheels:participant-session")).toBeNull();
  });

  it("clears an expired in-memory session", () => {
    participantSession.save({ token: "opaque-token", expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(participantSession.getToken(new Date("2031-01-01T00:00:00.000Z"))).toBeNull();
    expect(sessionStorage.getItem("lucky-wheels:participant-session")).toBeNull();
  });
});
