import test from "node:test";
import assert from "node:assert/strict";
import {
  createOpaqueToken,
  hashToken,
  timingSafeTokenEqual,
  createSignedDevToken,
  verifySignedDevToken,
} from "../src/auth/token.js";

test("opaque tokens are random and hashes are stable", () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();

  assert.notEqual(first, second);
  assert.equal(hashToken(first), hashToken(first));
  assert.equal(timingSafeTokenEqual(hashToken(first), hashToken(first)), true);
  assert.equal(timingSafeTokenEqual(hashToken(first), hashToken(second)), false);
});

test("signed development tokens reject expiry and tampering", () => {
  const token = createSignedDevToken({ role: "admin", exp: 1000 }, "secret", 0);

  assert.deepEqual(verifySignedDevToken(token, "secret", 500), { role: "admin", exp: 1000 });
  assert.throws(() => verifySignedDevToken(token, "secret", 1001), /expired/i);
  assert.throws(() => verifySignedDevToken(token + "x", "secret", 500), /signature/i);
});
