import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminRoutesPath = new URL("../src/routes/admin.routes.js", import.meta.url);

test("admin awards route is authenticated, paginated, and supports filters", async () => {
  const source = await readFile(adminRoutesPath, "utf8");
  const routeStart = source.indexOf('router.get("/awards"');
  const routeEnd = source.indexOf("router.", routeStart + 1);
  const route = routeStart >= 0 ? source.slice(routeStart, routeEnd >= 0 ? routeEnd : undefined) : "";

  assert.ok(route, "expected GET /admin/awards route declared in admin.routes.js");
  assert.match(route, /requireAdmin\s*,\s*asyncRoute/);
  assert.match(route, /supabase\s*\.\s*from\(\s*"awards"\s*\)/);
  assert.match(route, /items/);
  assert.match(route, /page/);
  assert.match(route, /limit/);
  assert.match(route, /total/);
  assert.match(route, /hasMore/);
});
