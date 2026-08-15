import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPreviewAuthAllowed,
  createParticipantSession,
  findParticipantSession,
  resolveZaloPhone,
} from "../src/participant-auth.js";

function insertDb() {
  let inserted;
  return {
    get inserted() {
      return inserted;
    },
    from(table) {
      assert.equal(table, "participant_sessions");
      return {
        insert(record) {
          inserted = record;
          return {
            select() {
              return {
                async single() {
                  return { data: { id: "session-1", expires_at: record.expires_at }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

test("participant session stores only the token hash", async () => {
  const db = insertDb();
  const result = await createParticipantSession({
    db,
    customerId: "customer-1",
    authMethod: "preview",
    ttlSeconds: 1800,
    now: 0,
  });

  assert.equal(result.sessionId, "session-1");
  assert.equal(result.expiresAt, "1970-01-01T00:30:00.000Z");
  assert.equal(db.inserted.customer_id, "customer-1");
  assert.equal(db.inserted.auth_method, "preview");
  assert.equal(db.inserted.token_hash.length, 64);
  assert.notEqual(db.inserted.token_hash, result.token);
});

test("participant session lookup rejects expired records", async () => {
  const db = {
    from() {
      const query = {
        select() { return query; },
        eq() { return query; },
        is() { return query; },
        gt() { return query; },
        async maybeSingle() { return { data: null, error: null }; },
      };
      return query;
    },
  };
  assert.equal(await findParticipantSession({ db, token: "token", now: 0 }), null);
});

test("Zalo phone token is exchanged and normalized", async () => {
  let request;
  const phone = await resolveZaloPhone({
    accessToken: "access-token",
    phoneToken: "phone-token",
    appSecret: "app-secret",
    baseUrl: "https://graph.example.test",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, async json() { return { error: 0, data: { number: "84912345678" } }; } };
    },
  });

  assert.equal(phone, "0912345678");
  assert.equal(request.url, "https://graph.example.test/v2.0/me/info");
  assert.equal(request.options.headers.access_token, "access-token");
  assert.equal(request.options.headers.code, "phone-token");
  assert.equal(request.options.headers.secret_key, "app-secret");
});

test("preview participant auth is rejected outside development", () => {
  assert.doesNotThrow(() => assertPreviewAuthAllowed({ appEnv: "development", participantAuthMode: "preview" }));
  assert.throws(() => assertPreviewAuthAllowed({ appEnv: "production", participantAuthMode: "preview" }), /preview/i);
});
