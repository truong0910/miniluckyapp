# Award Creation in Spin Once RPC (Phase 2B.4) Design

**Date:** 2026-08-16  
**Status:** Approved; ready for implementation

## Goal

Ensure that every winning spin processed by `spin_once` atomically creates a durable, immutable `public.awards` snapshot record in the same Postgres transaction, guaranteeing that rewards won by participants are instantly available in the awards table and accessible via `GET /api/v1/participant/me/awards`.

## Scope

### In scope

- Create migration `0005_award_creation_spin_once.sql` updating `public.spin_once`.
- Within `spin_once`, when `v_outcome = 'reward'`, insert a new row into `public.awards` containing `campaign_id`, `spin_event_id`, `customer_id`, `reward_id`, `code`, `title_snapshot`, `value_snapshot`, `description_snapshot`, `result`, and `status = 'issued'`.
- Use `on conflict (spin_event_id) do nothing` for idempotency safety.
- Unit/contract tests verifying migration contents and `spin_once` integration.

### Out of scope

- Changing Mini App UI or API route parameters.
- Changing `claim_deliveries` or delivery workers.
- Expiry or redemption logic for awards.

## Data Flow & Mechanics

When `spin_once(p_customer_id, p_idempotency_key)` determines `v_outcome = 'reward'`:
1. It resolves `v_campaign_id = coalesce(v_rule.campaign_id, v_assignment.campaign_id, '00000000-0000-0000-0000-000000000001'::uuid)`.
2. It inserts into `public.spin_events`.
3. It inserts into `public.awards`:
   - `campaign_id` = `v_campaign_id`
   - `spin_event_id` = `v_event_id`
   - `customer_id` = `p_customer_id`
   - `reward_id` = `v_reward_id`
   - `code` = `v_reward_code`
   - `title_snapshot` = `v_reward_json ->> 'title'`
   - `value_snapshot` = `(v_reward_json ->> 'value')::bigint`
   - `description_snapshot` = `coalesce(v_reward_json ->> 'description', '')`
   - `result` = `v_result`
   - `status` = `'issued'`
   - `issued_at` = `v_created_at`
4. It inserts into `public.deliveries`.
5. It returns `v_response`.

If retried with the same `p_idempotency_key`, `spin_once` returns `v_existing_response` without creating a second award or spin event.

## Verification

- Migration file contract test in `backend/test/db/phase2b4.integration.test.js`.
- Opt-in DB integration test executing `spin_once` and asserting that a matching `public.awards` row is created.
