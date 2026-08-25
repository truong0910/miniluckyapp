import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./register-form.tsx", import.meta.url), "utf8");

describe("participant registration auth modes", () => {
  it("keeps manual lookup behind preview mode and uses the Zalo token flow in Zalo mode", () => {
    expect(source).toContain("participantService.isZaloMode()");
    expect(source).toContain("startPreview");
    expect(source).toContain("getPhoneNumber");
    expect(source).toContain("if (!res.token)");
    expect(source).toContain("startWithZalo");
  });
});
