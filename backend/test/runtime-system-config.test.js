import test from "node:test";
import assert from "node:assert/strict";
import { getEffectiveRuntimeConfig } from "../src/runtime-system-config.js";

function settingsDb(value) {
  return {
    from(table) {
      assert.equal(table, "program_settings");
      const query = {
        select() { return query; },
        eq(key, expected) { assert.equal(key, "key"); assert.equal(expected, "system_env_config"); return query; },
        async maybeSingle() { return { data: { value }, error: null }; },
      };
      return query;
    },
  };
}

test("runtime secrets saved in system settings reach both Zalo auth and the delivery worker", async () => {
  const effective = await getEffectiveRuntimeConfig({
    db: settingsDb({
      zaloAppSecret: "db-zalo-secret",
      zbsApiKey: "db-zbs-key",
      zbsTemplateId: "db-template",
    }),
    config: { zaloAppSecret: "env-zalo-secret", zbsApiKey: "env-zbs-key", zbsTemplateId: "env-template" },
  });

  assert.equal(effective.zaloAppSecret, "db-zalo-secret");
  assert.equal(effective.zbsApiKey, "db-zbs-key");
  assert.equal(effective.zbsTemplateId, "db-template");
});

test("environment values remain the fallback when system settings are empty", async () => {
  const effective = await getEffectiveRuntimeConfig({
    db: settingsDb({}),
    config: { zaloAppSecret: "env-zalo-secret", zbsApiKey: "env-zbs-key", zbsTemplateId: "env-template" },
  });

  assert.equal(effective.zaloAppSecret, "env-zalo-secret");
  assert.equal(effective.zbsApiKey, "env-zbs-key");
  assert.equal(effective.zbsTemplateId, "env-template");
});
