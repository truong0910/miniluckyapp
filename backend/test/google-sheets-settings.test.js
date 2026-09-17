import test from "node:test";
import assert from "node:assert/strict";
import {
  getEffectiveRuntimeConfig,
  normalizeGoogleSheetsWebhookUrl,
  saveGoogleSheetsWebhookUrl,
} from "../src/runtime-system-config.js";

function settingsDb(initialValue = {}) {
  let value = initialValue;
  const writes = [];
  return {
    writes,
    get value() { return value; },
    from(table) {
      assert.equal(table, "program_settings");
      const query = {
        select() { return query; },
        eq(key, expected) {
          assert.equal(key, "key");
          assert.equal(expected, "system_env_config");
          return query;
        },
        async maybeSingle() { return { data: value ? { value } : null, error: null }; },
        async upsert(row) {
          writes.push(row);
          value = row.value;
          return { error: null };
        },
      };
      return query;
    },
  };
}

test("Admin saved Google Sheets URL overrides ENV at runtime", async () => {
  const db = settingsDb({ googleSheetsWebhookUrl: "https://script.google.com/macros/s/admin-sheet/exec" });
  const effective = await getEffectiveRuntimeConfig({
    db,
    config: { googleSheetsWebhookUrl: "https://script.google.com/macros/s/env-sheet/exec" },
  });

  assert.equal(effective.googleSheetsWebhookUrl, "https://script.google.com/macros/s/admin-sheet/exec");
});

test("an explicitly cleared Admin URL disables ENV fallback", async () => {
  const effective = await getEffectiveRuntimeConfig({
    db: settingsDb({ googleSheetsWebhookUrl: "" }),
    config: { googleSheetsWebhookUrl: "https://script.google.com/macros/s/env-sheet/exec" },
  });

  assert.equal(effective.googleSheetsWebhookUrl, "");
});

test("saving a Google Sheets URL preserves other system settings", async () => {
  const db = settingsDb({ zbsApiKey: "keep-this-secret", allowUnlisted: true });
  const savedUrl = await saveGoogleSheetsWebhookUrl({
    db,
    url: " https://script.google.com/macros/s/new-sheet/exec ",
  });

  assert.equal(savedUrl, "https://script.google.com/macros/s/new-sheet/exec");
  assert.equal(db.value.googleSheetsWebhookUrl, savedUrl);
  assert.equal(db.value.zbsApiKey, "keep-this-secret");
  assert.equal(db.value.allowUnlisted, true);
  assert.equal(db.writes.length, 1);
});

test("Google Sheets configuration accepts only Apps Script web app URLs or blank", () => {
  assert.equal(normalizeGoogleSheetsWebhookUrl(""), "");
  assert.equal(normalizeGoogleSheetsWebhookUrl("https://script.google.com/macros/s/deployment/exec"), "https://script.google.com/macros/s/deployment/exec");
  assert.throws(() => normalizeGoogleSheetsWebhookUrl("https://docs.google.com/spreadsheets/d/sheet-id/edit"), /Apps Script/i);
  assert.throws(() => normalizeGoogleSheetsWebhookUrl("http://script.google.com/macros/s/deployment/exec"), /HTTPS/i);
});
