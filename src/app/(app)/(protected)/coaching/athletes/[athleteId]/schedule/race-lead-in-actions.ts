"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  RACE_LEAD_IN_FRAMEWORK_KEY,
  daysBeforeRaceForSlot,
  raceLeadInDates,
} from "@/lib/private-coaching/race-lead-in";

// Part A item 2: apply the coach's two-week race lead-in template onto the
// fourteen days ending on an athlete's race date.
//
// WHY THIS IS NOT JUST "ASSIGN THE LEAD-IN PROGRAM". Assigning a Program
// creates a training_phases row, and a two-week phase laid over the end of
// a buildup overlaps the plan's own Specific phase -- which would send the
// coach through the clear-overlap flow and delete the tail of the real
// plan to make room. The lead-in is meant to POPULATE the final fourteen
// days of the existing plan, not to replace the phase they sit in. So this
// writes workouts only, and touches no phase.
//
// Everything it writes is a DRAFT (published_at null), invisible to the
// athlete until the coach publishes it, because the whole point is that
// the coach reviews and adjusts a standard before the athlete sees it.
//
// A date that already has a workout is SKIPPED and reported, never
// overwritten -- same rule assign_program_generation already follows for
// occupied dates. That also makes this safely re-runnable: fix the clashes
// by hand, run it again, and only the empty days fill in.
//
// Not wrapped in a single transaction, unlike assignment's RPC. Each day
// is an independent draft and a partial application is both visible (the
// result says how many landed) and recoverable (run it again). Adding an
// RPC for this would mean a fourth copy of the workout-insert body for no
// real atomicity benefit.

export type ApplyRaceLeadInResult = {
  error?: string;
  created?: number;
  skippedDates?: string[];
  /** The dates the template was applied across, oldest first. */
  dates?: string[];
};

type TemplateDayRow = {
  id: string;
  week_number: number;
  day_of_week: number;
  day_label: string | null;
  session_slot: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_pace_s_per_mi: number | null;
  planned_pace_max_s_per_mi: number | null;
  pace_reference: string | null;
  pace_percent_basis: string | null;
  pace_percent_min: number | null;
  pace_percent_max: number | null;
  planned_hr_bpm: number | null;
  planned_hr_max_bpm: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
  is_optional: boolean;
  alternative_text: string | null;
  notes: string | null;
  program_day_steps: Record<string, unknown>[] | null;
  program_day_extras: Record<string, unknown>[] | null;
};

export async function applyRaceLeadIn(input: { athleteId: string; raceDate: string }): Promise<ApplyRaceLeadInResult> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", input.athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const { data: program } = await supabase
    .from("training_programs")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("framework_key", RACE_LEAD_IN_FRAMEWORK_KEY)
    .maybeSingle<{ id: string }>();
  if (!program) {
    return {
      error:
        "You don't have a race lead-in template yet. Ask your workspace admin to set one up.",
    };
  }

  const { data: dayRows } = await supabase
    .from("program_days")
    .select(
      "id, week_number, day_of_week, day_label, session_slot, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, pace_percent_basis, pace_percent_min, pace_percent_max, planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max, is_optional, alternative_text, notes, program_day_steps(*), program_day_extras(*)",
    )
    .eq("program_id", program.id)
    .returns<TemplateDayRow[]>();
  const days = dayRows ?? [];
  if (days.length === 0) return { error: "Your race lead-in template has no days authored yet." };

  // Map each authored slot onto a real date. A coach who has edited the
  // template down to fewer than fourteen days is fine: only the slots that
  // exist get written.
  let placed: { date: string; day: TemplateDayRow }[];
  try {
    placed = raceLeadInDates(
      input.raceDate,
      days.map((day) => ({ ...day, daysBeforeRace: daysBeforeRaceForSlot(day.week_number, day.day_of_week) })),
    ).map((entry) => ({ date: entry.date, day: entry.day }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't work out the lead-in dates." };
  }

  const dates = placed.map((p) => p.date);
  const { data: existing } = await supabase
    .from("scheduled_workouts")
    .select("scheduled_date")
    .eq("athlete_id", input.athleteId)
    .in("scheduled_date", dates)
    .returns<{ scheduled_date: string }[]>();
  const occupied = new Set((existing ?? []).map((row) => row.scheduled_date));

  const skippedDates: string[] = [];
  let created = 0;

  for (const { date, day } of placed) {
    if (occupied.has(date)) {
      skippedDates.push(date);
      continue;
    }

    const { data: workout, error } = await supabase
      .from("scheduled_workouts")
      .insert({
        athlete_id: input.athleteId,
        coach_id: session.userId,
        scheduled_date: date,
        day_label: day.day_label,
        session_slot: day.session_slot,
        planned_distance_m: day.planned_distance_m,
        planned_distance_max_m: day.planned_distance_max_m,
        planned_duration_s: day.planned_duration_s,
        planned_duration_max_s: day.planned_duration_max_s,
        planned_pace_s_per_mi: day.planned_pace_s_per_mi,
        planned_pace_max_s_per_mi: day.planned_pace_max_s_per_mi,
        pace_reference: day.pace_reference,
        pace_percent_basis: day.pace_percent_basis,
        pace_percent_min: day.pace_percent_min,
        pace_percent_max: day.pace_percent_max,
        planned_hr_bpm: day.planned_hr_bpm,
        planned_hr_max_bpm: day.planned_hr_max_bpm,
        planned_rpe: day.planned_rpe,
        planned_rpe_max: day.planned_rpe_max,
        is_optional: day.is_optional,
        alternative_text: day.alternative_text,
        notes_from_coach: day.notes,
        status: "scheduled",
        // Draft: the coach reviews the standard before the athlete sees it.
        published_at: null,
        source_program_day_id: day.id,
      })
      .select("id")
      .single();
    if (error) return { error: `Couldn't write the ${date} session: ${error.message}` };
    created += 1;

    const steps = day.program_day_steps ?? [];
    if (steps.length > 0) {
      const { error: stepError } = await supabase.from("scheduled_workout_steps").insert(
        steps.map((step, index) => ({
          scheduled_workout_id: workout.id,
          step_order: (step.step_order as number | null) ?? index,
          step_type: step.step_type,
          duration_s: step.duration_s,
          duration_max_s: step.duration_max_s,
          distance_m: step.distance_m,
          distance_max_m: step.distance_max_m,
          target_type: step.target_type,
          target_min: step.target_min,
          target_max: step.target_max,
          target_unit: step.target_unit,
          target_pace_reference: step.target_pace_reference,
          target_pace_percent_basis: step.target_pace_percent_basis,
          target_pace_percent_min: step.target_pace_percent_min,
          target_pace_percent_max: step.target_pace_percent_max,
          repetitions: step.repetitions,
          repetitions_max: step.repetitions_max,
          rest_s: step.rest_s,
          rest_max_s: step.rest_max_s,
          instructions: step.instructions,
        })),
      );
      if (stepError) return { error: `Couldn't write the ${date} session's steps: ${stepError.message}` };
    }

    const extras = day.program_day_extras ?? [];
    if (extras.length > 0) {
      const { error: extraError } = await supabase.from("scheduled_workout_extras").insert(
        extras.map((extra, index) => ({
          scheduled_workout_id: workout.id,
          extra_order: (extra.extra_order as number | null) ?? index,
          kind: extra.kind,
          overview: extra.overview,
          count: extra.count,
          distance_m: extra.distance_m,
          duration_s: extra.duration_s,
          items: extra.items,
        })),
      );
      if (extraError) return { error: `Couldn't write the ${date} session's extras: ${extraError.message}` };
    }
  }

  revalidatePath(`/coaching/athletes/${input.athleteId}/schedule`);
  return { created, skippedDates, dates };
}
