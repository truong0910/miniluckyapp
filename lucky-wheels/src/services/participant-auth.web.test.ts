import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api.client";
import { authenticateParticipant } from "./participant-auth.web";

vi.mock("./api.client", () => ({ apiRequest: vi.fn() }));

describe("browser participant authentication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts a phone session without calling a Zalo SDK", async () => {
    (apiRequest as any).mockResolvedValue({ id: "p1", phone: "0901234567" });

    await authenticateParticipant("0901234567");

    expect(apiRequest).toHaveBeenCalledWith("/participant/sessions/phone", {
      method: "POST",
      body: JSON.stringify({ phone: "0901234567" }),
    });
  });
});
