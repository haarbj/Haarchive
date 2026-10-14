-- Educational layer for coached athletes: a per-phase "why this phase"
-- explainer, plus two effort-context fields on a workout completion.
--
-- explainer exists on BOTH sides of the Program/assignment boundary for
-- the same reason phase_key and name already do (see
-- 20260925010000_private_coaching_programs_core.sql's own header on
-- copy-not-reference): program_phase_definitions.explainer is the coach's
-- library copy, authored once; training_phases.explainer is the athlete's
-- own copy, written at assignment time and immune to any later edit or
-- deletion of the Program it came from. An athlete who was told why they
-- are doing a block of training keeps that explanation for the whole
-- block, even if the coach rewrites the template mid-cycle.
--
-- Deliberately plain text, not markdown: there is no markdown renderer in
-- this project's dependencies and adding one for this would be a new
-- dependency for a field whose whole content is prose paragraphs (see
-- CLAUDE.md §10). The app splits on blank lines and renders real
-- paragraphs.
--
-- Nullable with no default and no backfill: a phase with no authored
-- explainer falls back to the app's own default copy for its phase type
-- (src/lib/private-coaching/phase-explainers.ts), so the standard
-- General/Supportive/Specific explanations live in version control where
-- they can be reviewed and tested rather than frozen into a data
-- migration.
alter table public.program_phase_definitions add column explainer text;
alter table public.training_phases add column explainer text;

-- effort_level and conditions_notes sit alongside the existing rpe column
-- rather than replacing it, because they answer different questions. rpe
-- is how hard the session felt overall; effort_level is which intensity
-- domain the athlete believes they actually ran in; conditions_notes is
-- the heat/wind/terrain/fatigue context that explains a gap between the
-- prescribed pace and the pace that happened. The coach needs all three
-- together to decide whether a fitness estimate is wrong or the day just
-- was. Free text (validated app-side against a shared vocabulary) rather
-- than an enum, matching day_label's own precedent in
-- 20260826070000_private_coaching_day_vocabulary.sql.
alter table public.completed_workouts add column effort_level text;
alter table public.completed_workouts add column conditions_notes text;

-- Carries the athlete's copy of the explainer at assignment time. The
-- argument-type signature is unchanged (explainer rides inside the
-- p_phases jsonb this function already receives), so plain CREATE OR
-- REPLACE genuinely replaces the one live version here -- no drop needed,
-- unlike 20261013020000's added 7th parameter. Body is otherwise
-- identical to that migration's.
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
      source_program_id, source_program_phase_definition_id, source_program_duration_variant_id
    ) values (
      p_athlete_id, v_coach_id, v_phase->>'phaseKey', v_phase->>'name',
      (v_phase->>'startDate')::date, (v_phase->>'endDate')::date, v_phase->>'explainer',
      p_program_id, (v_phase->>'phaseDefinitionId')::uuid, p_variant_id
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
