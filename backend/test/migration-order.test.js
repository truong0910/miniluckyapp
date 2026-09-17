import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationsDir = fileURLToPath(new URL("../../lucky-wheels/supabase/migrations/", import.meta.url));

test("Supabase migration versions are unique and unlisted access has a later version", async () => {
  const files = await readdir(migrationsDir);
  const sqlFiles = files.filter((name) => name.endsWith(".sql"));
  const versions = new Map();

  for (const file of sqlFiles) {
    const match = /^(\d+)_/.exec(file);
    assert.ok(match, `migration filename must start with a numeric version: ${file}`);
    const version = match[1];
    const existing = versions.get(version);
    assert.equal(existing, undefined, `migration version ${version} is duplicated by ${existing} and ${file}`);
    versions.set(version, file);
  }

  const unlisted = [...sqlFiles].find((name) => name.includes("unlisted_customer_access"));
  assert.ok(unlisted, "unlisted customer access migration is required");
  assert.equal(unlisted.slice(0, 4), "0010", "unlisted access must run after existing 0009 migration");
});
