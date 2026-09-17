import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { normalizeParticipantPhone } from "../src/participant-auth.js";

test("normalizes and validates a browser-entered phone number", () => {
  assert.equal(normalizeParticipantPhone("+84 901 234 567"), "0901234567");
  assert.throws(() => normalizeParticipantPhone("not a phone"), /Số điện thoại không hợp lệ/);
});

test("browser phone auth and Mini App Zalo auth share participant sessions", async () => {
  const routes = await fs.readFile(path.resolve(process.cwd(), "src/routes/public.routes.js"), "utf8");

  assert.match(routes, /router\.post\("\/participant\/sessions\/phone"/);
  assert.match(routes, /router\.post\("\/participant\/sessions\/zalo"/);
  assert.match(routes, /findParticipantCustomer\([^;]*"phone_guest"\)/s);
  assert.match(routes, /findParticipantCustomer\([^;]*"zalo_guest"\)/s);
  assert.match(routes, /authMethod:\s*"phone"/);
  assert.match(routes, /authMethod:\s*"zalo"/);
});
