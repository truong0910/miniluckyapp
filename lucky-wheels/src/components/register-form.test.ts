import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const web = readFileSync(new URL("./register-form.web.tsx", import.meta.url), "utf8");
const miniapp = readFileSync(new URL("./register-form.miniapp.tsx", import.meta.url), "utf8");

describe("target-specific registration", () => {
  it("lets browser users identify themselves by phone without Zalo authentication", () => {
    expect(web).toMatch(/type=["']tel["']/);
    expect(web).toContain("participantService.authenticate(phone)");
    expect(web).not.toMatch(/zalo|zmp-sdk|oa/i);
  });

  it("uses Zalo phone permission in Mini App without requiring OA follow", () => {
    expect(miniapp).toContain("participantService.authenticate()");
    expect(miniapp).toMatch(/Zalo|ZALO/);
    expect(miniapp).not.toMatch(/oaService|Official Account|showOAWidget/i);
  });
});
