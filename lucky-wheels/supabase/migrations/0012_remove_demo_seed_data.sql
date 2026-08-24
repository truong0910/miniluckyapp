-- Migration 0012: remove the original demo customers without touching history.
--
-- 0001 is already part of the migration history and must not be edited in place.
-- This repair migration removes only the known demo IDs when they have never
-- participated. If a demo row has historical activity, it is retained and
-- hidden with deleted_at so spin/award/delivery history remains auditable.

do $$
begin
  create temporary table demo_seed_customers (
    id text primary key
  ) on commit drop;

  insert into demo_seed_customers (id)
  values ('KH001'), ('KH002'), ('KH003');

  -- Remove unused pre-assigned vouchers first. Historical vouchers remain
  -- available for legacy fallback delivery and audit.
  delete from public.customer_rewards customer_reward
  using demo_seed_customers demo_customer
  where customer_reward.customer_id = demo_customer.id
    and not exists (
      select 1
      from public.spin_events spin_event
      where spin_event.customer_id = customer_reward.customer_id
        and spin_event.reward_code = customer_reward.code
    )
    and not exists (
      select 1
      from public.awards award
      where award.customer_id = customer_reward.customer_id
        and award.code = customer_reward.code
    );

  -- Remove campaign/group allocations only when no spin exists for that
  -- customer/campaign. This keeps historical campaign scope intact.
  delete from public.campaign_participants campaign_participant
  using demo_seed_customers demo_customer
  where campaign_participant.customer_id = demo_customer.id
    and not exists (
      select 1
      from public.spin_events spin_event
      where spin_event.customer_id = campaign_participant.customer_id
        and spin_event.campaign_id = campaign_participant.campaign_id
    );

  delete from public.customer_group_members group_member
  using demo_seed_customers demo_customer
  where group_member.customer_id = demo_customer.id
    and not exists (
      select 1
      from public.spin_events spin_event
      where spin_event.customer_id = group_member.customer_id
    );

  delete from public.customer_rule_assignments rule_assignment
  using demo_seed_customers demo_customer
  where rule_assignment.customer_id = demo_customer.id
    and not exists (
      select 1
      from public.spin_events spin_event
      where spin_event.customer_id = rule_assignment.customer_id
    );

  -- Keep referenced demo customers for audit/history, but hide them from new
  -- participant lookup and public enrollment.
  update public.customers customer
  set deleted_at = coalesce(customer.deleted_at, now())
  from demo_seed_customers demo_customer
  where customer.id = demo_customer.id
    and (
      exists (select 1 from public.spin_events where customer_id = customer.id)
      or exists (select 1 from public.awards where customer_id = customer.id)
      or exists (select 1 from public.deliveries where customer_id = customer.id)
    );

  -- Delete only customers with no historical spin, award, or delivery rows.
  -- The customer_rewards rows that remain for these customers cascade safely.
  delete from public.customers customer
  using demo_seed_customers demo_customer
  where customer.id = demo_customer.id
    and not exists (select 1 from public.spin_events where customer_id = customer.id)
    and not exists (select 1 from public.awards where customer_id = customer.id)
    and not exists (select 1 from public.deliveries where customer_id = customer.id);
end;
$$;
