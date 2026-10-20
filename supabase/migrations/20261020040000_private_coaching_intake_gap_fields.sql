-- Intake gap-check: before planning, the platform verifies the intake
-- information a plan actually depends on (Daniels: prescription follows
-- what the athlete has access to). Most of what's needed already exists
-- -- goal race (goals), fitness anchor (race_results/
-- athlete_fitness_estimates), days-per-week (athlete_profiles.
-- running_days_per_week), injury/limitations (athlete_profiles.
-- training_background_injury_history, already self-reported by the
-- athlete in Settings), and home altitude (athlete_profiles.elevation_m,
-- on the table since the very first schema but never wired into any
-- form until now) -- see src/lib/private-coaching/intake-gaps.ts's own
-- header comment for the full accounting of what's reused vs. new here.
--
-- Four genuinely new, additive columns for the items nothing existing
-- covers: a multi-select of real facility/terrain access (not the
-- dormant has_track_access/has_trail_access/has_treadmill_access trio --
-- those cover 3 of 6 facility types and were never wired into any UI
-- either, so a clean single array is simpler than reviving three old
-- booleans plus adding three new ones), a free-text recent-training
-- baseline (a snapshot, not a workout log), and the two schedule
-- constraints nothing on this table captures today.
alter table public.athlete_profiles
  add column training_facilities text[],
  add column recent_training_detail text,
  add column long_run_day text,
  add column blackout_days text[];
