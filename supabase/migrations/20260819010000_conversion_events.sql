-- Phase 12A (account-conversion foundation): write-only funnel measurement,
-- deliberately NOT a general analytics system and NOT the learning system.
-- Answers one product question -- "which public-facing features actually
-- convince a visitor to create an account" -- nothing more.
--
-- event_type is plain text with no check constraint, matching
-- learning_events' own precedent (the nearest analogous "event log" table
-- in this schema): the TypeScript union (ConversionEventType) is the real
-- source of truth for the allowed set, not a DB-level enum/check, the same
-- split already established for learning_events.event_type.
--
-- anon_id reuses the existing src/lib/anon-id.ts cookie identity (already
-- used for signed-out question/upvote attribution) -- not a second
-- anonymous-identity mechanism. user_id is null until a visitor signs in,
-- then set going forward; it is never backfilled onto earlier anonymous
-- rows in this phase (no user-facing feature needs that yet, and doing it
-- would mean a mutable, not append-only, table).
create table public.conversion_events (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null,
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  feature text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_conversion_events_anon_id on public.conversion_events (anon_id);
create index idx_conversion_events_user_id on public.conversion_events (user_id) where user_id is not null;
create index idx_conversion_events_event_type on public.conversion_events (event_type, created_at desc);

-- Idempotent first_learning_action: the write path (conversion-actions.ts)
-- always attempts this insert alongside a handful of already-authenticated
-- learning actions (answering a knowledge check, saving a bookmark, taking
-- a note) rather than doing a read-then-write check first -- this
-- constraint is what makes every attempt after the first a harmless no-op,
-- the same idempotency-via-partial-unique-index pattern learning_events'
-- own migration already uses for content_viewed/tool_used.
create unique index idx_conversion_events_first_learning_action_once
  on public.conversion_events (user_id, event_type)
  where event_type = 'first_learning_action' and user_id is not null;

alter table public.conversion_events enable row level security;

-- Insert-only, by design, for both signed-out and signed-in visitors --
-- this table exists to be written to before an account exists. No select/
-- update/delete policy for anon or authenticated at all: conversion data
-- must not become readable to normal users (a visitor should never be able
-- to query how many people saw or clicked a given CTA), only to the
-- service-role client for internal analysis later, which bypasses RLS
-- entirely and needs no policy of its own. Same shape as knowledge_checks'
-- "zero policies for the roles that shouldn't see it," inverted: there the
-- protected direction was reads, here it's everything except inserts.
--
-- The check clause is the one piece of real enforcement: a signed-in
-- visitor may only ever insert a row attributed to their own auth.uid()
-- (or to no one, user_id null) -- never to a different real user_id. This
-- is defense in depth, not the only guard -- every actual write in this
-- app goes through a server action that already derives user_id from the
-- session itself (see conversion-actions.ts), never from client input.
create policy "conversion_events_insert_any" on public.conversion_events
  for insert to public
  with check (user_id is null or user_id = (select auth.uid()));
