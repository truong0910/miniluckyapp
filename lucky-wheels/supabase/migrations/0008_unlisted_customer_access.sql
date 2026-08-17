-- Migration 0008: Unlisted Customer Access Policy & Registration Source

alter table public.campaigns
  add column if not exists allow_unlisted boolean not null default false,
  add column if not exists unlisted_spin_quota integer not null default 1;

alter table public.campaigns
  drop constraint if exists campaigns_unlisted_spin_quota_check;

alter table public.campaigns
  add constraint campaigns_unlisted_spin_quota_check
  check (unlisted_spin_quota >= 0);

alter table public.campaign_participants
  add column if not exists registration_source text not null default 'admin';

alter table public.campaign_participants
  drop constraint if exists campaign_participants_registration_source_check;

alter table public.campaign_participants
  add constraint campaign_participants_registration_source_check
  check (registration_source in ('import', 'zalo_guest', 'admin'));

-- Expand campaign_rules.scope check constraint to support 'guest'
alter table public.campaign_rules
  drop constraint if exists campaign_rules_scope_check;

alter table public.campaign_rules
  add constraint campaign_rules_scope_check
  check (scope in ('default', 'group', 'user', 'guest'));

