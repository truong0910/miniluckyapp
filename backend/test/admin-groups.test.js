import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminRoutesPath = new URL("../src/routes/admin.routes.js", import.meta.url);

test("admin customer group routes are authenticated and delegate to customer-group-service", async () => {
  const source = await readFile(adminRoutesPath, "utf8");

  assert.match(source, /from\s*"\.\.\/customer-group-service\.js"/);
  assert.match(source, /listGroups/);
  assert.match(source, /createGroup/);
  assert.match(source, /renameGroup/);
  assert.match(source, /deleteGroup/);
  assert.match(source, /listGroupMembers/);
  assert.match(source, /addGroupMember/);
  assert.match(source, /removeGroupMember/);
  assert.match(source, /listGroupRules/);
  assert.match(source, /assignRuleToGroup/);
  assert.match(source, /removeRuleFromGroup/);

  assert.match(source, /router\.get\(\s*"\/groups"\s*,\s*requireAdmin/);
  assert.match(source, /router\.post\(\s*"\/groups"\s*,\s*requireAdmin/);
  assert.match(source, /router\.put\(\s*"\/groups\/:id"\s*,\s*requireAdmin/);
  assert.match(source, /router\.delete\(\s*"\/groups\/:id"\s*,\s*requireAdmin/);
  assert.match(source, /router\.get\(\s*"\/groups\/:id\/members"\s*,\s*requireAdmin/);
  assert.match(source, /router\.post\(\s*"\/groups\/:id\/members"\s*,\s*requireAdmin/);
  assert.match(source, /router\.delete\(\s*"\/groups\/:id\/members\/:customerId"\s*,\s*requireAdmin/);
  assert.match(source, /router\.get\(\s*"\/groups\/:id\/rules"\s*,\s*requireAdmin/);
  assert.match(source, /router\.post\(\s*"\/groups\/:id\/rules"\s*,\s*requireAdmin/);
  assert.match(source, /router\.delete\(\s*"\/groups\/:id\/rules\/:ruleId"\s*,\s*requireAdmin/);
});
