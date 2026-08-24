-- Migration 0014: Add note column to campaign_participants for separating event group and note
alter table public.campaign_participants
  add column if not exists note text;
