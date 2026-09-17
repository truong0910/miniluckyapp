import { beforeEach, describe, expect, it, vi } from "vitest";
import { participantService, type Participant } from "./participant.services";
import { apiRequest } from "./api.client";
import { participantSession } from "./participant-session";
import { authenticateParticipant } from "@/platform/participant-auth";

vi.mock("./api.client", () => ({ apiRequest: vi.fn() }));
vi.mock("@/platform/participant-auth", () => ({ authenticateParticipant: vi.fn() }));
vi.mock("./participant-session", () => {
  let storedToken: string | null = null;
  return {
    participantSession: {
      getToken: vi.fn(() => storedToken),
      save: vi.fn((session: { token: string }) => { storedToken = session.token; }),
      clear: vi.fn(() => { storedToken = null; }),
      __setToken: (token: string | null) => { storedToken = token; },
    },
  };
});

const mockParticipant: Participant = {
  id: "p-1",
  name: "Nguyen Van A",
  phone: "0901234567",
  sex: "male",
  job: "worker",
  spinsTotal: 3,
  rewardsTotal: 0,
  spinsRemaining: 3,
  wheelSegments: [{ id: "seg-1", title: "Quà 50k", value: 50000, symbol: "star" }],
};

describe("participantService in-memory cache & deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    participantService.clearCached();
    (participantSession as any).__setToken(null);
  });

  it("caches the session response so it does not issue a second profile request", async () => {
    (authenticateParticipant as any).mockResolvedValueOnce({
      ...mockParticipant,
      session: { token: "token-123", expiresAt: "2026-12-31T23:59:59Z" },
    });

    const created = await participantService.authenticate("0901234567");
    const current = await participantService.getCurrent();

    expect(current).toEqual(created);
    expect(authenticateParticipant).toHaveBeenCalledWith("0901234567");
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("shares one in-flight GET when two callers arrive together", async () => {
    (participantSession as any).__setToken("token-123");
    (apiRequest as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockParticipant), 50))
    );

    const [res1, res2] = await Promise.all([participantService.getCurrent(), participantService.getCurrent()]);
    expect(res1).toEqual(mockParticipant);
    expect(res2).toEqual(mockParticipant);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("does not return a payload cached for a different session token", async () => {
    (authenticateParticipant as any).mockResolvedValueOnce({
      ...mockParticipant,
      session: { token: "token-a", expiresAt: "2026-12-31T23:59:59Z" },
    });
    await participantService.authenticate("0901234567");

    (participantSession as any).__setToken("token-b");
    (apiRequest as any).mockResolvedValueOnce({ ...mockParticipant, id: "p-2" });
    const current = await participantService.getCurrent();
    expect(apiRequest).toHaveBeenCalledWith("/participant/me");
    expect(current?.id).toBe("p-2");
  });

  it("clears cached participant data when a 401 clears the session", async () => {
    (participantSession as any).__setToken("token-expired");
    (apiRequest as any).mockRejectedValueOnce(Object.assign(new Error("expired"), { status: 401 }));
    await expect(participantService.getCurrent({ force: true })).resolves.toBeNull();
    expect(participantService.getCached()).toBeNull();
  });
});
