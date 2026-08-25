-- Phase 2E: campaign participants and campaign-scoped quota allocations.
-- Preserves all legacy customer records and historical spin_events.

create table if not exists public.campaign_participants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  customer_id text not null references public.customers(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'paused', 'removed')),
  spin_quota integer not null default 0 check (spin_quota >= 0),
  imported_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

-- Index for efficient customer lookups by campaign
create index if not exists idx_campaign_participants_campaign_id
  on public.campaign_participants (campaign_id);

revoke all on public.campaign_participants from public, anon, authenticated;
grant all on public.campaign_participants to service_role;
