import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const routesPath = path.resolve(process.cwd(), "src/routes/public.routes.js");
const configPath = path.resolve(process.cwd(), "src/config.js");

test("public spin and delivery contracts do not trust client identity or voucher fields", async () => {
  const routes = await fs.readFile(routesPath, "utf8");
  assert.match(routes, /router\.post\("\/spins",\s*requireParticipant/);
  assert.match(routes, /idempotency-key/);
  assert.doesNotMatch(routes, /req\.body\??\.customerId/);
  assert.doesNotMatch(routes, /const\s+\{[^}]*\b(phone|reward|customerName)\b[^}]*\}\s*=\s*req\.body/);
  assert.match(routes, /router\.post\("\/delivery\/zbs",\s*requireParticipant/);
  assert.match(routes, /router\.get\("\/delivery\/zbs\/templates",\s*requireAdmin/);
});

test("public content endpoint exposes active campaign metadata", async () => {
  const routes = await fs.readFile(routesPath, "utf8");
  assert.match(routes, /import\s*\{[^}]*getActiveCampaign[^}]*\}\s*from\s*"\.\.\/campaign-service\.js"/);
  assert.match(routes, /getActiveCampaign\(\{\s*db:\s*supabase\s*\}\)/);
  assert.match(routes, /campaign:\s*activeCampaign/);
});

test("runtime configuration rejects production preview auth", async () => {
  const source = await fs.readFile(configPath, "utf8");
  assert.match(source, /production.*participantAuthMode.*preview/s);
  assert.match(source, /Production Zalo auth requires ZALO_APP_SECRET/);
});
