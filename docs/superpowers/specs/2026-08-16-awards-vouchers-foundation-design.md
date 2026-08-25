# Awards/Vouchers Foundation (Phase 2B.1) Design

**Date:** 2026-08-16  
**Status:** Approved scope; implementation pending

## Goal

Create a durable `awards` entity that represents a voucher actually issued by a winning spin, stores immutable reward snapshots, and preserves the campaign context established in Phase 2A.

## Scope

### In scope

- Add `public.awards` after the campaign foundation migration.
- Link each award to exactly one `campaign`, `spin_event`, and `customer`.
- Store immutable snapshots of voucher code, title, value, description, wheel result, and reward catalog id.
- Add a lifecycle status with the values `issued`, `delivering`, `delivered`, `redeemed`, `expired`, and `void`.
- Backfill existing reward spin events when their reward snapshot can be resolved from `customer_rewards` or `reward_catalog`.
- Add indexes, timestamp maintenance, RLS, and admin-only browser access consistent with the existing service-role backend model.
- Add migration contract coverage and opt-in test-project checks.

### Out of scope

- Changing `spin_once` to create new awards during a spin.
- Changing delivery worker claims, provider calls, or delivery status transitions.
- Adding participant award API routes or changing the Mini App voucher page.
- Adding Admin UI screens or award redemption workflows.
- Replacing `customer_rewards`; it remains the pre-assigned reward/eligibility source until Phase 2B.2.

## Data model

```sql
awards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  spin_event_id uuid not null unique references public.spin_events(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  reward_id text references public.reward_catalog(id) on delete set null,
  code text not null,
  title_snapshot text not null,
  value_snapshot bigint not null check (value_snapshot > 0),
  description_snapshot text not null default '',
  result jsonb not null default '["star", "star", "star"]'::jsonb,
  status text not null default 'issued'
    check (status in ('issued', 'delivering', 'delivered', 'redeemed', 'expired', 'void')),
  issued_at timestamptz not null default now(),
  delivered_at timestamptz,
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

`spin_event_id` is the idempotent ownership boundary: at most one award can represent a winning spin. The snapshots are deliberately copied into the award so later catalog edits cannot rewrite a voucher already issued to a customer.

## Backfill rules

The migration considers only `spin_events` with `outcome = 'reward'` and a non-empty `reward_code`. For each event, it resolves the snapshot in this order:

1. `customer_rewards` matching `(customer_id, reward_code)`.
2. `reward_catalog` matching `spin_events.reward_id`.

Rows with neither source are left untouched for compatibility and remain visible through the existing spin-event history; they are not fabricated into incomplete awards. Resolvable rows are inserted with:

- `campaign_id` from `spin_events.campaign_id`.
- `status = 'issued'`.
- `issued_at = spin_events.created_at`.
- `result` from the assigned reward when available, otherwise the standard three-star fallback.
- `on conflict (spin_event_id) do nothing` for safe re-runs.

## Access control

- Enable RLS on `awards`.
- Do not expose awards to `anon` or ordinary `authenticated` clients.
- Allow existing admins to manage awards through `public.is_admin()`.
- The backend service role remains the only participant-facing reader until Phase 2B.3 adds a scoped participant API.

## Compatibility

This migration is additive. It does not change `spin_once`, `deliveries`, `customer_rewards`, or any API response. Existing delivery code continues to use its current lookup path until the explicit Phase 2B.2 cutover.

## Testing strategy

1. Static migration contract test checks the table, lifecycle constraint, snapshot fields, backfill query, conflict guard, indexes, trigger, and RLS declarations.
2. Opt-in Supabase test-project checks verify the table exists, the legacy campaign foreign key is present, and any resolvable reward spin event has exactly one award with matching `spin_event_id`, code, value, and `issued` status.
3. Run the full backend suite, DB integration suite, Mini App tests, and `git diff --check` without requiring Zalo credentials.

## Rollback boundary

Do not edit the applied migration. If rollback is required before Phase 2B.2, create a new down migration that deletes only backfilled awards and then drops `awards`; never delete `spin_events`, `customer_rewards`, or `campaigns` as part of this slice.
