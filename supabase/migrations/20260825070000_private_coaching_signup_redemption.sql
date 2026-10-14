-- Private 1-on-1 coaching, Phase 2: redeem a pending coach_athlete_invite
-- automatically when its invited email signs up fresh, mirroring exactly
-- how handle_new_user() already redeems coach_invites for a brand-new
-- coach. This is the ONE code path that can't be bypassed by either
-- signup method (email/password or Google OAuth both create the
-- auth.users row via GoTrue before any app route runs), same reasoning
-- the original coach_invites redemption comment gives.
--
-- Deliberately runs BEFORE (not nested inside) the team/domain branch
-- below and its early `return new` -- private coaching is fully decoupled
-- from the team product, so a brand-new user redeeming a private-coaching
-- invite must not depend on whether they also happen to match the
-- brophybroncos.org domain.
--
-- An existing user (already signed up) who is invited does NOT go through
-- this trigger -- they redeem via the acceptPrivateCoachInvite Server
-- Action instead (see src/app/(app)/(protected)/coaching/roster/actions.ts
-- in the application code for this phase), which performs the identical
-- email-match check against their already-verified session email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_broncos_team_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_invite public.coach_invites%rowtype;
  v_coach_athlete_invite public.coach_athlete_invites%rowtype;
begin
  insert into public.profiles (id, display_name, avatar_url, timezone, units)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      'Runner'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    'UTC',
    'mi'
  );

  select * into v_coach_athlete_invite from public.coach_athlete_invites
    where lower(athlete_email) = lower(new.email) and redeemed_at is null and expires_at > now()
    limit 1;

  if found then
    insert into public.coach_athletes (coach_id, athlete_id, status)
    values (v_coach_athlete_invite.coach_id, new.id, 'active');
    update public.coach_athlete_invites set redeemed_at = now(), redeemed_by = new.id where id = v_coach_athlete_invite.id;
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (new.id, 'athlete_accepted', 'coach_athletes', v_coach_athlete_invite.coach_id, jsonb_build_object('via', 'signup_trigger'));
  end if;

  -- Athletes auto-join the one team by email domain -- no per-athlete invite.
  if lower(split_part(new.email, '@', 2)) = 'brophybroncos.org' then
    insert into public.team_memberships (team_id, user_id, role)
    values (v_broncos_team_id, new.id, 'athlete')
    on conflict (team_id, user_id) do nothing;
    return new;
  end if;

  -- Coaches only get in via an exact-email invite redemption.
  select * into v_invite from public.coach_invites
    where lower(email) = lower(new.email) and redeemed_at is null
    limit 1;

  if found then
    insert into public.team_memberships (team_id, user_id, role)
    values (v_invite.team_id, new.id, 'coach')
    on conflict (team_id, user_id) do nothing;
    update public.coach_invites set redeemed_at = now(), redeemed_by = new.id where id = v_invite.id;
  end if;

  return new; -- no team_memberships row = the "pending" state, caught at the app layer
end;
$$;
