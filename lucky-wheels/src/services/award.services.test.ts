import { beforeEach, describe, expect, it, vi } from "vitest";
import { awardService } from "./award.services";
import { participantSession } from "./participant-session";

describe("awardService", () => {
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
  });

  it("fetches participant awards with default pagination page 1 limit 20", async () => {
    participantSession.save({ token: "test-token", expiresAt: "2030-01-01T00:00:00.000Z" });
    const mockPayload = {
      items: [
        {
          id: "award-1",
          campaignId: "campaign-1",
          spinEventId: "spin-1",
          rewardId: "reward-1",
          code: "VOUCHER100",
          title: "Voucher 100k",
          value: 100000,
          description: "Giảm 100k",
          result: ["envelope"],
          status: "issued",
          issuedAt: "2026-08-16T00:00:00.000Z",
          deliveredAt: null,
          redeemedAt: null,
          expiresAt: null,
        },
      ],
      page: 1,
      limit: 20,
      hasMore: false,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(mockPayload), { status: 200 }))
    );

    const res = await awardService.getParticipantAwards();
    expect(res).toEqual(mockPayload);
    const [url, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/participant/me/awards?page=1&limit=20");
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer test-token");
  });

  it("fetches participant awards with custom page and limit", async () => {
    participantSession.save({ token: "test-token", expiresAt: "2030-01-01T00:00:00.000Z" });
    const mockPayload = { items: [], page: 2, limit: 5, hasMore: false };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(mockPayload), { status: 200 }))
    );

    const res = await awardService.getParticipantAwards(2, 5);
    expect(res).toEqual(mockPayload);
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/participant/me/awards?page=2&limit=5");
  });
});
