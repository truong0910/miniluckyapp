import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminRoutesPath = new URL("../src/routes/admin.routes.js", import.meta.url);

test("admin campaigns routes are authenticated and delegate to campaign-service", async () => {
  const source = await readFile(adminRoutesPath, "utf8");

  assert.match(source, /from\s*"\.\.\/campaign-service\.js"/);
  assert.match(source, /listCampaigns/);
  assert.match(source, /createCampaign/);
  assert.match(source, /transitionCampaign/);

  assert.match(source, /router\.get\(\s*"\/campaigns"\s*,\s*requireAdmin/);
  assert.match(source, /router\.post\(\s*"\/campaigns"\s*,\s*requireAdmin/);
  assert.match(source, /router\.get\(\s*"\/campaigns\/:id"\s*,\s*requireAdmin/);
  assert.match(source, /router\.put\(\s*"\/campaigns\/:id"\s*,\s*requireAdmin/);
  assert.match(source, /router\.post\(\s*"\/campaigns\/:id\/status"\s*,\s*requireAdmin/);
  assert.match(source, /router\.get\(\s*"\/campaigns\/:id\/readiness"\s*,\s*requireAdmin/);
  assert.match(source, /router\.post\(\s*"\/campaigns\/:id\/dry-run-spin"\s*,\s*requireAdmin/);
});
