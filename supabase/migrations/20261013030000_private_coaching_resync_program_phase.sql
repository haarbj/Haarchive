-- A "resync this phase from its Program" action -- the other half of the
-- gap the programs_provenance migration's own comment flagged: editing a
-- Program after it's been assigned never reached an already-assigned
-- athlete, because training_phases/scheduled_workouts are copy-not-
-- reference by design (source_program_* is on delete set null, never a
-- live join). This closes that gap for an existing phase, on demand,
-- rather than automatically -- a coach explicitly asks to pull the
-- Program's current content into one already-assigned phase.
--
-- Scoped to exactly one existing phase's own date range: clears every
-- scheduled_workouts/training_week_plans row in that range (same
-- semantics as clearPhaseTraining, schedule/actions.ts), then writes the
-- freshly-regenerated content in its place. The phase row itself is left
-- alone (its id, dates, and roadmap position are untouched) -- unlike
-- assign_program_generation, this never creates or deletes a
-- training_phases row.
--
-- The caller (assign-program-actions.ts's resyncPhaseFromProgram) is
-- responsible for re-running resolveProgramGeneration against the
-- phase's *current* source program content before calling this function
-- -- this function only ever writes exactly the rows it's handed, the
-- same "never trust a client-computed number without a server-side
-- recompute" discipline every other write path in this schema follows.
create or replace function public.resync_program_phase_generation(
  p_phase_id uuid,
  p_athlete_id uuid,
  p_days jsonb,
  p_weeks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_id uuid := (select auth.uid());
  v_phase record;
  v_day jsonb;
  v_step jsonb;
  v_extra jsonb;
  v_week jsonb;
  v_new_workout_id uuid;
  v_cleared_workouts int := 0;
  v_cleared_week_plans int := 0;
  v_workouts_created int := 0;
  v_n int;
begin
  if v_coach_id is null then
    raise exception 'Not authorized: no signed-in user.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_athlete_id::text));

  select id, start_date, end_date, source_program_id into v_phase
  from public.training_phases
  where id = p_phase_id and athlete_id = p_athlete_id and coach_id = v_coach_id;

  if v_phase.id is null then
    raise exception 'Not authorized: phase not found or not owned by the calling coach.';
  end if;
  if v_phase.source_program_id is null then
    raise exception 'This phase was not generated from a Program, so it cannot be resynced.';
  end if;

  if not public.coaches_this_athlete(p_athlete_id) then
    raise exception 'Not authorized: no active coaching relationship with this athlete.';
  end if;

  with deleted as (
    delete from public.scheduled_workouts
    where athlete_id = p_athlete_id
      and scheduled_date >= v_phase.start_date
      and scheduled_date <= v_phase.end_date
    returning 1
  )
  select count(*) into v_n from deleted;
  v_cleared_workouts := v_n;

  with deleted_weeks as (
    delete from public.training_week_plans
    where athlete_id = p_athlete_id
      and week_start >= v_phase.start_date
      and week_start <= v_phase.end_date
    returning 1
  )
  select count(*) into v_n from deleted_weeks;
  v_cleared_week_plans := v_n;

  for v_day in select * from jsonb_array_elements(p_days)
  loop
    insert into public.scheduled_workouts (
      athlete_id, coach_id, scheduled_date, day_label, session_slot,
      planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s,
      planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference,
      pace_percent_basis, pace_percent_min, pace_percent_max,
      planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max,
      notes_from_coach, status, published_at, source_program_day_id
    ) values (
      p_athlete_id, v_coach_id, (v_day->>'scheduledDate')::date, v_day->>'dayLabel', v_day->>'sessionSlot',
      (v_day->>'plannedDistanceM')::numeric, (v_day->>'plannedDistanceMaxM')::numeric,
      (v_day->>'plannedDurationS')::int, (v_day->>'plannedDurationMaxS')::int,
      (v_day->>'plannedPaceSPerMi')::int, (v_day->>'plannedPaceMaxSPerMi')::int,
      (v_day->>'paceReference')::public.pace_reference,
      (v_day->>'pacePercentBasis')::public.pace_reference, (v_day->>'pacePercentMin')::numeric, (v_day->>'pacePercentMax')::numeric,
      (v_day->>'plannedHrBpm')::int, (v_day->>'plannedHrMaxBpm')::int,
      (v_day->>'plannedRpe')::int, (v_day->>'plannedRpeMax')::int,
      v_day->>'notes', 'scheduled', null, (v_day->>'sourceProgramDayId')::uuid
    )
    returning id into v_new_workout_id;
    v_workouts_created := v_workouts_created + 1;

    for v_step in select * from jsonb_array_elements(coalesce(v_day->'steps', '[]'::jsonb))
    loop
      insert into public.scheduled_workout_steps (
        scheduled_workout_id, step_order, step_type, duration_s, duration_max_s,
        distance_m, distance_max_m, target_type, target_min, target_max, target_unit,
        target_pace_reference, target_pace_percent_basis, target_pace_percent_min, target_pace_percent_max,
        repetitions, repetitions_max, rest_s, rest_max_s, instructions
      ) values (
        v_new_workout_id, (v_step->>'stepOrder')::int, (v_step->>'stepType')::public.workout_step_type,
        (v_step->>'durationS')::int, (v_step->>'durationMaxS')::int,
        (v_step->>'distanceM')::numeric, (v_step->>'distanceMaxM')::numeric,
        (v_step->>'targetType')::public.workout_target_type, (v_step->>'targetMin')::numeric,
        (v_step->>'targetMax')::numeric, v_step->>'targetUnit',
        (v_step->>'targetPaceReference')::public.pace_reference,
        (v_step->>'targetPacePercentBasis')::public.pace_reference, (v_step->>'targetPacePercentMin')::numeric, (v_step->>'targetPacePercentMax')::numeric,
        (v_step->>'repetitions')::int, (v_step->>'repetitionsMax')::int, (v_step->>'restS')::int, (v_step->>'restMaxS')::int, v_step->>'instructions'
      );
    end loop;

    for v_extra in select * from jsonb_array_elements(coalesce(v_day->'extras', '[]'::jsonb))
    loop
      insert into public.scheduled_workout_extras (
        scheduled_workout_id, extra_order, kind, overview, count, distance_m, duration_s, items
      ) values (
        v_new_workout_id, (v_extra->>'extraOrder')::int, v_extra->>'kind', v_extra->>'overview',
        (v_extra->>'count')::int, (v_extra->>'distanceM')::numeric, (v_extra->>'durationS')::int,
        array(select jsonb_array_elements_text(coalesce(v_extra->'items', '[]'::jsonb)))
      );
    end loop;
  end loop;

  for v_week in select * from jsonb_array_elements(p_weeks)
  loop
    insert into public.training_week_plans (athlete_id, coach_id, week_start, label, target_volume_min, target_volume_unit)
    values (p_athlete_id, v_coach_id, (v_week->>'weekStart')::date, v_week->>'label', (v_week->>'targetVolumeMin')::numeric, 'miles')
    on conflict (athlete_id, week_start) do nothing;
  end loop;

  return jsonb_build_object(
    'clearedWorkouts', v_cleared_workouts,
    'clearedWeekPlans', v_cleared_week_plans,
    'workoutsCreated', v_workouts_created
  );
end;
$$;

revoke all on function public.resync_program_phase_generation(uuid, uuid, jsonb, jsonb) from anon;
