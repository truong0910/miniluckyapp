-- Phase 2A: introduce campaign ownership without changing current spin behavior.
-- Existing data and callers are assigned to the deterministic legacy campaign.

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

insert into public.campaigns (id, code, name, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'legacy',
  'Legacy campaign',
  'active'
)
on conflict (id) do update
set code = excluded.code,
    name = excluded.name,
    status = excluded.status;

alter table public.campaign_rules add column if not exists campaign_id uuid;
update public.campaign_rules
set campaign_id = '00000000-0000-0000-0000-000000000001'
where campaign_id is null;
alter table public.campaign_rules
  alter column campaign_id set default '00000000-0000-0000-0000-000000000001',
  alter column campaign_id set not null;

alter table public.customer_rewards add column if not exists campaign_id uuid;
update public.customer_rewards
set campaign_id = '00000000-0000-0000-0000-000000000001'
where campaign_id is null;
alter table public.customer_rewards
  alter column campaign_id set default '00000000-0000-0000-0000-000000000001',
  alter column campaign_id set not null;

alter table public.spin_events add column if not exists campaign_id uuid;
update public.spin_events
set campaign_id = '00000000-0000-0000-0000-000000000001'
where campaign_id is null;
alter table public.spin_events
  alter column campaign_id set default '00000000-0000-0000-0000-000000000001',
  alter column campaign_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campaign_rules_campaign_id_fkey'
      and conrelid = 'public.campaign_rules'::regclass
  ) then
    alter table public.campaign_rules
      add constraint campaign_rules_campaign_id_fkey
      foreign key (campaign_id) references public.campaigns(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_rewards_campaign_id_fkey'
      and conrelid = 'public.customer_rewards'::regclass
  ) then
    alter table public.customer_rewards
      add constraint customer_rewards_campaign_id_fkey
      foreign key (campaign_id) references public.campaigns(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'spin_events_campaign_id_fkey'
      and conrelid = 'public.spin_events'::regclass
  ) then
    alter table public.spin_events
      add constraint spin_events_campaign_id_fkey
      foreign key (campaign_id) references public.campaigns(id) on delete restrict;
  end if;
end;
$$;

create index if not exists campaigns_status_window_idx
  on public.campaigns (status, starts_at, ends_at);
create index if not exists campaign_rules_campaign_idx
  on public.campaign_rules (campaign_id, active, priority desc);
create index if not exists customer_rewards_campaign_idx
  on public.customer_rewards (campaign_id, customer_id, created_at);
create index if not exists spin_events_campaign_idx
  on public.spin_events (campaign_id, created_at desc);

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;

drop policy if exists "public can read active campaigns" on public.campaigns;
create policy "public can read active campaigns"
on public.campaigns for select to anon, authenticated
using (status = 'active' or public.is_admin());

drop policy if exists "admins manage campaigns" on public.campaigns;
create policy "admins manage campaigns"
on public.campaigns for all to authenticated
using (public.is_admin())
with check (public.is_admin());
