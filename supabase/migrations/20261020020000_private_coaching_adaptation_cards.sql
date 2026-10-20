-- Consent-based adaptation cards: a deterministic signal engine
-- (src/lib/private-coaching/adaptation-signals.ts) watches each athlete's
-- recent training and, when a stated threshold fires, generates a card
-- for the coach showing the evidence and one concrete proposed action.
-- Nothing changes until the coach Accepts -- this table is the whole
-- lifecycle (what fired, what was proposed, what the coach chose),
-- mirroring realignment_proposals' own shape (see
-- 20261020010000_private_coaching_realignment_proposals.sql) for the same
-- propose/decide/audit reasons.
--
-- Unlike realignment_proposals, these cards are coach-only: an athlete
-- never sees the signal that fired or the evidence behind it, only
-- whatever the coach decides to actually change (a draft they later
-- publish, or a check-in request). So there is no athlete-facing SELECT/
-- INSERT policy at all here -- RLS grants the coach full CRUD and nothing
-- else, full stop.
create table public.adaptation_cards (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  signal text not null check (signal in ('fitness_up', 'fatigue_accumulating', 'plan_too_low', 'going_quiet')),
  -- A deterministic digest of (athleteId, signal, the evidence that fired
  -- it) -- see adaptation-signals.ts#fingerprintAdaptationCard. Unlike
  -- realignment_proposals' permanent fingerprint suppression, a dismissed
  -- card's fingerprint only suppresses regeneration for 14 days from
  -- decided_at (see adaptation-cards-service.ts) -- after that, even
  -- identical evidence may re-fire, since 14-day-old evidence about a
  -- training pattern is stale in a way a realignment disruption window
  -- never is.
  fingerprint text not null,
  -- The literal firing workouts/figures shown on the card, exactly as
  -- evaluated -- e.g. "Oct 12 Easy: prescribed RPE 6, logged 3". Snapshotted
  -- at creation time so a later change to those workouts can't
  -- retroactively alter what a past card said it saw.
  evidence jsonb not null,
  -- The concrete proposed action -- shape varies by signal (see
  -- AdaptationSignalResult["action"] in adaptation-signals.ts).
  action jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index idx_adaptation_cards_athlete_id on public.adaptation_cards (athlete_id);
create index idx_adaptation_cards_coach_id on public.adaptation_cards (coach_id);
create index idx_adaptation_cards_fingerprint on public.adaptation_cards (athlete_id, signal, fingerprint);
-- "One card per (athlete, signal) at a time -- never a stack of
-- duplicates" enforced at the database, not just in application logic:
-- at most one pending row can exist for a given (athlete, signal) pair.
create unique index idx_adaptation_cards_one_pending_per_signal
  on public.adaptation_cards (athlete_id, signal)
  where (status = 'pending');

alter table public.adaptation_cards enable row level security;

-- Coach: full CRUD on cards for athletes currently on their own roster --
-- the same coach_id = auth.uid() and coaches_this_athlete(...) shape
-- realignment_proposals/scheduled_workouts/training_phases already use.
-- No athlete-facing policy exists at all: cards are coach-only, by design
-- (see this table's own header comment), so an athlete querying this
-- table gets zero rows regardless of which athlete_id they are.
create policy "adaptation_cards_all_as_coach" on public.adaptation_cards
  for all to authenticated
  using (coach_id = (select auth.uid()) and public.coaches_this_athlete(athlete_id))
  with check (coach_id = (select auth.uid()) and public.coaches_this_athlete(athlete_id));
