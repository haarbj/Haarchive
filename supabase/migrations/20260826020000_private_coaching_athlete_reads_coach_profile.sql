-- Private 1-on-1 coaching: the missing reverse direction of
-- profiles_select_private_coach (20260825060000). That policy lets a
-- coach read their ATHLETE's profile (roster, workout headers, messages);
-- nothing ever let the ATHLETE read their own COACH's profile back --
-- needed for the coaching home's "You're being coached by X", the
-- messages thread header, and the messages index's "Message your coach"
-- card, all of which silently fell back to generic copy ("Conversation",
-- "your coach") instead of erroring, so this went unnoticed until live
-- staging testing surfaced it. The RLS adversarial test suite didn't catch
-- it either -- it tests isolation (can Athlete A read Athlete B/Coach B's
-- data), which this doesn't affect; it never had a positive test asserting
-- an athlete CAN read their own coach's profile, so a missing grant read
-- as "correctly denied" rather than "a real gap."
--
-- Mirrors coaches_this_athlete()'s own shape exactly, just with the two
-- roles swapped.
create or replace function public.is_coached_by(p_coach_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.coach_athletes
    where coach_athletes.coach_id = p_coach_id
      and coach_athletes.athlete_id = (select auth.uid())
      and coach_athletes.status = 'active'
  );
$$;

comment on function public.is_coached_by(uuid) is
  'True if the calling user is currently (status=active) coached by p_coach_id. The athlete-side mirror of coaches_this_athlete().';

create policy "profiles_select_as_coached_athlete" on public.profiles
  for select to authenticated using (public.is_coached_by(id));
