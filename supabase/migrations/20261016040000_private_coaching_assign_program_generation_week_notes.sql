-- Both functions replaced again, same reason and same shape as
-- 20261013070000: a new value (notes) rides inside the p_weeks jsonb these
-- functions already receive, so the argument-type signatures are
-- unchanged and plain CREATE OR REPLACE replaces the one live version of
-- each. An absent key yields NULL, so a hand-authored program (or a
-- generation run before this shipped) behaves exactly as before. Bodies
-- are otherwise identical to 20261013070000's.

create or replace function public.assign_program_generation(
  p_program_id uuid,
  p_variant_id uuid,
  p_athlete_id uuid,
  p_phases jsonb,
  p_days jsonb,
  p_weeks jsonb,
  p_clear_overlapping boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_id uuid := (select auth.uid());
  v_program_coach_id uuid;
  v_phase jsonb;
  v_week jsonb;
  v_day jsonb;
  v_step jsonb;
  v_extra jsonb;
  v_new_workout_id uuid;
  v_phases_created int := 0;
  v_workouts_created int := 0;
  v_skipped_dates date[] := '{}';
  v_overlap_count int;
  v_occupied boolean;
  v_overlap_phase record;
  v_cleared_workouts int := 0;
  v_cleared_week_plans int := 0;
  v_cleared_phases int := 0;
  v_n int;
begin
  if v_coach_id is null then
    raise exception 'Not authorized: no signed-in user.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_athlete_id::text));

  select coach_id into v_program_coach_id from public.training_programs where id = p_program_id;
  if v_program_coach_id is null or v_program_coach_id <> v_coach_id then
    raise exception 'Not authorized: program not found or not owned by the calling coach.';
  end if;

  if not public.coaches_this_athlete(p_athlete_id) then
    raise exception 'Not authorized: no active coaching relationship with this athlete.';
  end if;

  if not exists (
    select 1 from public.program_duration_variants
    where id = p_variant_id and program_id = p_program_id
  ) then
    raise exception 'Invalid variant for this program.';
  end if;

  if p_clear_overlapping then
    for v_phase in select * from jsonb_array_elements(p_phases)
    loop
      for v_overlap_phase in
        select id, start_date, end_date
        from public.training_phases
        where athlete_id = p_athlete_id
          and daterange(start_date, end_date, '[]')
              && daterange((v_phase->>'startDate')::date, (v_phase->>'endDate')::date, '[]')
      loop
        with deleted as (
          delete from public.scheduled_workouts
          where athlete_id = p_athlete_id
            and scheduled_date >= v_overlap_phase.start_date
            and scheduled_date <= v_overlap_phase.end_date
          returning 1
        )
        select count(*) into v_n from deleted;
        v_cleared_workouts := v_cleared_workouts + v_n;

        with deleted_weeks as (
          delete from public.training_week_plans
          where athlete_id = p_athlete_id
            and week_start >= v_overlap_phase.start_date
            and week_start <= v_overlap_phase.end_date
          returning 1
        )
        select count(*) into v_n from deleted_weeks;
        v_cleared_week_plans := v_cleared_week_plans + v_n;

        delete from public.training_phases where id = v_overlap_phase.id;
        v_cleared_phases := v_cleared_phases + 1;
      end loop;
    end loop;
  end if;

  for v_phase in select * from jsonb_array_elements(p_phases)
  loop
    select count(*) into v_overlap_count
    from public.training_phases
    where athlete_id = p_athlete_id
      and daterange(start_date, end_date, '[]')
          && daterange((v_phase->>'startDate')::date, (v_phase->>'endDate')::date, '[]');
    if v_overlap_count > 0 then
      raise exception 'This date range overlaps an existing training phase for this athlete.';
    end if;
  end loop;

  for v_phase in select * from jsonb_array_elements(p_phases)
  loop
    insert into public.training_phases (
      athlete_id, coach_id, phase_type, name, start_date, end_date, explainer,
      source_program_id, source_program_phase_definition_id, source_program_duration_variant_id,
      source_program_volume_variant_id
    ) values (
      p_athlete_id, v_coach_id, v_phase->>'phaseKey', v_phase->>'name',
      (v_phase->>'startDate')::date, (v_phase->>'endDate')::date, v_phase->>'explainer',
      p_program_id, (v_phase->>'phaseDefinitionId')::uuid, p_variant_id,
      nullif(v_phase->>'volumeVariantId', '')::uuid
    );
    v_phases_created := v_phases_created + 1;
  end loop;

  for v_day in select * from jsonb_array_elements(p_days)
  loop
    select exists (
      select 1 from public.scheduled_workouts
      where athlete_id = p_athlete_id and scheduled_date = (v_day->>'scheduledDate')::date
    ) into v_occupied;

    if v_occupied then
      v_skipped_dates := array_append(v_skipped_dates, (v_day->>'scheduledDate')::date);
      continue;
    end if;

    insert into public.scheduled_workouts (
      athlete_id, coach_id, scheduled_date, day_label, session_slot,
      planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s,
      planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference,
      pace_percent_basis, pace_percent_min, pace_percent_max,
      planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max,
      notes_from_coach, status, published_at, source_program_day_id,
      is_optional, alternative_text
    ) values (
      p_athlete_id, v_coach_id, (v_day->>'scheduledDate')::date, v_day->>'dayLabel', v_day->>'sessionSlot',
      (v_day->>'plannedDistanceM')::numeric, (v_day->>'plannedDistanceMaxM')::numeric,
      (v_day->>'plannedDurationS')::int, (v_day->>'plannedDurationMaxS')::int,
      (v_day->>'plannedPaceSPerMi')::int, (v_day->>'plannedPaceMaxSPerMi')::int,
      (v_day->>'paceReference')::public.pace_reference,
      (v_day->>'pacePercentBasis')::public.pace_reference, (v_day->>'pacePercentMin')::numeric, (v_day->>'pacePercentMax')::numeric,
      (v_day->>'plannedHrBpm')::int, (v_day->>'plannedHrMaxBpm')::int,
      (v_day->>'plannedRpe')::int, (v_day->>'plannedRpeMax')::int,
      v_day->>'notes', 'scheduled', null, (v_day->>'sourceProgramDayId')::uuid,
      coalesce((v_day->>'isOptional')::boolean, false), v_day->>'alternativeText'
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
    insert into public.training_week_plans (athlete_id, coach_id, week_start, label, target_volume_min, target_volume_max, target_volume_unit, notes)
    values (
      p_athlete_id, v_coach_id, (v_week->>'weekStart')::date, v_week->>'label',
      (v_week->>'targetVolumeMin')::numeric, (v_week->>'targetVolumeMax')::numeric, 'miles', v_week->>'notes'
    )
    on conflict (athlete_id, week_start) do nothing;
  end loop;

  return jsonb_build_object(
    'phasesCreated', v_phases_created,
    'workoutsCreated', v_workouts_created,
    'skippedDates', to_jsonb(v_skipped_dates),
    'clearedWorkouts', v_cleared_workouts,
    'clearedWeekPlans', v_cleared_week_plans,
    'clearedPhases', v_cleared_phases
  );
end;
$$;

revoke all on function public.assign_program_generation(uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean) from anon;

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
      notes_from_coach, status, published_at, source_program_day_id,
      is_optional, alternative_text
    ) values (
      p_athlete_id, v_coach_id, (v_day->>'scheduledDate')::date, v_day->>'dayLabel', v_day->>'sessionSlot',
      (v_day->>'plannedDistanceM')::numeric, (v_day->>'plannedDistanceMaxM')::numeric,
      (v_day->>'plannedDurationS')::int, (v_day->>'plannedDurationMaxS')::int,
      (v_day->>'plannedPaceSPerMi')::int, (v_day->>'plannedPaceMaxSPerMi')::int,
      (v_day->>'paceReference')::public.pace_reference,
      (v_day->>'pacePercentBasis')::public.pace_reference, (v_day->>'pacePercentMin')::numeric, (v_day->>'pacePercentMax')::numeric,
      (v_day->>'plannedHrBpm')::int, (v_day->>'plannedHrMaxBpm')::int,
      (v_day->>'plannedRpe')::int, (v_day->>'plannedRpeMax')::int,
      v_day->>'notes', 'scheduled', null, (v_day->>'sourceProgramDayId')::uuid,
      coalesce((v_day->>'isOptional')::boolean, false), v_day->>'alternativeText'
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
    insert into public.training_week_plans (athlete_id, coach_id, week_start, label, target_volume_min, target_volume_max, target_volume_unit, notes)
    values (
      p_athlete_id, v_coach_id, (v_week->>'weekStart')::date, v_week->>'label',
      (v_week->>'targetVolumeMin')::numeric, (v_week->>'targetVolumeMax')::numeric, 'miles', v_week->>'notes'
    )
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
