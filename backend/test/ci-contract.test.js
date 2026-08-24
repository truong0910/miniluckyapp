import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const ciPath = new URL("../../.github/workflows/ci.yml", import.meta.url);

test("CI supplies non-production Supabase placeholders for backend unit tests", () => {
  if (!existsSync(ciPath)) return;
  const workflow = readFileSync(ciPath, "utf8");
  assert.match(workflow, /node-version:\s*22/);
  assert.match(workflow, /SUPABASE_URL:\s+https:\/\/example\.supabase\.co/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s+ci-placeholder-service-role-key/);
  assert.match(workflow, /SUPABASE_ANON_KEY:\s+ci-placeholder-anon-key/);
});
