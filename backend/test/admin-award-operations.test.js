import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminRoutesPath = new URL("../src/routes/admin.routes.js", import.meta.url);

test("admin award operational routes are authenticated and delegate to award-operations-service", async () => {
  const source = await readFile(adminRoutesPath, "utf8");

  assert.match(source, /from\s*"\.\.\/award-operations-service\.js"/);
  assert.match(source, /redeemAward/);
  assert.match(source, /resendAwardDelivery/);
  assert.match(source, /updateAwardStatus/);
  assert.match(source, /getCampaignInventorySummary/);

  assert.match(source, /router\.post\(\s*"\/awards\/:id\/redeem"\s*,\s*requireAdmin/);
  assert.match(source, /router\.post\(\s*"\/awards\/:id\/resend"\s*,\s*requireAdmin/);
  assert.match(source, /router\.post\(\s*"\/awards\/:id\/status"\s*,\s*requireAdmin/);
  assert.match(source, /router\.get\(\s*"\/campaigns\/:id\/inventory"\s*,\s*requireAdmin/);
});
