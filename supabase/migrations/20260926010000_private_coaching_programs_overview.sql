-- A Program's own "overview" -- the framework-level summary a coach writes
-- once and that applies across every one of its duration variants (a
-- 12-week and an 18-week version of the same methodology share ONE
-- overview, never one per variant -- these live on training_programs
-- itself, not program_duration_variants). Every field is optional: a
-- coach whose methodology has no fixed mileage range, or no glossary of
-- shorthand terms, simply leaves those blank -- nothing here is required
-- to save a Program.
--
-- initial/peak mileage are real numeric ranges (miles/week), following the
-- same nullable min/max-pair, max->=min convention every other range field
-- in this schema already uses (planned_distance_m/_max_m etc.). Typical
-- goal times and "recommended for" are free text -- purely descriptive,
-- never computed against, so a rigid duration/enum type would be false
-- precision for what's fundamentally a coach's own qualitative framing
-- ("3:15-4:30", "First-time marathoners..."). glossary_terms mirrors
-- program_day_extras.items' own text[] convention (a coach-ordered list of
-- short strings, e.g. "LR - Long Run") -- one row per definition, exactly
-- as authored, not a fixed enum of abbreviations this platform invents.
alter table public.training_programs
  add column initial_mileage_min numeric,
  add column initial_mileage_max numeric,
  add column peak_mileage_min numeric,
  add column peak_mileage_max numeric,
  add column typical_goal_times text,
  add column recommended_for text,
  add column glossary_terms text[];

alter table public.training_programs
  add constraint training_programs_initial_mileage_range_valid
    check (initial_mileage_max is null or (initial_mileage_min is not null and initial_mileage_max >= initial_mileage_min)),
  add constraint training_programs_peak_mileage_range_valid
    check (peak_mileage_max is null or (peak_mileage_min is not null and peak_mileage_max >= peak_mileage_min));
