# Wheel Data Loading Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Mini App lucky wheel appear immediately with valid reward segments, remove the blank-wheel state during loading, and reduce duplicate participant-data requests.

**Architecture:** Reuse the complete participant payload returned by session creation through a short-lived in-memory cache and an in-flight request deduper. The wheel component will explicitly distinguish loading, ready, empty, and error states instead of rendering an empty SVG wheel. The participant response builder will run independent database queries concurrently while keeping the spin endpoint as the authoritative source for quota and outcome.

**Tech Stack:** React 18, TypeScript, Vite/Vitest, Express, Supabase JS, Node test runner.

## Global Constraints

- Never trust cached `spinsRemaining` or cached reward assignment data to authorize a spin; `POST /api/v1/participant/spins` remains authoritative.
- Keep participant cache in memory only; do not persist phone numbers, session payloads, or reward data to local storage.
- Cache entries must be scoped to the current participant session token and discarded when the session is cleared or expires.
- Do not add a new dependency. Preserve existing `participantService` and `SlotMachine` public behavior.
- A wheel with no loaded segments must never show an apparently playable blank wheel.
- Existing preview and Zalo authentication flows must both reuse the same cache path.
- Preserve existing backend error handling and response JSON shape.

---

## Current Root Cause

`lucky-wheels/src/components/slot-machine.tsx` renders the wheel while `participant` is still `null`. That makes `segments=[]`, so the screenshot shows only the decorative gold shell and the disabled `QUAY` button.

The request is also duplicated. `POST /participant/sessions/preview` or `POST /participant/sessions/zalo` already builds and returns `wheelSegments`, but `RegisterForm` discards the payload after navigation and `SlotMachine` calls `GET /participant/me` again. Both backend paths execute the customer rewards, campaign, participant quota, spin-count, and active-catalog queries.

---

## File Map

- Modify: `lucky-wheels/src/services/participant.services.ts` — add session-scoped memory cache, in-flight request deduplication, cache update/invalidation methods, and cache writes for session creation responses.
- Create: `lucky-wheels/src/services/participant.services.test.ts` — test cache reuse, request deduplication, session scoping, and invalidation.
- Modify: `lucky-wheels/src/components/slot-machine.tsx` — add an explicit loading state, prevent blank-wheel rendering, and update the participant cache after a successful spin.
- Create: `lucky-wheels/src/services/wheel-load-state.ts` — pure state classifier used by the component and tests.
- Create: `lucky-wheels/src/services/wheel-load-state.test.ts` — test loading/ready/empty/error behavior without requiring a browser renderer.
- Modify: `backend/src/routes/public.routes.js` — parallelize independent participant-response queries and check every Supabase result for errors.
- Create: `backend/test/participant-response-performance.contract.test.js` — guard the query-concurrency contract and response-shape invariants.

---

### Task 1: Add participant response cache and request deduplication

**Files:**
- Modify: `lucky-wheels/src/services/participant.services.ts`
- Create: `lucky-wheels/src/services/participant.services.test.ts`

**Interfaces:**
- `participantService.startPreview(phone): Promise<Participant>` and `participantService.startWithZalo(...): Promise<Participant>` continue returning the same participant object and now populate the cache.
- `participantService.getCurrent(options?: { force?: boolean }): Promise<Participant | null>` returns the cached payload when it belongs to the current token and is still fresh; `force: true` bypasses the cache.
- Add `participantService.updateCached(patch: Partial<Participant>): void` for local quota updates after a committed spin.
- Add `participantService.clearCached(): void`; session-clear paths must call it.

- [ ] **Step 1: Write the failing cache tests**

Use mocked `apiRequest` and `participantSession` values. Cover these exact behaviors:

```ts
it("returns the session response without a second GET /participant/me", async () => {
  const created = await participantService.startPreview("0901234567");
  const current = await participantService.getCurrent();

  expect(current).toEqual(created);
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(apiRequest).toHaveBeenCalledWith("/participant/sessions/preview", expect.anything());
});

it("shares one in-flight GET when two callers arrive together", async () => {
  const first = participantService.getCurrent();
  const second = participantService.getCurrent();
  await Promise.all([first, second]);

  expect(apiRequest).toHaveBeenCalledTimes(1);
});

it("does not return a payload cached for a different session token", async () => {
  participantSession.getToken.mockReturnValueOnce("token-a").mockReturnValue("token-b");
  await participantService.startPreview("0901234567");
  await participantService.getCurrent();

  expect(apiRequest).toHaveBeenCalledWith("/participant/me", expect.anything());
});

it("clears cached participant data when a 401 clears the session", async () => {
  apiRequest.mockRejectedValueOnce(Object.assign(new Error("expired"), { status: 401 }));
  await expect(participantService.getCurrent({ force: true })).resolves.toBeNull();
  expect(participantService.getCached()).toBeNull();
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm --prefix lucky-wheels test -- src/services/participant.services.test.ts`

Expected: FAIL because the service has no cache, `force` option, or cache inspection/update API.

- [ ] **Step 3: Implement the minimal cache**

Add module state similar to:

```ts
const PARTICIPANT_CACHE_TTL_MS = 30_000;
let cached: { participant: Participant; token: string; cachedAt: number } | null = null;
let inFlight: Promise<Participant | null> | null = null;

function readFresh(token: string): Participant | null {
  if (!cached || cached.token !== token || Date.now() - cached.cachedAt > PARTICIPANT_CACHE_TTL_MS) {
    return null;
  }
  return cached.participant;
}
```

`saveResponse` must write the cache using the token saved for the response. `getCurrent` must return a fresh matching cache before making a request, return `inFlight` when present, and clear `inFlight` in a `finally` block. A 401 must clear both the session and cache. `updateCached` must merge only the supplied fields and refresh `cachedAt`; it must not issue a network request.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `npm --prefix lucky-wheels test -- src/services/participant.services.test.ts`

Expected: PASS for cache reuse, in-flight deduplication, token scoping, TTL behavior, and 401 invalidation.

- [ ] **Step 5: Commit the isolated service change**

```bash
git add lucky-wheels/src/services/participant.services.ts lucky-wheels/src/services/participant.services.test.ts
git commit -m "perf(mini-app): reuse participant session payload"
```

---

### Task 2: Replace the blank wheel with an explicit loading state

**Files:**
- Create: `lucky-wheels/src/services/wheel-load-state.ts`
- Create: `lucky-wheels/src/services/wheel-load-state.test.ts`
- Modify: `lucky-wheels/src/components/slot-machine.tsx`

**Interfaces:**
- `getWheelLoadState(input): "loading" | "ready" | "empty" | "error"` is a pure function. `input` contains `isLoading: boolean`, `participant: Participant | null`, `segmentCount: number`, and `error: string | null`.
- `SlotMachine` must not render the interactive wheel when the state is `loading`, `empty`, or `error`.

- [ ] **Step 1: Write the failing state-classifier tests**

```ts
it.each([
  [{ isLoading: true, participant: null, segmentCount: 0, error: null }, "loading"],
  [{ isLoading: false, participant: null, segmentCount: 0, error: "request failed" }, "error"],
  [{ isLoading: false, participant: null, segmentCount: 0, error: null }, "empty"],
  [{ isLoading: false, participant: { id: "c1" }, segmentCount: 2, error: null }, "ready"],
])("classifies wheel state", (input, expected) => {
  expect(getWheelLoadState(input as WheelLoadStateInput)).toBe(expected);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm --prefix lucky-wheels test -- src/services/wheel-load-state.test.ts`

Expected: FAIL because the classifier does not exist.

- [ ] **Step 3: Implement the loading/error UI**

Initialize `isLoadingParticipant` to `true`, set it to `false` in both the success and error paths of the existing `getCurrent` effect, and classify the state before calculating SVG slices. Render:

```tsx
if (wheelState === "loading") {
  return <div role="status" className="...">Đang tải phần thưởng...</div>;
}
if (wheelState === "error" || wheelState === "empty") {
  return <div role="alert" className="...">{spinError || "Chưa có dữ liệu vòng quay."}</div>;
}
```

The ready path is the only path allowed to render the wheel SVG and `QUAY` button. Keep retry behavior simple: the existing page reload/navigation can retry; do not add a second uncontrolled polling loop.

After `spinService.spin()` succeeds, update both local component state and `participantService.updateCached({ spinsRemaining: result.spinsRemaining })` so a return to the wheel does not show the old quota.

- [ ] **Step 4: Run all Mini App tests and build**

Run: `npm --prefix lucky-wheels test`

Run: `npm --prefix lucky-wheels run build`

Expected: all tests pass and Vite completes without TypeScript errors.

- [ ] **Step 5: Commit the UX change**

```bash
git add lucky-wheels/src/services/wheel-load-state.ts lucky-wheels/src/services/wheel-load-state.test.ts lucky-wheels/src/components/slot-machine.tsx
git commit -m "fix(mini-app): avoid rendering blank wheel while loading"
```

---

### Task 3: Parallelize backend participant-response queries

**Files:**
- Modify: `backend/src/routes/public.routes.js`
- Create: `backend/test/participant-response-performance.contract.test.js`

**Interfaces:**
- Keep `loadParticipantResponse(row, session)` and all route response fields unchanged.
- Keep `wheelSegments` construction and the active-campaign fallback semantics unchanged.
- Only query scheduling and error checks change.

- [ ] **Step 1: Write the failing backend contract test**

Read the route source and assert the implementation has a `Promise.all` for the independent catalog/count work and a second `Promise.all` for campaign participant and spin count work. Also assert the response still contains `spinsTotal`, `spinsRemaining`, and `wheelSegments`.

```js
test("participant response schedules independent database reads concurrently", async () => {
  const source = await readFile(routesPath, "utf8");
  assert.match(source, /const \[.*catalogResult.*countResult.*\] = await Promise\.all/s);
  assert.match(source, /const \[.*partResult.*campaignSpinCount.*\] = await Promise\.all/s);
  assert.match(source, /wheelSegments:/);
  assert.match(source, /spinsRemaining:/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm --prefix backend test -- test/participant-response-performance.contract.test.js`

Expected: FAIL because the current implementation awaits customer, participant, count, and catalog work serially.

- [ ] **Step 3: Implement concurrent scheduling**

After the active campaign is known, schedule the independent catalog query, campaign participant quota query, and campaign-scoped spin count query together. When there is no active campaign, schedule the all-time count query and use a resolved empty participant result. Check every returned `.error` before constructing the participant object.

The intended structure is:

```js
const [catalogResult, partResult, countResult] = await Promise.all([
  loadActiveRewardCatalog(),
  activeCampaign?.id ? loadCampaignParticipant(activeCampaign.id, row.id) : Promise.resolve({ data: null, error: null }),
  loadSpinCount(row.id, activeCampaign?.id),
]);
for (const result of [catalogResult, partResult, countResult]) {
  if (result.error) throw result.error;
}
```

Do not change the SQL filters, customer scope, campaign scope, or reward ordering while making this change.

- [ ] **Step 4: Run backend tests**

Run: `npm --prefix backend test`

Expected: PASS, including existing route and contract tests plus the new concurrency contract.

- [ ] **Step 5: Commit the backend change**

```bash
git add backend/src/routes/public.routes.js backend/test/participant-response-performance.contract.test.js
git commit -m "perf(api): parallelize participant wheel reads"
```

---

### Task 4: Verify the complete loading path and measure the improvement

**Files:**
- Modify: `docs/superpowers/plans/2026-08-17-wheel-data-loading-performance-plan.md` — record measured results and completion evidence only after implementation.

- [ ] **Step 1: Run the complete automated checks**

```bash
npm --prefix lucky-wheels test
npm --prefix lucky-wheels run build
npm --prefix backend test
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Exercise the preview flow locally**

Open the Mini App in preview mode, enter an allowed test phone, and capture the browser Network panel. Confirm:

- session creation returns `wheelSegments`;
- navigating to the wheel does not create a second `/participant/me` request while the cache is fresh;
- the first visible state is either the loading message or a populated wheel, never an empty gold shell;
- the `QUAY` button stays disabled until the ready state;
- a successful spin updates the displayed remaining-spin count;
- a hard refresh still loads through `/participant/me` and remains functional.

- [ ] **Step 3: Compare timing before and after**

Record the duration of the session request and time-to-first-populated-wheel. The target for this change is one participant data request per session navigation and no blank-wheel frame; the exact latency target depends on the local Supabase connection and must be recorded rather than assumed.

- [ ] **Step 4: Review the diff for safety**

Run `git diff HEAD~3..HEAD -- lucky-wheels backend` and confirm no secrets, phone data, or unrelated admin/migration changes were included. Check that pending unrelated working-tree edits remain untouched.

---

## Rollback Plan

If a cache bug appears, set `PARTICIPANT_CACHE_TTL_MS` to `0` temporarily or call `getCurrent({ force: true })` at the wheel boundary; this preserves the old network behavior while retaining the loading guard. If backend query scheduling causes an environment-specific Supabase issue, revert only the backend performance commit; the frontend loading and session-response cache changes remain independently safe.

## Self-Review

- Coverage: duplicate request removal, loading UX, backend query concurrency, quota correctness, tests, build, and manual network verification are all represented.
- Placeholder scan: no task depends on an unspecified file, endpoint, or “implement later” step.
- Type/contract consistency: `Participant` remains the existing response type; `getCurrent({ force?: boolean })`, `updateCached`, and `clearCached` are introduced in Task 1 and consumed only by Task 2.
