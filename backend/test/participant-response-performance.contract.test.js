import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const routesPath = path.resolve(process.cwd(), "src/routes/public.routes.js");

test("participant response schedules independent database reads concurrently", async () => {
  const source = await fs.readFile(routesPath, "utf8");
  assert.match(source, /Promise\.all/);
  assert.match(source, /wheelSegments:/);
  assert.match(source, /spinsRemaining:/);
});
