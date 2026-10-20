-- Plan Realignment: when an athlete misses training, the system drafts a
-- revised set of the coming week's workouts (move/shorten/drop) and the
-- coach reviews/edits/approves before anything on scheduled_workouts
-- actually changes. This table is the whole lifecycle of one such
-- proposal -- the disruption that triggered it, the computed proposal
-- itself (the pure rules engine's output, see
-- src/lib/private-coaching/plan-realignment.ts), and the coach's eventual
-- decision -- so a dismissed proposal can be recognized again (never
-- regenerated identically) and an accepted one stays readable afterward
-- as the audit trail of what changed and why.
--
-- The proposal is computed once, at creation time, from whichever trigger
-- fired (see triggered_by) and stored as-is in `proposal` (jsonb) --
-- re-reading it later (to show the coach, or to look back at an accepted
-- one) never re-runs the engine, so a later change to the plan can't
-- retroactively alter what a past proposal says it proposed.
create table public.realignment_proposals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  -- Either trigger in the task's own spec: the athlete flagging their own
  -- disruption, or the coach initiating one from the athlete's schedule.
  triggered_by text not null check (triggered_by in ('athlete', 'coach')),
  triggered_by_user_id uuid not null references public.profiles (id),
  disruption_start_date date not null,
  disruption_end_date date not null,
  disruption_note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  -- A deterministic digest of (athleteId, disruption window, the
  -- horizon's own planned workouts) -- see
  -- plan-realignment.ts#fingerprintRealignmentInput. Lets a repeat
  -- trigger over the exact same disruption+plan recognize an existing
  -- dismissed proposal instead of silently regenerating an identical one,
  -- the behavior the task's own consent-flow requirement asks for.
  fingerprint text not null,
  -- The full RealignmentProposal object the engine returned -- every
  -- entry's original/proposed values and the rule-tied reason for each
  -- change, exactly as shown to the coach. This IS the audit trail once
  -- status moves to 'accepted' or 'dismissed'.
  proposal jsonb not null,
  decided_at timestamptz,
  decided_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index idx_realignment_proposals_athlete_id on public.realignment_proposals (athlete_id);
create index idx_realignment_proposals_coach_id on public.realignment_proposals (coach_id);
create index idx_realignment_proposals_fingerprint on public.realignment_proposals (athlete_id, fingerprint);

alter table public.realignment_proposals enable row level security;

-- Coach: full CRUD on proposals for athletes currently on their own
-- roster -- the same coach_id = auth.uid() and coaches_this_athlete(...)
-- shape scheduled_workouts/training_phases/training_groups already use,
-- so access is revoked the instant the coaching relationship ends, not
-- just at creation time.
create policy "realignment_proposals_all_as_coach" on public.realignment_proposals
  for all to authenticated
  using (coach_id = (select auth.uid()) and public.coaches_this_athlete(athlete_id))
  with check (coach_id = (select auth.uid()) and public.coaches_this_athlete(athlete_id));

-- Athlete: can flag their own disruption (insert) and read their own
-- history, but never decide one themselves -- accept/dismiss is the
-- coach's call alone, so no athlete update/delete policy exists at all.
-- The insert check requires a real, currently-active coaching
-- relationship with the coach_id named in the row, the same
-- authorization shape coach_athlete_invites' redemption path already
-- requires before trusting a submitted coach_id.
create policy "realignment_proposals_select_as_athlete" on public.realignment_proposals
  for select to authenticated
  using (athlete_id = (select auth.uid()));

create policy "realignment_proposals_insert_as_athlete" on public.realignment_proposals
  for insert to authenticated
  with check (
    athlete_id = (select auth.uid())
    and triggered_by = 'athlete'
    and triggered_by_user_id = (select auth.uid())
    and exists (
      select 1 from public.coach_athletes ca
      where ca.athlete_id = realignment_proposals.athlete_id
        and ca.coach_id = realignment_proposals.coach_id
        and ca.status = 'active'
    )
  );
