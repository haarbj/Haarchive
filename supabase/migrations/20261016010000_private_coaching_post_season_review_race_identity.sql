-- Part H follow-up: a post-season review request carries its own race
-- identity now, rather than only being reachable through a goal row.
--
-- The gap this closes: sendPostSeasonReview required a goal race (its
-- request row's goal_id came from getAthleteGoalRace), and the post-race
-- panel that's the only way to reach it only renders once a goal date has
-- passed. A newly onboarded athlete who raced recently without this
-- coach's involvement has no goal race in the system at all, so the
-- review could never be sent to them -- not a bug in either of those two
-- things individually, just a real gap in what they cover together.
--
-- goal_id was already nullable (on delete set null, for a goal row that
-- gets deleted later) -- that part of the ask is already true of the
-- schema and needed no migration. What it didn't have is a way to say
-- "this review is about this specific race" without a goal row to point
-- to, which is the actual fix: race_name/race_date, populated directly by
-- the app at send time regardless of path (from the goal race when sent
-- through the post-race flow, from coach input when sent manually), so
-- goal_id becomes an optional cross-reference rather than the only way to
-- know what race a review is about.
--
-- Backfilled from the existing goal_id join for every row already in the
-- table -- at the time this migration runs, every real row has a goal_id
-- (post-race.ts's own header: "every row this app creates sets it, since
-- postRaceFlow has no notion of a review without a race"), so this is a
-- real, lossless derivation, not an invented default. Left nullable
-- rather than NOT NULL: a goal_id whose goal was already deleted before
-- this migration runs (on delete set null) has nothing to backfill from,
-- and asserting a NOT NULL constraint the data can't actually satisfy
-- everywhere would be the wrong kind of certainty. The application layer
-- (sendPostSeasonReview) is what actually guarantees every new row sets
-- both columns, for either path.
alter table public.post_season_review_requests
  add column race_name text,
  add column race_date date;

update public.post_season_review_requests r
set race_name = g.race_name,
    race_date = g.goal_date
from public.goals g
where r.goal_id = g.id
  and r.race_name is null;
