import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminRoutesPath = new URL("../src/routes/admin.routes.js", import.meta.url);

test("admin campaign clone and participant routes are authenticated and delegate to service", async () => {
  const source = await readFile(adminRoutesPath, "utf8");

  assert.match(source, /from\s*"\.\.\/campaign-reuse-service\.js"/);
  assert.match(source, /cloneCampaign/);
  assert.match(source, /importCampaignParticipants/);
  assert.match(source, /listCampaignParticipants/);

  assert.match(source, /router\.post\(\s*"\/campaigns\/:id\/clone"\s*,\s*requireAdmin/);
  assert.match(source, /router\.get\(\s*"\/campaigns\/:id\/participants"\s*,\s*requireAdmin/);
  assert.match(source, /router\.post\(\s*"\/campaigns\/:id\/participants\/import"\s*,\s*requireAdmin/);
});
