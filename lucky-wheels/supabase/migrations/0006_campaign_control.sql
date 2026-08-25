-- Phase 2D: campaign control lifecycle and single-active invariant.
-- Existing data and callers are preserved; at most one campaign can be active at a time.

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'active', 'paused', 'ended', 'archived'));

create unique index if not exists campaigns_one_active_idx
  on public.campaigns ((status))
  where status = 'active';

create or replace function public.transition_campaign(
  p_campaign_id uuid,
  p_status text
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_current_status text;
begin
  if p_status not in ('draft', 'active', 'paused', 'ended', 'archived') then
    raise exception using errcode = '22023', message = 'invalid campaign status';
  end if;

  select * into v_campaign
  from public.campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'campaign not found';
  end if;

  v_current_status := v_campaign.status;

  if v_current_status = p_status then
    return v_campaign;
  end if;

  -- Validate transition matrix
  if v_current_status = 'archived' then
    raise exception using errcode = '22023', message = 'archived campaign cannot change status';
  end if;

  if p_status = 'active' then
    if v_current_status not in ('draft', 'paused') then
      raise exception using errcode = '22023', message = 'invalid status transition to active';
    end if;
    if exists (
      select 1 from public.campaigns
      where status = 'active' and id <> p_campaign_id
    ) then
      raise exception using errcode = 'P0004', message = 'another campaign is currently active';
    end if;
  elsif p_status = 'paused' then
    if v_current_status <> 'active' then
      raise exception using errcode = '22023', message = 'only active campaign can be paused';
    end if;
  elsif p_status = 'ended' then
    if v_current_status not in ('active', 'paused') then
      raise exception using errcode = '22023', message = 'only active or paused campaign can be ended';
    end if;
  elsif p_status = 'archived' then
    if v_current_status not in ('draft', 'paused', 'ended') then
      raise exception using errcode = '22023', message = 'invalid status transition to archived';
    end if;
  end if;

  update public.campaigns
  set status = p_status,
      updated_at = now()
  where id = p_campaign_id
  returning * into v_campaign;

  return v_campaign;
end;
$$;

revoke all on function public.transition_campaign(uuid, text) from public, anon, authenticated;
grant execute on function public.transition_campaign(uuid, text) to service_role;
