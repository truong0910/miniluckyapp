import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api.client";
import { participantSession } from "./participant-session";

describe("api client participant auth", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
  });

  it("adds a Bearer header from the opaque participant session", async () => {
    participantSession.save({ token: "session-token", expiresAt: "2030-01-01T00:00:00.000Z" });
    await apiRequest("/participant/me");
    const [, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer session-token");
  });
});
