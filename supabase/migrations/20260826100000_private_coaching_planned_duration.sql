-- A coach prescribing a time-based day ("45-60 min easy") had no
-- equivalent to the existing planned_distance_m/_max_m pair -- the top-
-- level quick-create fields only ever accepted distance, forcing anyone
-- who coaches by time onto the full Steps editor just to say "45
-- minutes." Mirrors the distance pair exactly: nullable, min-only is a
-- point value, min+max is a range, same invariants.
alter table public.scheduled_workouts
  add column planned_duration_s int,
  add column planned_duration_max_s int;

alter table public.scheduled_workouts
  add constraint scheduled_workouts_duration_range_valid check (
    planned_duration_max_s is null
    or (planned_duration_s is not null and planned_duration_max_s >= planned_duration_s)
  );
