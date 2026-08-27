import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminRoutesPath = new URL("../src/routes/admin.routes.js", import.meta.url);

test("admin reporting and CSV export routes are authenticated and delegate to campaign-reporting-service", async () => {
  const source = await readFile(adminRoutesPath, "utf8");

  assert.match(source, /from\s*"\.\.\/campaign-reporting-service\.js"/);
  assert.match(source, /getCampaignAnalytics/);
  assert.match(source, /generateCampaignExportCsv/);

  assert.match(source, /router\.get\(\s*"\/campaigns\/:id\/analytics"\s*,\s*requireAdmin/);
  assert.match(source, /router\.get\(\s*"\/campaigns\/:id\/export"\s*,\s*requireAdmin/);
});
