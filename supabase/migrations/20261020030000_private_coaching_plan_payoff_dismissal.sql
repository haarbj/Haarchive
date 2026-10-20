-- Athlete onboarding payoff ("Your Plan"): a dedicated welcome view shown
-- once, the first time a coached athlete with an assigned program opens
-- their coaching home. plan_payoff_dismissed_at records that they've seen
-- it (via "Take me to my schedule" or simply finishing the page), so the
-- auto-redirect in coaching/page.tsx's AthleteHomeSection never fires
-- again -- the page itself stays reachable afterward via an ordinary link,
-- this column only gates the ONE-TIME auto-show. Mirrors coach_trains_self's
-- own shape (a single nullable column on profiles, no new table, no new
-- RLS -- profiles' existing self-update policy already covers it).
alter table public.profiles add column plan_payoff_dismissed_at timestamptz;
