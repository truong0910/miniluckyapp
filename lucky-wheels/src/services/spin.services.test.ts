import { beforeEach, describe, expect, it, vi } from "vitest";
import { spinService } from "./spin.services";

describe("spin request contract", () => {
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
    Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => new Response(JSON.stringify({
      spinId: "spin-1",
      outcome: "better_luck",
      wheelSegmentId: "better-luck",
      result: ["cherry", "lemon", "bell"],
      reward: null,
      spinsRemaining: 1,
    }), { status: 200, headers: { "content-type": "application/json" } })));
  });

  it("sends no customerId body and includes a UUID-shaped idempotency key", async () => {
    await spinService.spin();
    const [, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.body).toBeUndefined();
    const key = new Headers(options.headers).get("idempotency-key");
    expect(key).toMatch(/^[0-9a-f-]{20,}$/i);
  });
});
