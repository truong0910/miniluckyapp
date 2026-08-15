# Giai đoạn 1 Production Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bảo vệ participant API, làm lượt quay nguyên tử/idempotent, chuyển gửi ZBS sang outbox worker và khóa development auth khỏi production mà không reset dữ liệu Supabase.

**Architecture:** Giữ nguyên `backend/`, `lucky-wheels/` và `admin-web/`. Backend cấp participant session ngắn hạn, lấy customer từ Bearer token, gọi Postgres RPC `spin_once()` và tạo delivery outbox; worker riêng đọc outbox rồi gửi ZBS bằng dữ liệu database. Preview auth chỉ tồn tại ở local development; production chỉ dùng Zalo phone-token verification.

**Tech Stack:** Node.js ES modules, Express 4, `node:test`, Supabase Postgres/RPC, Supabase Auth, React/TypeScript/Vite, ZMP SDK 2.53.0.

## Global Constraints

- Không reset, xóa hoặc tự động sửa dữ liệu Supabase hiện có.
- `PARTICIPANT_AUTH_MODE=preview` chỉ được phép khi `APP_ENV=development`.
- Production chỉ chấp nhận participant phone đã xác minh từ Zalo.
- Participant token chỉ lưu dạng SHA-256 hash; session mặc định hết hạn sau 30 phút.
- `POST /spins` bắt buộc `Authorization: Bearer` và `Idempotency-Key`; body không chứa `customerId`, phone, reward hoặc `oaFollowed`.
- `spin_once()` là `SECURITY DEFINER`, `search_path=public`, và không được gọi trực tiếp bởi anon/authenticated.
- Worker retry tối đa 8 lần, dùng request ID ổn định theo `delivery.id`, và không đọc dữ liệu reward từ client.
- Rule yêu cầu OA không được tin `oaFollowed` từ client; chưa có server-side OA adapter thì rule không đủ điều kiện.
- Mỗi task có test riêng và một commit chỉ chứa file của task đó. Không đưa secret vào source/bundle/commit.

---

### Task 1: Backend test harness và primitive token

**Files:** Create `backend/src/auth/token.js`, `backend/test/token.test.js`; modify `backend/package.json`.

**Interfaces:** `createOpaqueToken(bytes = 32) -> string`, `hashToken(token) -> string`, `timingSafeTokenEqual(leftHash, rightHash) -> boolean`, `createSignedDevToken(payload, secret, nowMs) -> string`, `verifySignedDevToken(token, secret, nowMs) -> payload`.

- [ ] Write failing `node:test` cases for random tokens, stable hashes, expiry and tampering. The signed case must assert:

  ```
  const token = createSignedDevToken({ role: "admin", exp: 1000 }, "secret", 0);
  assert.deepEqual(verifySignedDevToken(token, "secret", 500), { role: "admin", exp: 1000 });
  assert.throws(() => verifySignedDevToken(token, "secret", 1001), /expired/i);
  assert.throws(() => verifySignedDevToken(token + "x", "secret", 500), /signature/i);
  ```

- [ ] Run `npm --prefix backend test -- --test-name-pattern="opaque|signed"`; expect FAIL because the module is absent.
- [ ] Implement with Node `crypto.randomBytes`, `createHash`, `createHmac` and `timingSafeEqual` using base64url; reject malformed, expired and mismatched signatures.
- [ ] Add `"test": "node --test"` to `backend/package.json`, rerun focused tests, expect PASS, then commit with `git commit -m "test: add backend auth token primitives"`.

### Task 2: Environment guards and admin development sessions

**Files:** Modify `backend/src/config.js`, `backend/src/middleware.js` and `backend/src/routes/admin.routes.js`; create `backend/test/admin-auth.test.js` and `backend/.env.example`.

**Interfaces:** `config.appEnv: "development" | "production"`, `config.participantAuthMode: "preview" | "zalo"`, and `requireAdmin(req, res, next)` accepts Supabase tokens or signed development sessions only in development.

- [ ] Write failing tests for production + preview rejection and signed local admin token rejection in production; run `npm --prefix backend test -- --test-name-pattern="environment|admin"` and expect FAIL.
- [ ] Add `APP_ENV`, `PARTICIPANT_AUTH_MODE`, `PARTICIPANT_SESSION_TTL_SECONDS`, `DEV_AUTH_SECRET`, `ZALO_APP_SECRET`, `ZALO_GRAPH_BASE_URL`, `WORKER_ID` and retry settings. Throw on production preview auth or development auth without its secret.
- [ ] Keep Supabase Auth first. Permit email/password fallback only when `config.appEnv === "development"`, issue a 30-minute HMAC token, and delete every comparison with `local-development-token`.
- [ ] Document local values in `backend/.env.example` without real secrets; rerun tests and `node --check backend/src/middleware.js`.
- [ ] Commit exact task files with `git add backend/src/config.js backend/src/middleware.js backend/src/routes/admin.routes.js backend/test/admin-auth.test.js backend/.env.example` and `git commit -m "feat: lock development auth to local environment"`.

### Task 3: Participant session and Zalo phone verification

**Files:** Create `backend/src/participant-auth.js` and `backend/test/participant-auth.test.js`; modify `backend/src/routes/public.routes.js` and `backend/src/utils.js`.

**Interfaces:** `createParticipantSession({ db, customerId, authMethod, now }) -> Promise<{ token, expiresAt }>`, `requireParticipant` sets `req.participant = { sessionId, customerId, authMethod }`, `resolveZaloPhone({ accessToken, phoneToken, appSecret, baseUrl, fetchImpl }) -> Promise<string>`.

- [ ] Write failing tests for Vietnamese phone normalization, successful/failed fake Zalo response, raw token not persisted, and preview rejection in production; run `npm --prefix backend test -- --test-name-pattern="participant|Zalo|phone"` and expect FAIL.
- [ ] Generate opaque token, hash before inserting `participant_sessions`, return raw token once; middleware checks Bearer hash, expiry/revocation and customer.
- [ ] Call `GET {ZALO_GRAPH_BASE_URL}/v2.0/me/info` with headers `access_token`, `code` and `secret_key`; require `error: 0` and `data.number`; map failures to 401/502 without returning secrets.
- [ ] Add `POST /participant/sessions/preview`, `POST /participant/sessions/zalo`, `GET /participant/me` and `GET /participant/me/spins`. Keep `/content` public. Old arbitrary-customer routes return 410.
- [ ] Run focused tests/syntax checks and commit exact task files with `git add backend/src/participant-auth.js backend/test/participant-auth.test.js backend/src/routes/public.routes.js backend/src/utils.js` and `git commit -m "feat: authenticate participants with short-lived sessions"`.

### Task 4: Non-destructive Supabase migration and atomic RPC

**Files:** Create `lucky-wheels/supabase/migrations/0002_phase1_security.sql`, `lucky-wheels/supabase/tests/phase1_spin.sql` and `backend/test/db/phase1.integration.test.js`; modify `lucky-wheels/supabase/README.md` and `backend/package.json`.

**Interfaces:** `public.spin_once(p_customer_id text, p_idempotency_key text, p_oa_followed boolean) -> jsonb`, `public.claim_deliveries(p_worker_id text, p_limit integer) -> setof deliveries`, `public.finish_delivery(p_delivery_id uuid, p_status text, p_message_id text, p_error text, p_next_attempt_at timestamptz) -> deliveries`.

- [ ] Write isolated SQL assertions for duplicate detection, idempotent replay, concurrent quota serialization, non-negative inventory, rollback and one delivery per reward spin.
- [ ] Add `"test:db": "node --test test/db/**/*.test.js"` to `backend/package.json` and create the runner that refuses to connect unless `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` are set. Run `npm --prefix backend run test:db` before migration; expect FAIL because tables/functions are absent.
- [ ] Add `participant_sessions`, `deliveries`, nullable `spin_events.idempotency_key`, partial unique indexes, checks and indexes. Each unique index uses a `DO ... RAISE EXCEPTION` duplicate check; never delete/merge old rows.
- [ ] Implement `spin_once`: lock customer, replay idempotency, compute spin, preserve current rule precedence, lock reward row, decrement positive inventory, insert event snapshot, insert delivery, return JSON. Revoke execute from anon/authenticated and grant only Backend role.
- [ ] Implement claim/finish RPCs with `FOR UPDATE SKIP LOCKED`, stale-processing recovery and valid status transitions.
- [ ] Apply migration to an isolated test project, run `npm --prefix backend run test:db`, expect PASS, document migration order, then commit exact files with `git add lucky-wheels/supabase/migrations/0002_phase1_security.sql lucky-wheels/supabase/tests/phase1_spin.sql lucky-wheels/supabase/README.md backend/package.json backend/test/db/phase1.integration.test.js` and `git commit -m "feat: add atomic spin and delivery database primitives"`.

### Task 5: Route Backend spin API through spin_once

**Files:** Create `backend/src/spin-service.js` and `backend/test/spin-service.test.js`; modify `backend/src/routes/public.routes.js` and `backend/src/rule-engine.js`.

**Interfaces:** `spinOnce({ db, customerId, idempotencyKey, oaFollowed }) -> Promise<SpinResponse>`, where `SpinResponse = { spinId, timestamp, outcome, wheelSegmentId, result, reward, spinsRemaining }`.

- [ ] Write failing RPC-mock tests for customer from middleware, exact idempotency key, server-derived OA state and 409/502 mapping; run focused test and expect FAIL.
- [ ] Add `requireParticipant` before `POST /spins`, validate UUID `Idempotency-Key`, call `supabase.rpc("spin_once", { p_customer_id, p_idempotency_key, p_oa_followed })`, map result without recomputing quota/reward.
- [ ] Stop calling `chooseRuleOutcome` from the public route; remove read-count-update-insert spin behavior.
- [ ] Run focused tests and both syntax checks; commit exact task files with `git add backend/src/spin-service.js backend/test/spin-service.test.js backend/src/routes/public.routes.js backend/src/rule-engine.js` and `git commit -m "feat: route spins through atomic database RPC"`.

### Task 6: Mini App session, phone autofill and idempotent spin

**Files:** Create `lucky-wheels/src/services/participant-session.ts` and `lucky-wheels/src/services/participant-session.test.ts`; modify `lucky-wheels/src/services/api.client.ts`, `participant.services.ts`, `permission.services.ts`, `spin.services.ts`, `lucky-wheels/src/components/register-form.tsx`, `lucky-wheels/src/pages/wheel.tsx` and `lucky-wheels/package.json`.

**Interfaces:** `ParticipantSession = { token: string, expiresAt: string, participant: Participant }`; `startPreview(phone)`; `startWithZalo(accessToken, phoneToken)`; `getToken() -> string | null`; `spinService.spin()` accepts no participant ID.

- [ ] Add failing Vitest tests for storage/expiry, Bearer header, no `customerId` in spin request and UUID idempotency key. Run `npm --prefix lucky-wheels install --save-dev vitest`, add `"test": "vitest run"`, run focused test, expect FAIL.
- [ ] Store only opaque token/expiry in sessionStorage; remove `lucky-wheels:participant-id` authorization; attach Bearer and clear it on 401.
- [ ] Keep editable phone input and add “Lấy số từ Zalo” button. Raw number fills input; token combines with `zmp.getAccessToken()` and Zalo session route; denial leaves manual preview input usable.
- [ ] Registration starts preview/Zalo session by environment. Spin creates/reuses one UUID per attempt, sends it as `Idempotency-Key` and stores only UI state; update wheel callers to call `spin()` without ID.
- [ ] Run `npm --prefix lucky-wheels test -- --run` and `npm --prefix lucky-wheels run build`; commit package lock and exact task files with `git add lucky-wheels/package.json lucky-wheels/package-lock.json lucky-wheels/src/services lucky-wheels/src/components/register-form.tsx lucky-wheels/src/pages/wheel.tsx` and `git commit -m "feat: use participant sessions and phone autofill"`.

### Task 7: Delivery worker and secure delivery routes

**Files:** Create `backend/src/delivery-service.js`, `backend/src/delivery-worker.js` and `backend/test/delivery-service.test.js`; modify `backend/src/routes/public.routes.js`, `backend/src/server.js` and `backend/package.json`.

**Interfaces:** `claimDeliveryBatch({ db, workerId, limit }) -> Promise<Delivery[]>`, `sendDelivery({ delivery, db, fetchImpl, config }) -> Promise<{ messageId: string }>`, `runDeliveryWorker({ db, config, fetchImpl, signal }) -> Promise<void>`.

- [ ] Write failing fake DB/fetch tests for claim once, server-side customer/reward loading, retry after 502 and no send for already-sent delivery; run focused worker test and expect FAIL.
- [ ] Implement claim/finish calls, DB-only phone/name/reward loading, 84-number normalization and `X-Idempotency-Key: delivery.id`. Only successful ZBS body becomes sent.
- [ ] Add 5-second poll, batch size, AbortSignal shutdown, 8 attempts and `min(15 minutes, 30 seconds * 2 ** attempts)` backoff. Worker is a separate process.
- [ ] Make `POST /delivery/zbs` require participant auth, verify ownership and return queue status. Make templates admin-only. Add `"worker:delivery": "node src/delivery-worker.js"`.
- [ ] Run tests and `node --check backend/src/delivery-worker.js`; commit exact task files with `git add backend/src/delivery-service.js backend/src/delivery-worker.js backend/test/delivery-service.test.js backend/src/routes/public.routes.js backend/src/server.js backend/package.json` and `git commit -m "feat: process voucher delivery through outbox worker"`.

### Task 8: Contract checks, documentation and rollout verification

**Files:** Modify `backend/README.md`, `lucky-wheels/README.md` and `lucky-wheels/supabase/README.md`; create `lucky-wheels/.env.example` and `backend/test/phase1-contract.test.js`.

**Interfaces:** Document `npm --prefix backend run dev`, `npm --prefix backend run worker:delivery`, `npm --prefix lucky-wheels run start`; production requires `APP_ENV=production`, `PARTICIPANT_AUTH_MODE=zalo` and `ZALO_APP_SECRET`, with no development secret.

- [ ] Write failing static checks for `requireParticipant`, `Idempotency-Key`, no `req.body.customerId`, and no phone/reward destructuring in delivery; run focused test and expect FAIL until Tasks 5/7.
- [ ] Document session/auth, autofill, retry, migration order, worker terminal, Zalo permission and App Secret.
- [ ] Run `npm --prefix backend test`, `npm --prefix lucky-wheels test -- --run`, `npm --prefix lucky-wheels run build`, `npm --prefix admin-web run build`, `node --check backend/src/server.js` and `node --check backend/src/routes/admin.routes.js`; expect PASS.
- [ ] Confirm no .env or service key is staged, production rejects preview auth, and old customer routes cannot return data. Commit exact files with `git add backend/README.md lucky-wheels/README.md lucky-wheels/supabase/README.md lucky-wheels/.env.example backend/test/phase1-contract.test.js` and `git commit -m "docs: document phase 1 rollout and verification"`.

## Plan Self-Review

- **Spec coverage:** Auth/autofill Tasks 2, 3, 6; migration/RPC/concurrency Task 4; atomic API Task 5; outbox/worker/ZBS source Task 7; admin hardening Task 2; rollout/build Task 8.
- **Placeholder scan:** No unresolved placeholders or unspecified implementation steps.
- **Interface consistency:** Session, spin, RPC, delivery and worker signatures are defined in task interfaces and reused later.
- **Data safety:** No task resets, bulk-deletes, or runs tests against production.
