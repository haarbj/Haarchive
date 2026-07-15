-- Contributor profiles: bio/title/expertise satellite table for
-- profiles(id), mirroring the athlete_profiles pattern. A contributor
-- profile is inherently public-facing (the whole point is to show up on a
-- byline once articles ship in a later phase), so unlike coach_invites/
-- questions/user_permissions, this table lets regular RLS do the work
-- instead of routing everything through the service-role client: public
-- select, owner-only insert/update -- the same shape as `profiles` itself
-- (profiles_select_own/profiles_update_own), just with select opened up to
-- everyone instead of "own row only".
--
-- The avatar itself is NOT duplicated here -- it reuses the existing
-- (previously unused) profiles.avatar_url column, editable now for the
-- first time via the contributor profile form.

create table public.contributor_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  title text,
  bio text,
  expertise text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_contributor_profiles_updated
  before update on public.contributor_profiles
  for each row execute function public.set_updated_at();

alter table public.contributor_profiles enable row level security;

create policy "contributor_profiles_select_public" on public.contributor_profiles
  for select to public using (true);

create policy "contributor_profiles_insert_own" on public.contributor_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "contributor_profiles_update_own" on public.contributor_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
