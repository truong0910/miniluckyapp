import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");

test("CI supplies non-production Supabase placeholders for backend unit tests", () => {
  assert.match(workflow, /node-version:\s*22/);
  assert.match(workflow, /SUPABASE_URL:\s+https:\/\/example\.supabase\.co/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s+ci-placeholder-service-role-key/);
  assert.match(workflow, /SUPABASE_ANON_KEY:\s+ci-placeholder-anon-key/);
});
