import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./register-form.tsx", import.meta.url), "utf8");

describe("Zalo-only registration", () => {
  it("does not expose a manual phone input and uses the Zalo token flow", () => {
    expect(source).not.toContain("<Input");
    expect(source).not.toContain("form.Field");
    expect(source).not.toContain("lookupCustomerByPhone");
    expect(source).toContain("getPhoneNumber");
    expect(source).toContain("if (!res.token)");
    expect(source).toContain("startWithZalo");
  });
});
