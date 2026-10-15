-- Training-background intake (Part D/G/K follow-up).
--
-- WHY THIS EXISTS. A real beta athlete's Chicago marathon buildup was
-- entirely self-trained -- not a prior cycle with this platform -- and the
-- Run Club intake mixes brand-new runners in with athletes coming from
-- other coaches, plans and apps. Onboarding copy and progression logic had
-- quietly assumed every athlete's history was a previous Brody cycle. These
-- columns are what onboarding, plan selection (Part D) and multi-cycle
-- progression (Part G) anchor on instead.
--
-- Added to athlete_profiles rather than a new table because this is the
-- same one-row-per-athlete shape as the rest of that table (current
-- mileage, level, years running), athlete-writable for the same reason
-- (RLS already scopes it "select/update own" for the athlete and
-- "select" for their coach -- see the table's own init migration), and a
-- new table would buy nothing a few nullable columns don't already give.
--
-- Recorded races stay in race_results (already real, already dated,
-- already coach-readable) rather than being duplicated here -- a race time
-- is a race time whoever coached it, and that table already treats it that
-- way. injury_history below is coach-visible free text distinct from the
-- athlete's own PRIVATE injury log in the injuries table (never shown to
-- a coach, see injuries-section.tsx) -- two different audiences, two
-- different columns, not the same data twice.
alter table public.athlete_profiles
  add column training_background_source text
    check (
      training_background_source is null
      or training_background_source in ('self_trained', 'previous_coach', 'other_plan_or_app', 'new_to_structured')
    ),
  -- Only meaningful when training_background_source = 'previous_coach'.
  add column training_background_coach_name text,
  -- Only meaningful when training_background_source = 'other_plan_or_app'.
  add column training_background_program_name text,
  -- Typical recent weekly mileage before anything changed to join --
  -- distinct from current_weekly_mileage, which may already reflect a
  -- taper or a break since joining.
  add column training_background_recent_mileage numeric
    check (training_background_recent_mileage is null or training_background_recent_mileage >= 0),
  -- The highest sustained week of their most recent real buildup, whoever
  -- ran it. This is the number Part G's progression and Part D/K's
  -- plan-selection guidance anchor on instead of an assumed prior cycle.
  add column training_background_peak_mileage numeric
    check (training_background_peak_mileage is null or training_background_peak_mileage >= 0),
  -- Free text: for self-trained, what the buildup actually looked like
  -- (peak week, key sessions, what worked); for a previous coach or another
  -- plan/app, neutral context about that training, never a judgment of it.
  add column training_background_summary text,
  -- Coach-visible injury history. The platform never diagnoses or clears
  -- anyone to run (see setbacks.ts's MEDICAL_NOTE) -- this is what the
  -- athlete has told their coach, not a medical record.
  add column training_background_injury_history text;

comment on column public.athlete_profiles.training_background_source is
  'Where this athlete''s training came from before this platform: self_trained, previous_coach, other_plan_or_app, or new_to_structured. Drives conditional onboarding copy -- see training-background.ts.';
comment on column public.athlete_profiles.training_background_peak_mileage is
  'Peak weekly mileage of their most recent real buildup, whoever ran it. Part G and Part D/K anchor on this instead of assuming a prior cycle with this platform.';
