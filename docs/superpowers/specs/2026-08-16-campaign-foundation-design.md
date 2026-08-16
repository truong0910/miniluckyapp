# Campaign Foundation (Phase 2A) Design

**Date:** 2026-08-16  
**Status:** Approved scope; implementation pending

## Goal

Introduce a first-class `campaigns` entity and attach the existing rule, assigned-reward, and spin-event records to a campaign without changing current spin behavior or requiring Zalo permission.

## Scope

This slice creates the campaign boundary and preserves the existing application contract through a deterministic `legacy` campaign.

### In scope

- Add `public.campaigns` with a stable code, display name, lifecycle status, and optional validity window.
- Seed a fixed-id `legacy` campaign for all data created before campaign-aware APIs exist.
- Add a non-null `campaign_id` foreign key with a legacy default to:
  - `campaign_rules` (rules and their spin inventory inherit campaign through the rule).
  - `customer_rewards` (pre-assigned voucher/participant reward records).
  - `spin_events` (immutable spin history).
- Backfill all existing rows to `legacy` before enforcing the foreign keys.
- Add campaign indexes, timestamp maintenance, and RLS policies consistent with existing admin/public access.
- Add migration-contract coverage and an opt-in Supabase integration assertion that a fixture reward and resulting spin event use `legacy` by default.

### Out of scope

- Changing `spin_once` selection, inventory decrement, idempotency, or delivery behavior.
- Adding campaign CRUD routes or Admin UI fields.
- Creating the separate `awards`/`vouchers` domain or a campaign participant-allocation table.
- Removing the existing `customers.total_spins` model.
- Requiring Zalo credentials or deploying any environment.

## Data model

```sql
campaigns (
  id uuid primary key,
  code text unique not null,
  name text not null,
  status text not null check (status in ('draft', 'active', 'paused', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

The compatibility row uses id `00000000-0000-0000-0000-000000000001`, code `legacy`, and status `active`. Using a fixed id lets existing inserts that omit `campaign_id` continue to work through a database default while still enforcing a foreign key.

Each attached table gets:

```sql
campaign_id uuid not null default '00000000-0000-0000-0000-000000000001'
  references public.campaigns(id) on delete restrict
```

The migration first adds the column, updates nulls to the legacy id, then applies the default and `not null` constraint. It is idempotent so a test project can safely re-run the migration setup.

## Data flow and compatibility

Existing backend and RPC callers do not send `campaign_id` in this slice. PostgreSQL supplies the legacy default, so current Admin API inserts, `spin_once` inserts, fixture setup, and delivery lookups retain their existing behavior. Future campaign-aware routes can provide an explicit campaign id and then add campaign filtering in a separate slice.

`rule_spin_configs` and `rule_spin_rewards` do not receive duplicate campaign columns because they are owned by `campaign_rules`; `deliveries` remains owned by `spin_events` and therefore inherits campaign context through its foreign key.

## Access control

- Anonymous/authenticated clients can read only active campaigns.
- Admins can manage all campaign rows through the existing `is_admin()` policy.
- Service-role backend operations remain able to read and write all rows.

## Testing strategy

1. Add a migration contract test that checks the campaigns table, fixed legacy seed, attached columns, foreign-key declarations, and backfill/default statements.
2. Extend the opt-in Supabase DB integration test to insert a fixture without `campaign_id`, execute `spin_once`, and assert both the fixture reward and resulting `spin_events` row point to `legacy`.
3. Run the focused DB contract test, the opt-in DB integration test when test credentials are configured, the full backend suite, and `git diff --check`.

## Rollback boundary

The migration is additive except for enforcing campaign ownership on three existing tables. If a rollback is needed before any campaign-aware data is created, remove the three foreign-key columns and the campaigns table in a new down migration; do not edit an already-applied migration in place.
