# Delivery Worker & Award-Backed ZNS Delivery (Phase 2C) Implementation Plan

> **Goal:** Upgrade delivery context loading to read directly from `public.awards`, synchronize award status to `delivered` upon successful sending, and protect delivery routes.

## Global Constraints

- Update `loadDeliveryContext` in `backend/src/delivery-service.js` to query `public.awards` first.
- Update `finishDelivery` to sync `public.awards` status to `delivered` when delivery succeeds.
- Keep delivery endpoints strictly authenticated and participant-scoped.
- Run tests and commit each task.

---

## Task 1: Update `loadDeliveryContext` and `finishDelivery` in `delivery-service.js`

**Files:**
- Modify: `backend/src/delivery-service.js`
- Modify: `backend/test/delivery-service.test.js`

**Step Checklist:**
- [ ] Update `loadDeliveryContext` to query `public.awards` by `spin_event_id` first.
- [ ] Update `finishDelivery` to set `awards.status = 'delivered'` and `awards.delivered_at = now()` when `status = 'sent'`.
- [ ] Add unit tests in `delivery-service.test.js` for award-backed context loading and award status update.
- [ ] Run `npm --prefix backend test` and confirm tests pass.
- [ ] Commit as `feat: load delivery context from awards table and sync delivery status`.

---

## Task 2: Create Phase 2C Integration Test and Verify

**Files:**
- Create: `backend/test/db/phase2c.integration.test.js`
- Modify: `backend/package.json`

**Step Checklist:**
- [ ] Create `phase2c.integration.test.js` asserting award-backed delivery context resolution and status transition.
- [ ] Add `phase2c.integration.test.js` to `test:db` in `backend/package.json`.
- [ ] Run full test suites (`npm --prefix backend test`, `npm --prefix lucky-wheels test -- --run`).
- [ ] Push to `origin/codex/participant-awards-api`.
