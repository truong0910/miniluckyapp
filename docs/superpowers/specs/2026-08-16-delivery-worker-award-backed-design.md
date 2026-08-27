# Delivery Worker & Award-Backed ZNS Delivery (Phase 2C) Design

**Date:** 2026-08-16  
**Status:** Approved; ready for implementation

## Goal

Ensure ZNS delivery notifications load award recipient details directly from the immutable `public.awards` snapshot (with fallback for legacy records), sync award lifecycle status (`issued` -> `delivering` -> `delivered`), and keep public delivery endpoints strictly participant-authenticated and anti-spam protected.

## Scope

### In scope

- Update `loadDeliveryContext` in `backend/src/delivery-service.js` to query `public.awards` by `spin_event_id` first before falling back to legacy tables.
- Update `finishDelivery` or delivery worker lifecycle to sync award status from `issued` to `delivered` (and setting `delivered_at = now()`) on successful ZNS sending.
- Verify participant scoping on `POST /delivery/zbs` and admin auth on `GET /delivery/zbs/templates`.
- Unit and integration tests for award-backed context resolution and status sync.

### Out of scope

- Direct browser-based ZNS template execution.
- External ZBS provider API mock changes.

## Data Flow & Lifecycle

1. `runDeliveryWorker` claims a batch of pending deliveries (`claimDeliveryBatch`).
2. For each delivery, `processDelivery` calls `sendDelivery({ db, delivery, config, fetchImpl })`.
3. `loadDeliveryContext` queries `public.awards` for `spin_event_id = delivery.spin_event_id`.
   - If found, uses `award.code`, `award.title_snapshot`, `award.value_snapshot`, `award.description_snapshot`.
   - If not found, falls back to `spin_events` + `customer_rewards` / `reward_catalog`.
4. `sendDelivery` sends the normalized phone number and template data to ZBS with `X-Idempotency-Key: delivery.id`.
5. Upon successful response:
   - `finishDelivery` updates `deliveries.status = 'sent'`.
   - `awards.status` is updated to `'delivered'` with `delivered_at = now()`.

## Verification

- `backend/test/delivery-service.test.js`: Unit tests for award-backed context loading and award delivery status update.
- `backend/test/db/phase2c.integration.test.js`: Integration tests for migration and delivery lifecycle.
