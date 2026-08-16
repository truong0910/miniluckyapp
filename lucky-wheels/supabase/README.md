# Supabase schema

Run `migrations/0001_lucky_wheels.sql` in the Supabase SQL Editor first.

The Backend (`../backend/`) is the only application component that connects
to Supabase, using the service role key. The Mini App and Admin Web call the
Backend API instead of connecting directly.

## Phase 1 migration

Apply `migrations/0002_phase1_production_safety.sql` after
`0001_lucky_wheels.sql`. The migration is additive: it keeps existing
customers, rewards, rules, and spin events. It adds participant sessions,
the delivery outbox, idempotent `spin_once`, and claim/finish functions for
the separate delivery worker.

Run `tests/phase1_spin.sql` only in an isolated Supabase test project. The
Backend integration test is opt-in and requires
`SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY`; it never reads the
local app `.env`.

## Phase 2A migration

Apply `migrations/0003_campaign_foundation.sql` after the Phase 1 migration
in the isolated Supabase test project first. It creates the `campaigns`
foundation, assigns existing data to the active `legacy` campaign, and keeps
current spin/API behavior compatible through a database default. Re-running
the migration is safe; do not apply it to the production project until the
campaign-aware Admin/API slices are completed.

After the base migration, create an Auth user and add its UUID to
`public.admin_profiles`; see `SUPABASE_ADMIN_SETUP.md`.

## Phase 2D migration (Campaign Control)

Apply `migrations/0006_campaign_control.sql` after `0005_award_creation_spin_once.sql`.
The migration is additive: it extends `campaigns.status` to support `'draft'`, `'active'`, `'paused'`, `'ended'`, and `'archived'`, enforces a single-active unique index constraint in the database, and adds `transition_campaign(uuid, text)` RPC function. Re-running the migration is safe; do not use it to delete or reset historical production data.

## Phase 2E migration (Campaign Reuse & Participants)

Apply `migrations/0007_campaign_participants.sql` after `0006_campaign_control.sql`.
The migration is additive: it adds `public.campaign_participants` for campaign-scoped spin quota allocations, imported group metadata, and customer membership. Re-running the migration is safe.

## Phase 4 (Reporting & Sync)

The Google Sheets sync payload (`buildGoogleSheetsPayload`) is enriched with `campaignId` and `campaignName` top-level fields while keeping existing spin and award columns backward compatible with Apps Script `doPost` handlers.
