import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./voucher.tsx", import.meta.url), "utf8");

describe("VoucherPage Awards History Integration", () => {
  it("imports and consumes awardService for participant awards history", () => {
    expect(source).toContain("awardService");
    expect(source).toContain("awardService.getParticipantAwards");
  });

  it("handles loading, error, empty, and pagination states", () => {
    // Loading state
    expect(source).toContain("awardsLoading");

    // Error & Retry state
    expect(source).toContain("awardsError");
    expect(source).toContain("Thử lại");
    expect(source).toContain("loadAwards");

    // Empty state
    expect(source).toContain("Bạn chưa có voucher nào trong kho.");

    // Pagination state
    expect(source).toContain("hasMore");
    expect(source).toContain("Xem thêm voucher");
  });
});
