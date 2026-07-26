-- Community profiles: the public-facing "who is this runner" page for any
-- signed-up member (bio/location/favorite distances), not just contributors
-- -- distinct from contributor_profiles (writers, tied to article bylines)
-- and athlete_profiles (private fitness data: birth year, weight, mileage,
-- never public). Same shape as contributor_profiles: a satellite table on
-- profiles(id), public select, owner-only insert/update.
--
-- `location` is a deliberately freeform display string (e.g. "Portland,
-- OR"), NOT wired to athlete_profiles.country/state/city -- those are
-- separate, still-unused structured columns meant for a different purpose
-- (coach-matching / environmental context), not public display. Two
-- location-shaped columns existing for two different reasons is
-- intentional, not an oversight.
--
-- `favorite_distances` stores keys from the existing RACE_DISTANCES catalog
-- (src/lib/race-distances.ts), not freeform text, so the public page can
-- render real labels without a second naming scheme.

create table public.community_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text,
  location text,
  favorite_distances text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_community_profiles_updated
  before update on public.community_profiles
  for each row execute function public.set_updated_at();

alter table public.community_profiles enable row level security;

create policy "community_profiles_select_public" on public.community_profiles
  for select to public using (true);

create policy "community_profiles_insert_own" on public.community_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "community_profiles_update_own" on public.community_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- A profiles row is only publicly visible if that user also opted in with a
-- community_profiles row -- mirrors profiles_select_contributor_public
-- exactly (see the articles migration), just keyed on the other table.
create policy "profiles_select_community_public" on public.profiles
  for select to public using (
    exists (select 1 from public.community_profiles where community_profiles.user_id = profiles.id)
  );

-- PRs without opening race_results itself: race_results holds race_name,
-- exact dates, notes, and conditions the owner hasn't agreed to publish --
-- only the best time per distance is meant to be public. This view (owned
-- by the migration role, so it reads every user's rows regardless of
-- race_results' owner-only RLS -- views default to that "definer"
-- behavior unless security_invoker is set) pre-aggregates down to just
-- (user_id, distance_m, best_time_s) before anything is granted public
-- access, so the narrowing lives at the database layer rather than
-- depending on every future query against this data to select the right
-- columns by hand.
create view public.public_personal_records
  with (security_invoker = false) as
  select user_id, distance_m, min(finish_time_s) as best_time_s
  from public.race_results
  group by user_id, distance_m;

grant select on public.public_personal_records to anon, authenticated;
