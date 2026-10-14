"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { createNotification } from "@/lib/notifications/create-notification";
import { resolveAthleteVariables, validateStepRanges, type StepInput } from "@/lib/private-coaching/steps";
import { stepInputToIntensityTargets, intensityTargetsToStepRow } from "@/lib/private-coaching/intensity-target";
import {
  validateDistanceRange,
  validateDurationRange,
  validatePaceRange,
  validatePacePercentRange,
  validateHrRange,
  validateRpeRange,
} from "@/lib/private-coaching/workout-distance";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";
import { mondaysInRange } from "@/lib/private-coaching/training-phases";
import { resolvePlanImport } from "@/lib/private-coaching/plan-import";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import { stepInputsSchema } from "@/lib/validation/private-coaching";
import type { WorkoutType } from "@/lib/coaching-engine";
import { addDays, daysBetween, mostRecentMonday } from "@/lib/week";
import { MILE_METERS } from "@/lib/race-distances";
import { TRAINING_PLANS } from "@/lib/training-plans/data";

export type ScheduledWorkoutInput = {
  id?: string;
  athleteId: string;
  templateId?: string | null;
  scheduledDate: string;
  workoutType: WorkoutType | null;
  // day_label/session_slot/extras are private coaching's own vocabulary --
  // never derived from or compared against workoutType. title is gone as
  // a coach-facing concept entirely (day_label + steps/extras say what it
  // used to say) -- not part of this input at all; a pre-existing row's
  // legacy title is left untouched by simply never including the column
  // in these writes.
  dayLabel: string | null;
  sessionSlot: string | null;
  extras: WorkoutExtraInput[];
  notesFromCoach: string | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  // Pace, heart rate, and RPE join distance/duration as the remaining ways
  // to specify a target -- see workout-distance.ts's own comment on why
  // pace is mathematically linked to distance/duration (kept consistent
  // by the UI) while heart rate and RPE are independent alongside them.
  plannedPaceSPerMi: number | null;
  plannedPaceMaxSPerMi: number | null;
  plannedPaceReference: PaceReferenceKey | null;
  // A day-level percent-of-a-reference-pace target ("50-60% 5K pace"),
  // mutually exclusive with plannedPaceReference/plannedPaceSPerMi/
  // plannedPaceMaxSPerMi (see scheduled_workouts_pace_percent_exclusive) --
  // the same trio program_days already carries (see programs/actions.ts's
  // ProgramDayInput/saveProgramDay), now wired up here too. Previously
  // absent from this type entirely (coaching-platform-audit/01 §5.1's
  // "still open" day-level gap): a program-assigned workout could arrive
  // with these set via assign_program_generation, but a coach had no way
  // to set or edit one from this editor's UI at all.
  plannedPacePercentBasis: PaceReferenceKey | null;
  plannedPacePercentMin: number | null;
  plannedPacePercentMax: number | null;
  plannedVolumePercent: number | null;
  plannedHrBpm: number | null;
  plannedHrMaxBpm: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  steps: StepInput[];
  publish: boolean;
};

type MetricRow = { key: string; value: number; unit: string };

// Copying a template's steps in verbatim, then resolving @athlete.<key>
// placeholders in each step's instructions against that athlete's own
// current metrics -- the moment the product brief describes ("resolve per-
// athlete without duplicating workouts"). Steps authored from scratch
// (templateId omitted) go through the exact same resolution pass, so a
// coach typing "@athlete.threshold_pace" directly gets the same behavior
// as picking it up from a template.
async function resolveStepsForAthlete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  steps: StepInput[],
): Promise<StepInput[]> {
  const { data: metricRows } = await supabase
    .from("athlete_metrics")
    .select("key, value, unit")
    .eq("athlete_id", athleteId)
    .order("effective_from", { ascending: false })
    .returns<MetricRow[]>();

  // Only the most recent row per key -- effective_from desc means the
  // first occurrence of a given key in this already-sorted list is current.
  const latestByKey = new Map<string, { value: number; unit: string }>();
  for (const row of metricRows ?? []) {
    if (!latestByKey.has(row.key)) latestByKey.set(row.key, { value: row.value, unit: row.unit });
  }
  const metrics = Object.fromEntries(latestByKey);

  return steps.map((step) => ({
    ...step,
    instructions: step.instructions ? resolveAthleteVariables(step.instructions, metrics) : step.instructions,
  }));
}

function extraRows(scheduledWorkoutId: string, extras: WorkoutExtraInput[]) {
  return extras.map((extra, index) => ({
    scheduled_workout_id: scheduledWorkoutId,
    extra_order: index,
    kind: extra.kind,
    overview: extra.overview,
    count: extra.count,
    distance_m: extra.distanceM,
    duration_s: extra.durationS,
    items: extra.items,
  }));
}

export async function saveScheduledWorkout(input: ScheduledWorkoutInput): Promise<{ error?: string; id?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (!input.scheduledDate) return { error: "Pick a date." };

  const stepsCheck = stepInputsSchema.safeParse(input.steps);
  if (!stepsCheck.success) return { error: stepsCheck.error.issues[0]?.message ?? "Check the workout's steps." };
  const stepRangesCheck = validateStepRanges(input.steps);
  if (!stepRangesCheck.valid) return { error: stepRangesCheck.error };

  const distanceRangeCheck = validateDistanceRange(input.plannedDistanceM, input.plannedDistanceMaxM);
  if (!distanceRangeCheck.valid) return { error: distanceRangeCheck.error };

  const durationRangeCheck = validateDurationRange(input.plannedDurationS, input.plannedDurationMaxS);
  if (!durationRangeCheck.valid) return { error: durationRangeCheck.error };

  const paceRangeCheck = validatePaceRange(input.plannedPaceSPerMi, input.plannedPaceMaxSPerMi);
  if (!paceRangeCheck.valid) return { error: paceRangeCheck.error };

  const pacePercentRangeCheck = validatePacePercentRange(input.plannedPacePercentMin, input.plannedPacePercentMax);
  if (!pacePercentRangeCheck.valid) return { error: pacePercentRangeCheck.error };
  if (input.plannedPacePercentMin != null && input.plannedPacePercentBasis == null) {
    return { error: "Pick a reference pace for the percent target." };
  }

  const hrRangeCheck = validateHrRange(input.plannedHrBpm, input.plannedHrMaxBpm);
  if (!hrRangeCheck.valid) return { error: hrRangeCheck.error };

  const rpeRangeCheck = validateRpeRange(input.plannedRpe, input.plannedRpeMax);
  if (!rpeRangeCheck.valid) return { error: rpeRangeCheck.error };

  // Defense-in-depth, mirroring useWorkoutTargetFields' own identical
  // backstop for volumePercent/paceReference: scheduled_workouts_pace_percent_exclusive
  // rejects a row where pace_percent_basis and a fixed pace/reference are
  // both set, so a percent basis always wins here regardless of what the
  // caller sent for the other three -- never rely solely on the UI having
  // hidden/cleared them (see program-day-form.tsx's identical exclusivity
  // handling for program_days, which this mirrors).
  const pacePaceReference = input.plannedPacePercentBasis ? null : input.plannedPaceReference;
  const pacePaceSPerMi = input.plannedPacePercentBasis ? null : input.plannedPaceSPerMi;
  const pacePaceMaxSPerMi = input.plannedPacePercentBasis ? null : input.plannedPaceMaxSPerMi;

  const supabase = await createClient();

  // Defense-in-depth, not the real boundary -- scheduled_workouts_all_coach
  // RLS now independently requires coaches_this_athlete(athlete_id) too
  // (see the migration's own comment), so a bad athleteId fails at the
  // database regardless of this check. This is here purely so a Server
  // Action called directly with an unrelated athleteId (bypassing the page
  // that normally 404s first) fails with a real message instead of a raw
  // Postgres RLS-violation error.
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", input.athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const resolvedSteps = await resolveStepsForAthlete(supabase, input.athleteId, input.steps);

  // Read before overwriting -- the only way to tell "first publish" (a
  // draft going live, or a brand-new workout) apart from "re-publish of an
  // already-live workout" (an edit to something the athlete has already
  // seen), which get genuinely different notification copy below.
  let wasPublished = false;
  let workoutId = input.id;
  if (workoutId) {
    const { data: existingRow } = await supabase
      .from("scheduled_workouts")
      .select("published_at")
      .eq("id", workoutId)
      .eq("coach_id", session.userId)
      .maybeSingle<{ published_at: string | null }>();
    wasPublished = Boolean(existingRow?.published_at);
  }
  if (workoutId) {
    // title is deliberately absent from this payload -- a legacy row's
    // existing value is left exactly as-is (Postgres only touches columns
    // actually named in an UPDATE), it's just never written by this form.
    const { error } = await supabase
      .from("scheduled_workouts")
      .update({
        template_id: input.templateId ?? null,
        scheduled_date: input.scheduledDate,
        workout_type: input.workoutType,
        day_label: input.dayLabel,
        session_slot: input.sessionSlot,
        notes_from_coach: input.notesFromCoach,
        planned_distance_m: input.plannedDistanceM,
        planned_distance_max_m: input.plannedDistanceMaxM,
        planned_duration_s: input.plannedDurationS,
        planned_duration_max_s: input.plannedDurationMaxS,
        planned_pace_s_per_mi: pacePaceSPerMi,
        planned_pace_max_s_per_mi: pacePaceMaxSPerMi,
        pace_reference: pacePaceReference,
        pace_percent_basis: input.plannedPacePercentBasis,
        pace_percent_min: input.plannedPacePercentMin,
        pace_percent_max: input.plannedPacePercentMax,
        planned_volume_percent: input.plannedVolumePercent,
        planned_hr_bpm: input.plannedHrBpm,
        planned_hr_max_bpm: input.plannedHrMaxBpm,
        planned_rpe: input.plannedRpe,
        planned_rpe_max: input.plannedRpeMax,
        published_at: input.publish ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workoutId)
      .eq("coach_id", session.userId);
    if (error) return { error: error.message };

    const { error: deleteStepsError } = await supabase.from("scheduled_workout_steps").delete().eq("scheduled_workout_id", workoutId);
    if (deleteStepsError) return { error: deleteStepsError.message };

    const { error: deleteExtrasError } = await supabase.from("scheduled_workout_extras").delete().eq("scheduled_workout_id", workoutId);
    if (deleteExtrasError) return { error: deleteExtrasError.message };
  } else {
    const { data, error } = await supabase
      .from("scheduled_workouts")
      .insert({
        athlete_id: input.athleteId,
        coach_id: session.userId,
        template_id: input.templateId ?? null,
        scheduled_date: input.scheduledDate,
        workout_type: input.workoutType,
        day_label: input.dayLabel,
        session_slot: input.sessionSlot,
        notes_from_coach: input.notesFromCoach,
        planned_distance_m: input.plannedDistanceM,
        planned_distance_max_m: input.plannedDistanceMaxM,
        planned_duration_s: input.plannedDurationS,
        planned_duration_max_s: input.plannedDurationMaxS,
        planned_pace_s_per_mi: pacePaceSPerMi,
        planned_pace_max_s_per_mi: pacePaceMaxSPerMi,
        pace_reference: pacePaceReference,
        pace_percent_basis: input.plannedPacePercentBasis,
        pace_percent_min: input.plannedPacePercentMin,
        pace_percent_max: input.plannedPacePercentMax,
        planned_volume_percent: input.plannedVolumePercent,
        planned_hr_bpm: input.plannedHrBpm,
        planned_hr_max_bpm: input.plannedHrMaxBpm,
        planned_rpe: input.plannedRpe,
        planned_rpe_max: input.plannedRpeMax,
        published_at: input.publish ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    workoutId = data.id;
  }
  if (!workoutId) return { error: "Something went wrong saving this workout." };

  if (resolvedSteps.length > 0) {
    // Routed through the shared IntensityTarget contract (coaching-
    // platform-audit/05 §1.1) rather than hand-listing each target column:
    // stepInputToIntensityTargets/intensityTargetsToStepFields is the one
    // serialize/deserialize pair every step-target field goes through, so
    // this insert structurally cannot repeat D1/D2's "forgot a column"
    // bug the way the pre-fix version of this exact block did.
    const { error: stepsError } = await supabase.from("scheduled_workout_steps").insert(
      resolvedSteps.map((step, index) => ({
        scheduled_workout_id: workoutId,
        step_order: index,
        step_type: step.stepType,
        ...intensityTargetsToStepRow(stepInputToIntensityTargets(step)),
        repetitions: step.repetitions,
        repetitions_max: step.repetitionsMax,
        rest_s: step.restS,
        rest_max_s: step.restMaxS,
        instructions: step.instructions,
      })),
    );
    if (stepsError) return { error: stepsError.message };
  }

  if (input.extras.length > 0) {
    const { error: extrasError } = await supabase.from("scheduled_workout_extras").insert(extraRows(workoutId, input.extras));
    if (extrasError) return { error: extrasError.message };
  }

  const admin = createServiceRoleClient();
  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: input.id ? "workout_edited" : "workout_created",
    entity_type: "scheduled_workouts",
    entity_id: workoutId,
    metadata: { athlete_id: input.athleteId, published: input.publish },
  });

  if (input.publish) {
    const label = getWorkoutDisplayLabel(input.dayLabel, null);
    await createNotification({
      userId: input.athleteId,
      // wasPublished is only ever true on the edit path (a brand-new
      // workout can't have been published before it existed) -- re-
      // publishing an edited workout the athlete already saw reads as
      // "updated," never as a second "assigned," which would otherwise
      // look like a brand-new workout showed up every time a coach
      // tweaked a detail.
      type: wasPublished ? "workout_updated" : "workout_assigned",
      content: wasPublished ? `${label} was updated -- ${input.scheduledDate}` : `${label} -- ${input.scheduledDate}`,
      relatedEntityId: workoutId,
    });
  }

  revalidatePath(`/coaching/athletes/${input.athleteId}/schedule`);
  return { id: workoutId };
}

// Powers the calendar's drag-and-drop reschedule AND its non-drag "Move"
// date field -- both call this identically. .select() on the update makes
// a zero-row match (wrong coach, or workoutId doesn't exist) observable to
// the caller, same reasoning as completion-actions.ts's deleteWorkoutCompletion:
// without it, the calendar's optimistic UI would have no way to know a
// silently-no-op update happened and roll back the card's date.
export async function rescheduleWorkout(
  workoutId: string,
  athleteId: string,
  newDate: string,
): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();

  // Read first -- only a workout the athlete can already see (published)
  // is worth telling them about moving; a draft moving around the
  // calendar is invisible to them either way, same silent rule
  // saveScheduledWorkout's own unpublished path follows.
  const { data: existingRow } = await supabase
    .from("scheduled_workouts")
    .select("published_at, day_label, title")
    .eq("id", workoutId)
    .eq("coach_id", session.userId)
    .maybeSingle<{ published_at: string | null; day_label: string | null; title: string | null }>();

  const { data: updated, error } = await supabase
    .from("scheduled_workouts")
    .update({ scheduled_date: newDate, updated_at: new Date().toISOString() })
    .eq("id", workoutId)
    .eq("coach_id", session.userId)
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "Couldn't move that workout." };

  if (existingRow?.published_at) {
    const label = getWorkoutDisplayLabel(existingRow.day_label, existingRow.title);
    await createNotification({
      userId: athleteId,
      type: "workout_updated",
      content: `${label} moved to ${newDate}`,
      relatedEntityId: workoutId,
    });
  }

  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return {};
}

type ExistingWorkoutRow = {
  title: string | null;
  workout_type: WorkoutType | null;
  day_label: string | null;
  session_slot: string | null;
  notes_from_coach: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_pace_s_per_mi: number | null;
  planned_pace_max_s_per_mi: number | null;
  pace_reference: PaceReferenceKey | null;
  pace_percent_basis: PaceReferenceKey | null;
  pace_percent_min: number | null;
  pace_percent_max: number | null;
  planned_volume_percent: number | null;
  planned_hr_bpm: number | null;
  planned_hr_max_bpm: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
  scheduled_date: string;
};
type ExistingStepRow = {
  step_type: StepInput["stepType"];
  duration_s: number | null;
  duration_max_s: number | null;
  distance_m: number | null;
  distance_max_m: number | null;
  target_type: StepInput["targetType"];
  target_min: number | null;
  target_max: number | null;
  target_unit: string | null;
  target_pace_reference: PaceReferenceKey | null;
  target_pace_percent_basis: PaceReferenceKey | null;
  target_pace_percent_min: number | null;
  target_pace_percent_max: number | null;
  repetitions: number | null;
  repetitions_max: number | null;
  rest_s: number | null;
  rest_max_s: number | null;
  instructions: string | null;
};
type ExistingExtraRow = {
  kind: string;
  overview: string | null;
  count: number | null;
  distance_m: number | null;
  duration_s: number | null;
  items: string[] | null;
};

// A genuinely independent copy -- fresh scheduled_workouts row (new id,
// always published_at: null so it renders as an explicit Draft, never
// silently identical-looking to the source), fresh scheduled_workout_
// steps rows, and fresh scheduled_workout_extras rows, none of them a
// shared/aliased reference to the source's. Lands on the SAME date as the
// source; the coach relocates it via drag-and-drop or the Move field, same
// as any other card -- this phase deliberately doesn't build a separate
// date-picker just for duplication. title carries forward as-is if the
// source is a legacy row that has one (nothing writes a new title going
// forward, but a duplicate of an old row shouldn't silently lose it).
export async function duplicateScheduledWorkout(
  workoutId: string,
  athleteId: string,
): Promise<{ error?: string; id?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: source } = await supabase
    .from("scheduled_workouts")
    .select(
      "title, workout_type, day_label, session_slot, notes_from_coach, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, pace_percent_basis, pace_percent_min, pace_percent_max, planned_volume_percent, planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max, scheduled_date",
    )
    .eq("id", workoutId)
    .eq("coach_id", session.userId)
    .maybeSingle<ExistingWorkoutRow>();
  if (!source) return { error: "Couldn't find that workout." };

  const [{ data: sourceSteps }, { data: sourceExtras }] = await Promise.all([
    supabase
      .from("scheduled_workout_steps")
      .select(
        "step_type, duration_s, duration_max_s, distance_m, distance_max_m, target_type, target_min, target_max, target_unit, target_pace_reference, target_pace_percent_basis, target_pace_percent_min, target_pace_percent_max, repetitions, repetitions_max, rest_s, rest_max_s, instructions",
      )
      .eq("scheduled_workout_id", workoutId)
      .order("step_order")
      .returns<ExistingStepRow[]>(),
    supabase
      .from("scheduled_workout_extras")
      .select("kind, overview, count, distance_m, duration_s, items")
      .eq("scheduled_workout_id", workoutId)
      .order("extra_order")
      .returns<ExistingExtraRow[]>(),
  ]);

  const { data: inserted, error } = await supabase
    .from("scheduled_workouts")
    .insert({
      athlete_id: athleteId,
      coach_id: session.userId,
      scheduled_date: source.scheduled_date,
      title: source.title,
      workout_type: source.workout_type,
      day_label: source.day_label,
      session_slot: source.session_slot,
      notes_from_coach: source.notes_from_coach,
      planned_distance_m: source.planned_distance_m,
      planned_distance_max_m: source.planned_distance_max_m,
      planned_duration_s: source.planned_duration_s,
      planned_duration_max_s: source.planned_duration_max_s,
      planned_pace_s_per_mi: source.planned_pace_s_per_mi,
      planned_pace_max_s_per_mi: source.planned_pace_max_s_per_mi,
      pace_reference: source.pace_reference,
      pace_percent_basis: source.pace_percent_basis,
      pace_percent_min: source.pace_percent_min,
      pace_percent_max: source.pace_percent_max,
      planned_volume_percent: source.planned_volume_percent,
      planned_hr_bpm: source.planned_hr_bpm,
      planned_hr_max_bpm: source.planned_hr_max_bpm,
      planned_rpe: source.planned_rpe,
      planned_rpe_max: source.planned_rpe_max,
      published_at: null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const newWorkoutId = inserted.id;

  if (sourceSteps && sourceSteps.length > 0) {
    const { error: stepsError } = await supabase.from("scheduled_workout_steps").insert(
      sourceSteps.map((step, index) => ({
        scheduled_workout_id: newWorkoutId,
        step_order: index,
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
    if (stepsError) return { error: stepsError.message };
  }

  if (sourceExtras && sourceExtras.length > 0) {
    const { error: extrasError } = await supabase.from("scheduled_workout_extras").insert(
      sourceExtras.map((extra, index) => ({
        scheduled_workout_id: newWorkoutId,
        extra_order: index,
        kind: extra.kind,
        overview: extra.overview,
        count: extra.count,
        distance_m: extra.distance_m,
        duration_s: extra.duration_s,
        items: extra.items,
      })),
    );
    if (extrasError) return { error: extrasError.message };
  }

  const admin = createServiceRoleClient();
  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "workout_created",
    entity_type: "scheduled_workouts",
    entity_id: newWorkoutId,
    metadata: { athlete_id: athleteId, duplicated_from: workoutId },
  });

  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return { id: newWorkoutId };
}

type CopySourceWorkoutRow = {
  id: string;
  scheduled_date: string;
  title: string | null;
  workout_type: WorkoutType | null;
  day_label: string | null;
  session_slot: string | null;
  notes_from_coach: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_pace_s_per_mi: number | null;
  planned_pace_max_s_per_mi: number | null;
  pace_reference: PaceReferenceKey | null;
  pace_percent_basis: PaceReferenceKey | null;
  pace_percent_min: number | null;
  pace_percent_max: number | null;
  planned_volume_percent: number | null;
  planned_hr_bpm: number | null;
  planned_hr_max_bpm: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
};

export type CopyWeekResult = { error?: string; copiedCount?: number; skippedDates?: string[] };

// Phase 2 planning-speed feature -- clones a full week of scheduled_
// workouts (with their steps/extras) onto a different week, the same way
// duplicateScheduledWorkout already clones a single workout, just looped
// with each date shifted by the source-to-target offset. Every copy
// lands as an unpublished draft, same as duplicateScheduledWorkout, so
// the coach reviews/adjusts before the athlete ever sees it.
//
// Never overwrites or doubles up an occupied day: any target date that
// already has a workout is skipped outright and reported back, rather
// than silently clobbering or duplicating onto it (a real product
// decision, not an oversight -- see the Phase 2 plan).
export async function copyWeek(athleteId: string, sourceWeekStart: string, targetWeekStart: string): Promise<CopyWeekResult> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const sourceWeekEnd = addDays(sourceWeekStart, 6);
  const targetWeekEnd = addDays(targetWeekStart, 6);
  const offsetDays = daysBetween(sourceWeekStart, targetWeekStart);

  const { data: sourceWorkouts } = await supabase
    .from("scheduled_workouts")
    .select(
      "id, scheduled_date, title, workout_type, day_label, session_slot, notes_from_coach, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, pace_percent_basis, pace_percent_min, pace_percent_max, planned_volume_percent, planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max",
    )
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .gte("scheduled_date", sourceWeekStart)
    .lte("scheduled_date", sourceWeekEnd)
    .returns<CopySourceWorkoutRow[]>();
  if (!sourceWorkouts || sourceWorkouts.length === 0) return { error: "Nothing to copy in that week yet." };

  const { data: targetWorkouts } = await supabase
    .from("scheduled_workouts")
    .select("scheduled_date")
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .gte("scheduled_date", targetWeekStart)
    .lte("scheduled_date", targetWeekEnd)
    .returns<{ scheduled_date: string }[]>();
  const occupiedDates = new Set((targetWorkouts ?? []).map((w) => w.scheduled_date));

  const toCopy = sourceWorkouts.filter((w) => !occupiedDates.has(addDays(w.scheduled_date, offsetDays)));
  const skippedDates = sourceWorkouts
    .filter((w) => occupiedDates.has(addDays(w.scheduled_date, offsetDays)))
    .map((w) => addDays(w.scheduled_date, offsetDays));
  if (toCopy.length === 0) return { error: "Every day in that week already has a workout.", skippedDates };

  const sourceIds = toCopy.map((w) => w.id);
  const [{ data: sourceSteps }, { data: sourceExtras }] = await Promise.all([
    supabase
      .from("scheduled_workout_steps")
      .select(
        "scheduled_workout_id, step_type, duration_s, duration_max_s, distance_m, distance_max_m, target_type, target_min, target_max, target_unit, target_pace_reference, target_pace_percent_basis, target_pace_percent_min, target_pace_percent_max, repetitions, repetitions_max, rest_s, rest_max_s, instructions",
      )
      .in("scheduled_workout_id", sourceIds)
      .order("step_order")
      .returns<(ExistingStepRow & { scheduled_workout_id: string })[]>(),
    supabase
      .from("scheduled_workout_extras")
      .select("scheduled_workout_id, kind, overview, count, distance_m, duration_s, items")
      .in("scheduled_workout_id", sourceIds)
      .order("extra_order")
      .returns<(ExistingExtraRow & { scheduled_workout_id: string })[]>(),
  ]);

  const admin = createServiceRoleClient();
  let copiedCount = 0;
  for (const source of toCopy) {
    const { data: inserted, error } = await supabase
      .from("scheduled_workouts")
      .insert({
        athlete_id: athleteId,
        coach_id: session.userId,
        scheduled_date: addDays(source.scheduled_date, offsetDays),
        title: source.title,
        workout_type: source.workout_type,
        day_label: source.day_label,
        session_slot: source.session_slot,
        notes_from_coach: source.notes_from_coach,
        planned_distance_m: source.planned_distance_m,
        planned_distance_max_m: source.planned_distance_max_m,
        planned_duration_s: source.planned_duration_s,
        planned_duration_max_s: source.planned_duration_max_s,
        planned_pace_s_per_mi: source.planned_pace_s_per_mi,
        planned_pace_max_s_per_mi: source.planned_pace_max_s_per_mi,
        pace_reference: source.pace_reference,
        pace_percent_basis: source.pace_percent_basis,
        pace_percent_min: source.pace_percent_min,
        pace_percent_max: source.pace_percent_max,
        planned_volume_percent: source.planned_volume_percent,
        planned_hr_bpm: source.planned_hr_bpm,
        planned_hr_max_bpm: source.planned_hr_max_bpm,
        planned_rpe: source.planned_rpe,
        planned_rpe_max: source.planned_rpe_max,
        published_at: null,
      })
      .select("id")
      .single();
    if (error || !inserted) continue; // best-effort -- one bad row shouldn't abort the rest of the week

    const newWorkoutId = inserted.id;
    const steps = (sourceSteps ?? []).filter((s) => s.scheduled_workout_id === source.id);
    if (steps.length > 0) {
      await supabase.from("scheduled_workout_steps").insert(
        steps.map((step, index) => ({
          scheduled_workout_id: newWorkoutId,
          step_order: index,
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
    }
    const extras = (sourceExtras ?? []).filter((e) => e.scheduled_workout_id === source.id);
    if (extras.length > 0) {
      await supabase.from("scheduled_workout_extras").insert(
        extras.map((extra, index) => ({
          scheduled_workout_id: newWorkoutId,
          extra_order: index,
          kind: extra.kind,
          overview: extra.overview,
          count: extra.count,
          distance_m: extra.distance_m,
          duration_s: extra.duration_s,
          items: extra.items,
        })),
      );
    }

    await admin.from("audit_log").insert({
      actor_id: session.userId,
      action: "workout_created",
      entity_type: "scheduled_workouts",
      entity_id: newWorkoutId,
      metadata: { athlete_id: athleteId, copied_from: source.id, source_week: sourceWeekStart, target_week: targetWeekStart },
    });
    copiedCount += 1;
  }

  // Carry the source week's own title/target-volume over too, but only if
  // the target week doesn't already have one set -- never overwrite a
  // week plan the coach already wrote for the target week, same
  // never-clobber rule as the per-day skip above.
  const { data: sourceWeekPlan } = await supabase
    .from("training_week_plans")
    .select("label, target_volume_min, target_volume_max, target_volume_unit")
    .eq("athlete_id", athleteId)
    .eq("week_start", sourceWeekStart)
    .maybeSingle<{ label: string | null; target_volume_min: number | null; target_volume_max: number | null; target_volume_unit: "miles" | "minutes" | null }>();
  if (sourceWeekPlan) {
    const { data: existingTargetPlan } = await supabase
      .from("training_week_plans")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("week_start", targetWeekStart)
      .maybeSingle();
    if (!existingTargetPlan) {
      await supabase.from("training_week_plans").upsert(
        {
          athlete_id: athleteId,
          coach_id: session.userId,
          week_start: targetWeekStart,
          label: sourceWeekPlan.label,
          target_volume_min: sourceWeekPlan.target_volume_min,
          target_volume_max: sourceWeekPlan.target_volume_max,
          target_volume_unit: sourceWeekPlan.target_volume_unit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "athlete_id,week_start" },
      );
    }
  }

  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return { copiedCount, skippedDates };
}

export type WeekPlanInput = {
  athleteId: string;
  weekStart: string; // the Monday date this plan describes
  label: string | null;
  targetVolumeMin: number | null;
  targetVolumeMax: number | null;
  targetVolumeUnit: "miles" | "minutes" | null;
};

// A week's title/target-volume range is its own small entity
// (training_week_plans), unique on (athlete_id, week_start) -- see the
// migration's own comment on why coach_id is deliberately excluded from
// that uniqueness key (a coach change updates the same row, not a second
// competing one).
export async function saveWeekPlan(input: WeekPlanInput): Promise<{ error?: string }> {
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

  const { error } = await supabase.from("training_week_plans").upsert(
    {
      athlete_id: input.athleteId,
      coach_id: session.userId,
      week_start: input.weekStart,
      label: input.label,
      target_volume_min: input.targetVolumeMin,
      target_volume_max: input.targetVolumeMax,
      target_volume_unit: input.targetVolumeUnit,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id,week_start" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/coaching/athletes/${input.athleteId}/schedule`);
  return {};
}

export type PhaseInput = {
  id?: string;
  athleteId: string;
  phaseType: string;
  name: string | null;
  startDate: string;
  endDate: string;
  goalId: string | null;
  notes: string | null;
  // The athlete's own copy of "why this phase." Editable here so a coach
  // can correct one athlete's explanation directly, without touching the
  // Program it was copied from (see phase-explainers.ts).
  explainer: string | null;
};

type ExistingPhaseRangeRow = { id: string; start_date: string; end_date: string };

// Explicit, coach-defined training phases -- see the training_phases
// migration's own comment. Overlap is checked here first for a real error
// message (same "validate here, DB is the backstop" pattern as
// validateDistanceRange etc.), with the database's own exclusion
// constraint as the real backstop if this check is ever bypassed.
export async function savePhase(input: PhaseInput): Promise<{ error?: string; id?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (!input.phaseType.trim()) return { error: "Give this phase a type." };
  if (!input.startDate || !input.endDate) return { error: "Pick a start and end date." };
  if (input.endDate < input.startDate) return { error: "End date can't be before the start date." };

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

  const { data: existingPhases } = await supabase
    .from("training_phases")
    .select("id, start_date, end_date")
    .eq("athlete_id", input.athleteId)
    .returns<ExistingPhaseRangeRow[]>();
  const overlaps = (existingPhases ?? []).some(
    (p) => p.id !== input.id && input.startDate <= p.end_date && input.endDate >= p.start_date,
  );
  if (overlaps) return { error: "This date range overlaps an existing phase for this athlete." };

  const fields = {
    athlete_id: input.athleteId,
    coach_id: session.userId,
    phase_type: input.phaseType.trim(),
    name: input.name?.trim() || null,
    start_date: input.startDate,
    end_date: input.endDate,
    goal_id: input.goalId,
    notes: input.notes?.trim() || null,
    explainer: input.explainer?.trim() || null,
  };

  let phaseId = input.id;
  if (phaseId) {
    const { error } = await supabase
      .from("training_phases")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", phaseId)
      .eq("coach_id", session.userId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("training_phases").insert(fields).select("id").single();
    if (error) return { error: error.message };
    phaseId = data.id;
  }

  revalidatePath(`/coaching/athletes/${input.athleteId}/schedule`);
  return { id: phaseId };
}

export async function deletePhase(phaseId: string, athleteId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("training_phases").delete().eq("id", phaseId).eq("coach_id", session.userId);
  if (error) return { error: error.message };

  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return {};
}

export type ClearPhaseTrainingResult = { error?: string; clearedWorkouts?: number; clearedWeekPlans?: number };

// Deletes every scheduled_workouts and training_week_plans row inside this
// phase's date range, AND the phase itself -- a genuine "undo this block
// and start over" operation, for a coach or self-coach who wants to
// re-import or hand-build the same stretch of the calendar from scratch.
// Deliberately more thorough than deletePhase above, which only removes
// the phase's own roadmap label and leaves the real training underneath it
// untouched (a real, load-bearing distinction elsewhere: a phase is just
// an organizational overlay over real training_week_plans/
// scheduled_workouts rows, see training-phases.ts's own comment) -- that
// narrower behavior stays exactly as it is for whoever wants only that.
// This also has to remove the phase row itself, not just its contents:
// importTrainingPlanTrack's own overlap check would otherwise block a
// re-import into the same date range even after the training inside it is
// gone.
export async function clearPhaseTraining(phaseId: string, athleteId: string): Promise<ClearPhaseTrainingResult> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: phase } = await supabase
    .from("training_phases")
    .select("id, start_date, end_date")
    .eq("id", phaseId)
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .maybeSingle<{ id: string; start_date: string; end_date: string }>();
  if (!phase) return { error: "Couldn't find that phase." };

  const { data: deletedWorkouts, error: workoutsError } = await supabase
    .from("scheduled_workouts")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .gte("scheduled_date", phase.start_date)
    .lte("scheduled_date", phase.end_date)
    .select("id");
  if (workoutsError) return { error: workoutsError.message };

  const weeks = mondaysInRange(phase.start_date, phase.end_date);
  const { data: deletedWeekPlans, error: weekPlansError } = weeks.length
    ? await supabase.from("training_week_plans").delete().eq("athlete_id", athleteId).in("week_start", weeks).select("id")
    : { data: [] as { id: string }[], error: null };
  if (weekPlansError) return { error: weekPlansError.message };

  const { error: phaseError } = await supabase
    .from("training_phases")
    .delete()
    .eq("id", phaseId)
    .eq("coach_id", session.userId);
  if (phaseError) return { error: phaseError.message };

  try {
    const admin = createServiceRoleClient();
    await admin.from("audit_log").insert({
      actor_id: session.userId,
      action: "training_phase_cleared",
      entity_type: "training_phases",
      entity_id: phaseId,
      metadata: {
        athleteId,
        clearedWorkouts: deletedWorkouts?.length ?? 0,
        clearedWeekPlans: deletedWeekPlans?.length ?? 0,
      },
    });
  } catch {
    // non-fatal -- see the identical comment on shiftPhaseDates above
  }

  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return { clearedWorkouts: deletedWorkouts?.length ?? 0, clearedWeekPlans: deletedWeekPlans?.length ?? 0 };
}

export type ShiftPhaseResult = {
  error?: string;
  shiftedWorkouts?: number;
  shiftedWeekPlans?: number;
  skippedWeekPlans?: string[];
};

// Nudges an entire phase -- and everything scheduled inside it -- forward
// or backward by whole weeks, for the real "I built this out against the
// wrong week" mistake (importing or hand-building a full phase, then
// realizing it actually needed to start a week later/earlier). A single
// workout already has drag/Move (rescheduleWorkout above); this is the
// bulk equivalent for a whole phase at once. Always a multiple of 7 days
// so every shifted date keeps its day-of-week and every shifted
// training_week_plans row stays Monday-aligned.
export async function shiftPhaseDates(phaseId: string, athleteId: string, weeks: number): Promise<ShiftPhaseResult> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (!Number.isInteger(weeks) || weeks === 0) return { error: "Enter a non-zero number of weeks." };

  const supabase = await createClient();
  const { data: phase } = await supabase
    .from("training_phases")
    .select("id, start_date, end_date")
    .eq("id", phaseId)
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .maybeSingle<{ id: string; start_date: string; end_date: string }>();
  if (!phase) return { error: "Couldn't find that phase." };

  const deltaDays = weeks * 7;
  const newStartDate = addDays(phase.start_date, deltaDays);
  const newEndDate = addDays(phase.end_date, deltaDays);

  // Same overlap guard savePhase already runs before writing a phase's own
  // date range -- shifting just arrives at a new range a different way.
  const { data: existingPhases } = await supabase
    .from("training_phases")
    .select("id, start_date, end_date")
    .eq("athlete_id", athleteId)
    .returns<ExistingPhaseRangeRow[]>();
  const overlaps = (existingPhases ?? []).some(
    (p) => p.id !== phaseId && newStartDate <= p.end_date && newEndDate >= p.start_date,
  );
  if (overlaps) return { error: "Shifting by that many weeks would overlap another phase for this athlete." };

  // Every scheduled_workouts row inside the phase's OLD range moves by the
  // same delta -- fetched and updated one row at a time (no arithmetic
  // UPDATE available through the Supabase client), mirroring copyWeek's own
  // per-row loop shape. No occupancy check needed (unlike copyWeek's own
  // never-clobber rule for a *new* row): this moves each row's own date
  // rather than writing on top of one that might exist, and this table has
  // no per-date uniqueness constraint (multiple workouts already coexist on
  // one date via session_slot).
  const { data: workoutRows } = await supabase
    .from("scheduled_workouts")
    .select("id, scheduled_date")
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .gte("scheduled_date", phase.start_date)
    .lte("scheduled_date", phase.end_date)
    .returns<{ id: string; scheduled_date: string }[]>();

  // .select("id") makes a zero-row match (RLS silently filtering the row,
  // not a thrown error) observable and countable -- same reasoning as
  // rescheduleWorkout's own identical comment above: without it, a no-op
  // update would be counted as a success with nothing to show for it.
  let shiftedWorkouts = 0;
  for (const row of workoutRows ?? []) {
    const { data: updated } = await supabase
      .from("scheduled_workouts")
      .update({ scheduled_date: addDays(row.scheduled_date, deltaDays), updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .select("id");
    if (updated && updated.length > 0) shiftedWorkouts += 1;
  }

  // training_week_plans has a real unique(athlete_id, week_start)
  // constraint, so this is best-effort per row -- a week this phase shifts
  // into might already carry an unrelated plan (an Unphased week, or a
  // neighboring phase's own week), same never-clobber convention as
  // importTrainingPlanTrack's own week-plan writes: report what got
  // skipped rather than erroring the whole shift out. Processed in the
  // direction each row vacates its old slot before another row needs to
  // move into it -- descending source order for a forward shift (the
  // latest week moves out of range first), ascending for a backward shift
  // -- so the shift's own rows never spuriously collide with each other
  // through that same unique constraint mid-loop.
  const oldWeeks = mondaysInRange(phase.start_date, phase.end_date);
  const { data: weekPlanRowsRaw } = oldWeeks.length
    ? await supabase
        .from("training_week_plans")
        .select("id, week_start")
        .eq("athlete_id", athleteId)
        .in("week_start", oldWeeks)
        .returns<{ id: string; week_start: string }[]>()
    : { data: [] as { id: string; week_start: string }[] };
  const weekPlanRows = [...(weekPlanRowsRaw ?? [])].sort((a, b) =>
    deltaDays > 0 ? b.week_start.localeCompare(a.week_start) : a.week_start.localeCompare(b.week_start),
  );

  let shiftedWeekPlans = 0;
  const skippedWeekPlans: string[] = [];
  for (const row of weekPlanRows) {
    const { data: updated, error } = await supabase
      .from("training_week_plans")
      .update({ week_start: addDays(row.week_start, deltaDays), updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .select("id");
    if (error || !updated || updated.length === 0) skippedWeekPlans.push(row.week_start);
    else shiftedWeekPlans += 1;
  }

  const { data: phaseUpdated, error: phaseError } = await supabase
    .from("training_phases")
    .update({ start_date: newStartDate, end_date: newEndDate, updated_at: new Date().toISOString() })
    .eq("id", phaseId)
    .eq("coach_id", session.userId)
    .select("id");
  if (phaseError) return { error: phaseError.message };
  if (!phaseUpdated || phaseUpdated.length === 0) return { error: "Couldn't update this phase's own dates." };

  // Best-effort: a failure writing the audit-log entry must never hide the
  // real writes above or block the revalidation that makes them visible --
  // it's a record of what happened, not a precondition for it.
  try {
    const admin = createServiceRoleClient();
    await admin.from("audit_log").insert({
      actor_id: session.userId,
      action: "training_phase_shifted",
      entity_type: "training_phases",
      entity_id: phaseId,
      metadata: { athleteId, weeks, oldStartDate: phase.start_date, newStartDate, shiftedWorkouts, shiftedWeekPlans },
    });
  } catch {
    // non-fatal -- see comment above
  }

  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return { shiftedWorkouts, shiftedWeekPlans, skippedWeekPlans: skippedWeekPlans.length ? skippedWeekPlans : undefined };
}

export type RescalePhaseResult = {
  error?: string;
  scaledWorkouts?: number;
  scaledWeekPlans?: number;
  oldPeakWeeklyMiles?: number;
  newPeakWeeklyMiles?: number;
};

// Recomputes every workout's planned distance inside an imported plan-track
// phase to hit a corrected peak weekly mileage -- the real "the template
// got imported at the wrong peak" fix. Re-derives which plan (track +
// duration) this phase came from purely from its own phase_type + real
// week count (there's no stored trackKey/durationWeeks on training_phases
// -- see the plan-import.ts comment this mirrors), then re-runs
// resolvePlanImport against that ORIGINAL template at the new target peak
// and writes only the distance fields back onto the existing rows, matched
// by date + session slot. Deliberately NOT a "multiply the current stored
// distance by a ratio" operation: that approach was tried first and found
// to compound drift whenever a phase's stored numbers had already stopped
// being a clean proportional scale of the template (a hand-edited day, a
// stale week-plan label, a prior partial write) -- recomputing from the
// pure template every time is idempotent and always matches what the
// public Training Plans page itself would show for the same target peak.
// Only distance changes -- pace targets (percent-of-race-pace) and HR
// ceilings (percent-of-HRR) are independent of weekly volume and are never
// touched, and any hand-edited day_label/notes_from_coach survives too.
export async function rescalePhaseMileage(phaseId: string, athleteId: string, newPeakWeeklyMiles: number): Promise<RescalePhaseResult> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (!Number.isFinite(newPeakWeeklyMiles) || newPeakWeeklyMiles <= 0) {
    return { error: "Enter a target peak weekly mileage greater than 0." };
  }

  const supabase = await createClient();
  const { data: phase } = await supabase
    .from("training_phases")
    .select("id, start_date, end_date, phase_type")
    .eq("id", phaseId)
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .maybeSingle<{ id: string; start_date: string; end_date: string; phase_type: string }>();
  if (!phase) return { error: "Couldn't find that phase." };

  // Recomputed fresh from the plan's own original template every time --
  // NOT by nudging whatever the phase's current stored distances happen to
  // be, which can drift out of a clean proportional scale after enough
  // unrelated hand-edits (a single day tweaked, a week-plan label edited
  // independently via the quick-edit modal). This guarantees a rescale
  // here always lands on exactly the numbers the public Training Plans
  // page itself would show for the same target peak (same
  // scaleForTargetPeak/scaleDistance math, training-plans/template.ts),
  // regardless of the phase's current state. Only works for a phase that's
  // actually a real imported plan track -- re-derived here from its own
  // type + real week count, since nothing on training_phases stores which
  // track/duration it came from (see this function's own header comment).
  const weekCount = mondaysInRange(phase.start_date, phase.end_date).length;
  const plan = TRAINING_PLANS.find((p) => p.trackLabel === phase.phase_type && p.durationWeeks === weekCount);
  if (!plan) {
    return {
      error: "This phase's type or length doesn't match a known plan track, so its mileage can't be recomputed from the original template.",
    };
  }

  // athleteInputs is intentionally all-null: pace/HR targets are a
  // completely separate axis from weekly volume (see this function's own
  // header comment) and must never be reset by a mileage-only fix.
  const resolved = resolvePlanImport(plan, newPeakWeeklyMiles, phase.start_date, {
    restingHr: null,
    maxHr: null,
    fiveKPaceSPerMi: null,
    marathonPaceSPerMi: null,
  });
  const resolvedByKey = new Map(resolved.days.map((d) => [`${d.scheduledDate}|${d.sessionSlot}`, d]));

  const { data: workoutRowsRaw } = await supabase
    .from("scheduled_workouts")
    .select("id, scheduled_date, session_slot")
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .gte("scheduled_date", phase.start_date)
    .lte("scheduled_date", phase.end_date)
    .returns<{ id: string; scheduled_date: string; session_slot: string | null }[]>();
  const workoutRows = workoutRowsRaw ?? [];

  // Matched back to its regenerated counterpart by exact date + session
  // slot (import always writes exactly one row per date/slot -- see
  // plan-import.ts's own resolveDay; a stored null slot from before this
  // session's AM-default fix is treated the same as "AM" here). Only the
  // distance fields are overwritten -- day_label, notes_from_coach, and
  // any pace/HR targets stay exactly as they are now, since a coach may
  // have hand-edited any of those since the original import. A day with
  // no match (the coach added it by hand, outside the template, or the
  // template calls for a rest day there) is left untouched.
  let scaledWorkouts = 0;
  const newMetersByWeek = new Map<string, number>();
  for (const row of workoutRows) {
    const target = resolvedByKey.get(`${row.scheduled_date}|${row.session_slot ?? "AM"}`);
    if (!target) continue;
    const { data: updated } = await supabase
      .from("scheduled_workouts")
      .update({
        planned_distance_m: target.plannedDistanceM,
        planned_distance_max_m: target.plannedDistanceMaxM,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select("id");
    if (updated && updated.length > 0) {
      scaledWorkouts += 1;
      const weekStart = mostRecentMonday(new Date(`${row.scheduled_date}T00:00:00Z`));
      const meters = target.plannedDistanceMaxM ?? target.plannedDistanceM ?? 0;
      newMetersByWeek.set(weekStart, (newMetersByWeek.get(weekStart) ?? 0) + meters);
    }
  }
  if (scaledWorkouts === 0) {
    return { error: "None of this phase's workouts could be matched back to the original template -- nothing was rescaled." };
  }

  // Every existing week-plan row in range gets its label FORCE-SET to that
  // week's real, just-scaled workout total -- an overwrite, not a multiply
  // -- so a label that had already drifted from the actual workouts gets
  // corrected here too, instead of the drift silently surviving this
  // rescale (a plain *scale multiply would leave an already-wrong label
  // exactly as wrong, and would never self-correct on a later rescale
  // whose own scale factor works out to ~1.0 because the workouts, unlike
  // the label, were already right). Skips a week whose target is
  // genuinely minutes-based (cross-training, not mileage) rather than
  // forcing a unit conversion that isn't this feature's job, and skips a
  // week with no scaled workouts in it (nothing to reflect).
  const weeks = mondaysInRange(phase.start_date, phase.end_date);
  const { data: weekPlanRows } = weeks.length
    ? await supabase
        .from("training_week_plans")
        .select("id, week_start, target_volume_unit")
        .eq("athlete_id", athleteId)
        .in("week_start", weeks)
        .returns<{ id: string; week_start: string; target_volume_unit: "miles" | "minutes" | null }[]>()
    : { data: [] as { id: string; week_start: string; target_volume_unit: "miles" | "minutes" | null }[] };

  let scaledWeekPlans = 0;
  for (const row of weekPlanRows ?? []) {
    if (row.target_volume_unit === "minutes") continue;
    const meters = newMetersByWeek.get(row.week_start);
    if (meters == null) continue;
    const { data: updated } = await supabase
      .from("training_week_plans")
      .update({
        target_volume_min: Math.round(meters / MILE_METERS),
        target_volume_max: null,
        target_volume_unit: "miles",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select("id");
    if (updated && updated.length > 0) scaledWeekPlans += 1;
  }

  // Best-effort: a failure writing the audit-log entry must never hide the
  // real writes above or block the revalidation that makes them visible --
  // it's a record of what happened, not a precondition for it.
  try {
    const admin = createServiceRoleClient();
    await admin.from("audit_log").insert({
      actor_id: session.userId,
      action: "training_phase_rescaled",
      entity_type: "training_phases",
      entity_id: phaseId,
      metadata: { athleteId, referencePeakWeeklyMiles: plan.referencePeakWeeklyMiles, newPeakWeeklyMiles, scaledWorkouts, scaledWeekPlans },
    });
  } catch {
    // non-fatal -- see comment above
  }

  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return {
    scaledWorkouts,
    scaledWeekPlans,
    // The plan's own original reference peak (as-authored, before any
    // scaling) -- a stable, well-defined number, unlike "whatever this
    // phase's stored distances currently sum to," which is exactly the
    // value this function no longer trusts.
    oldPeakWeeklyMiles: Math.round(plan.referencePeakWeeklyMiles * 10) / 10,
    newPeakWeeklyMiles,
  };
}

export type ClearAllTrainingResult = {
  error?: string;
  clearedWorkouts?: number;
  clearedWeekPlans?: number;
  clearedPhases?: number;
};

// The full "start over" button -- deletes every scheduled_workouts,
// training_week_plans, and training_phases row for this athlete, no date
// range, no exceptions. For a coach (or self-coached athlete) who wants a
// completely clean calendar rather than clearing one phase at a time via
// clearPhaseTraining above. Genuinely unbounded on purpose: a partial
// clear here would leave the coach guessing what's actually left, which
// defeats the point of a "start over" action.
export async function clearAllTraining(athleteId: string): Promise<ClearAllTrainingResult> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const { data: deletedWorkouts, error: workoutsError } = await supabase
    .from("scheduled_workouts")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .select("id");
  if (workoutsError) return { error: workoutsError.message };

  const { data: deletedWeekPlans, error: weekPlansError } = await supabase
    .from("training_week_plans")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .select("id");
  if (weekPlansError) return { error: weekPlansError.message };

  const { data: deletedPhases, error: phasesError } = await supabase
    .from("training_phases")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .select("id");
  if (phasesError) return { error: phasesError.message };

  try {
    const admin = createServiceRoleClient();
    await admin.from("audit_log").insert({
      actor_id: session.userId,
      action: "training_all_cleared",
      entity_type: "scheduled_workouts",
      entity_id: null,
      metadata: {
        athleteId,
        clearedWorkouts: deletedWorkouts?.length ?? 0,
        clearedWeekPlans: deletedWeekPlans?.length ?? 0,
        clearedPhases: deletedPhases?.length ?? 0,
      },
    });
  } catch {
    // non-fatal -- see the identical comment on shiftPhaseDates above
  }

  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return {
    clearedWorkouts: deletedWorkouts?.length ?? 0,
    clearedWeekPlans: deletedWeekPlans?.length ?? 0,
    clearedPhases: deletedPhases?.length ?? 0,
  };
}

export type ExtraPresetOption = {
  id: string;
  name: string;
  kind: string;
  overview: string | null;
  count: number | null;
  distanceM: number | null;
  durationS: number | null;
  items: string[];
};

export type SaveExtraPresetInput = WorkoutExtraInput & { name: string };

// The coach's own reusable extras library (coach_extra_presets) -- no
// athlete/relationship check needed at all, unlike everything else in
// this file: a preset isn't tied to any one athlete, it's the coach's own
// authoring tool, same relationship shape as workout_templates.
export async function saveExtraPreset(input: SaveExtraPresetInput): Promise<{ error?: string; id?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (!input.name.trim()) return { error: "Name this preset before saving." };
  if (!input.kind.trim()) return { error: "Give this extra a kind before saving it." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_extra_presets")
    .insert({
      coach_id: session.userId,
      name: input.name.trim(),
      kind: input.kind,
      overview: input.overview,
      count: input.count,
      distance_m: input.distanceM,
      duration_s: input.durationS,
      items: input.items,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // No revalidatePath -- presets aren't tied to any one athlete's schedule
  // route (this is the coach's own global library), and the calling
  // ExtrasEditor already shows immediate confirmation text without needing
  // a full page refresh; the new preset shows up next time the page loads.
  return { id: data.id };
}

export async function deleteExtraPreset(presetId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("coach_extra_presets").delete().eq("id", presetId).eq("coach_id", session.userId);
  if (error) return { error: error.message };

  return {};
}

export async function deleteScheduledWorkout(workoutId: string, athleteId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();

  // Read first -- deleting an unpublished draft is silent (the athlete
  // never saw it), same rule as rescheduleWorkout's own identical check
  // above; this is also the only chance to grab day_label/title since the
  // row won't exist to look up once the delete below runs.
  const { data: existingRow } = await supabase
    .from("scheduled_workouts")
    .select("published_at, day_label, title")
    .eq("id", workoutId)
    .eq("coach_id", session.userId)
    .maybeSingle<{ published_at: string | null; day_label: string | null; title: string | null }>();

  const { error } = await supabase.from("scheduled_workouts").delete().eq("id", workoutId).eq("coach_id", session.userId);
  if (error) return { error: error.message };

  const admin = createServiceRoleClient();
  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "workout_deleted",
    entity_type: "scheduled_workouts",
    entity_id: workoutId,
    metadata: { athlete_id: athleteId },
  });

  if (existingRow?.published_at) {
    const label = getWorkoutDisplayLabel(existingRow.day_label, existingRow.title);
    await createNotification({
      userId: athleteId,
      type: "workout_updated",
      content: `${label} was removed from your schedule`,
      // The workout itself is gone -- relatedEntityId null so
      // notificationHref falls back to the general /coaching landing
      // instead of linking into a now-404ing workout detail page.
      relatedEntityId: null,
    });
  }

  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return {};
}
