import { beforeEach, describe, expect, it } from "vitest";
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
  });

  it("stores only the opaque token and expiry and clears expired sessions", () => {
    participantSession.save({ token: "opaque-token", expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(participantSession.getToken(new Date("2029-01-01T00:00:00.000Z"))).toBe("opaque-token");
    expect(JSON.parse(sessionStorage.getItem("lucky-wheels:participant-session") || "{}"))
      .toEqual({ token: "opaque-token", expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(participantSession.getToken(new Date("2031-01-01T00:00:00.000Z"))).toBeNull();
    expect(sessionStorage.getItem("lucky-wheels:participant-session")).toBeNull();
  });
});
