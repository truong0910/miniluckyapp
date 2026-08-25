import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routesPath = new URL("../src/routes/public.routes.js", import.meta.url);

test("participant awards route is authenticated, paginated, and participant-scoped", async () => {
  const source = await readFile(routesPath, "utf8");
  const routeStart = source.indexOf('router.get("/participant/me/awards"');
  const routeEnd = source.indexOf("router.", routeStart + 1);
  const route = routeStart >= 0 ? source.slice(routeStart, routeEnd) : "";

  assert.ok(route, "expected GET /participant/me/awards protected by requireParticipant");
  assert.match(source, /import\s*\{[^}]*parseAwardsPagination[^}]*listParticipantAwards[^}]*\}\s*from\s*"\.\.\/award-service\.js"/);
  assert.match(route, /requireParticipant\s*,\s*asyncRoute/);
  assert.match(route, /parseAwardsPagination\(req\.query\)/);
  assert.match(route, /req\.participant\.customerId/);
  assert.match(route, /listParticipantAwards\(\{\s*db:\s*supabase,[\s\S]*customerId,[\s\S]*page,[\s\S]*limit[\s\S]*\}\)/);
  assert.match(route, /res\.json\(await listParticipantAwards/);
  assert.doesNotMatch(route, /req\.(?:query|body|headers)\.customerId/);
  assert.doesNotMatch(source, /"\/participant\/me\/awards\/:id"/);
});
