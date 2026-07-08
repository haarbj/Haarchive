-- Phase 3 (deterministic coaching engine) needs to know how many days a
-- week someone actually runs to schedule a plan -- distinct from
-- strength_days_per_week / cross_training_days_per_week, which are
-- explicitly other activities.
alter table public.athlete_profiles
  add column running_days_per_week int;

comment on column public.athlete_profiles.current_weekly_mileage is
  'Miles, not km -- unlike longest_run_km, which is explicitly suffixed.';
comment on column public.athlete_profiles.running_days_per_week is
  'How many days a week this athlete runs, distinct from strength/cross-training days.';
