-- Phase 2G: retain the operator reason for irreversible award status actions.
-- Additive only: existing awards and historical snapshots remain unchanged.

alter table public.awards
  add column if not exists status_reason text;
