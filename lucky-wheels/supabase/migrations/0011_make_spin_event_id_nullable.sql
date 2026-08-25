-- Migration 0010: Make spin_event_id nullable on public.awards to support manual admin awards
ALTER TABLE public.awards ALTER COLUMN spin_event_id DROP NOT NULL;
