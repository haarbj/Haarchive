-- Part H follow-up: structured capture for the post-season review.
--
-- post-race.ts's own header was explicit that the first version was a
-- deliberate, named scope cut: the questionnaire goes into the message
-- thread as prose, the athlete's answers come back as prose replies, and
-- nothing aggregates them. It also noted the real consequence of
-- detecting "already sent" by searching the thread for the
-- questionnaire's own title line: renaming that title breaks recognition.
--
-- This adds the structured record that was deferred, without removing the
-- thread-prose delivery -- that stays the notification path (see
-- post-race-actions.ts's sendPostSeasonReview), but it is no longer the
-- source of truth for either the athlete's answers or whether a review
-- has been sent.
--
-- post_season_review_requests is the "a review was sent for this race"
-- record -- one row per send, scoped to the goal (race) it was sent for,
-- so "reviewSent" becomes "does a row exist for this athlete+race" instead
-- of a title-text search. Both coach_id and athlete_id are stored
-- directly (coach_estimate_reviews' own precedent) so RLS doesn't need a
-- second join back through coach_athletes for the common case, while
-- coaches_this_athlete() still gates the active-relationship requirement.
create table public.post_season_review_requests (
  id uuid primary key default gen_random_uuid(),
  coach_athlete_id uuid not null references public.coach_athletes (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  -- The race this review is about. Nullable only because goals rows can
  -- be deleted later and this history should outlive that -- every row
  -- this app creates sets it, since postRaceFlow has no notion of a
  -- review without a race.
  goal_id uuid references public.goals (id) on delete set null,
  -- The thread message carrying the prose delivery, kept for reference
  -- only -- nothing here depends on reading it back.
  message_id uuid references public.coach_athlete_messages (id) on delete set null,
  sent_at timestamptz not null default now(),
  -- Set once, by the athlete, when they submit. Null means sent but not
  -- yet answered -- a real, expected state, not an error.
  submitted_at timestamptz
);
create index idx_post_season_review_requests_athlete_goal
  on public.post_season_review_requests (athlete_id, goal_id);
create index idx_post_season_review_requests_coach_athlete
  on public.post_season_review_requests (coach_athlete_id);

-- post_season_review_answers: one row per question, pre-created by the
-- coach's send action from POST_SEASON_REVIEW_SECTIONS at send time. The
-- question text is snapshotted here rather than re-read from that source
-- at display time, so a later copy edit to the questionnaire can't
-- silently relabel an answer someone already gave.
create table public.post_season_review_answers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.post_season_review_requests (id) on delete cascade,
  section_heading text not null,
  question_index int not null check (question_index >= 0),
  question text not null,
  answer text not null default '',
  updated_at timestamptz not null default now(),
  unique (request_id, section_heading, question_index)
);
create index idx_post_season_review_answers_request
  on public.post_season_review_answers (request_id);

alter table public.post_season_review_requests enable row level security;
alter table public.post_season_review_answers enable row level security;

-- Requests: the coach who sent it has full access, same shape as
-- coach_estimate_reviews_all_coach. The athlete additionally gets their
-- own read access and a narrow ability to mark submitted_at (see the
-- column-level grant below, matching coach_athlete_messages' read_at
-- precedent) -- never the other columns.
create policy "post_season_review_requests_all_coach" on public.post_season_review_requests
  for all to authenticated
  using ((select auth.uid()) = coach_id and public.coaches_this_athlete(athlete_id))
  with check ((select auth.uid()) = coach_id and public.coaches_this_athlete(athlete_id));

create policy "post_season_review_requests_select_athlete" on public.post_season_review_requests
  for select to authenticated using ((select auth.uid()) = athlete_id);

create policy "post_season_review_requests_update_athlete" on public.post_season_review_requests
  for update to authenticated
  using ((select auth.uid()) = athlete_id)
  with check ((select auth.uid()) = athlete_id);

-- Same column-level-privilege reasoning as coach_athlete_messages'
-- read_at: the row-level USING/CHECK above constrains which ROW the
-- athlete can touch, never which COLUMN, so without this an athlete could
-- rewrite coach_id/athlete_id/goal_id on their own request row. The
-- athlete's own client only ever sets submitted_at (see
-- post-season-review actions).
revoke update on public.post_season_review_requests from authenticated;
grant update (submitted_at) on public.post_season_review_requests to authenticated;

-- Answers: both parties on the relationship can read; only the coach's
-- send action inserts (pre-populating every question as an empty answer);
-- only the athlete updates, and only the answer text itself.
create policy "post_season_review_answers_select_participant" on public.post_season_review_answers
  for select to authenticated using (
    exists (
      select 1 from public.post_season_review_requests r
      where r.id = request_id
        and ((select auth.uid()) = r.coach_id or (select auth.uid()) = r.athlete_id)
    )
  );

create policy "post_season_review_answers_insert_coach" on public.post_season_review_answers
  for insert to authenticated with check (
    exists (
      select 1 from public.post_season_review_requests r
      where r.id = request_id
        and (select auth.uid()) = r.coach_id
        and public.coaches_this_athlete(r.athlete_id)
    )
  );

create policy "post_season_review_answers_update_athlete" on public.post_season_review_answers
  for update to authenticated
  using (
    exists (
      select 1 from public.post_season_review_requests r
      where r.id = request_id and (select auth.uid()) = r.athlete_id
    )
  )
  with check (
    exists (
      select 1 from public.post_season_review_requests r
      where r.id = request_id and (select auth.uid()) = r.athlete_id
    )
  );

revoke update on public.post_season_review_answers from authenticated;
grant update (answer, updated_at) on public.post_season_review_answers to authenticated;
