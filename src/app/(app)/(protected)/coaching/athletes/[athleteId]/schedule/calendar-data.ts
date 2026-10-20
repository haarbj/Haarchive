import type { createClient } from "@/lib/db/server";
import { addDays, mostRecentMonday } from "@/lib/week";
import type { StepInput } from "@/lib/private-coaching/steps";
import type { WorkoutType } from "@/lib/coaching-engine";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import { computeWorkoutStatus, getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";
import { getWorkoutPlannedDistanceM, formatCompactDistanceRange, formatDurationRange } from "@/lib/private-coaching/workout-distance";
import {
  getAthleteMostRecentRace,
  resolvePaceReference,
  type PaceReferenceKey,
  type ResolvedPaceReference,
} from "@/lib/private-coaching/pace-reference";
import { getAthleteFitnessEstimates, resolvePacePercent } from "@/lib/private-coaching/fitness-estimates";
import { resolveVolumePercent, resolvedVolumeToFields, type WeekTarget } from "@/lib/private-coaching/volume-reference";
import type { CalendarWorkout } from "./calendar-types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type WorkoutRow = {
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
  published_at: string | null;
};
type WeekTargetRow = {
  week_start: string;
  target_volume_min: number | null;
  target_volume_max: number | null;
  target_volume_unit: "miles" | "minutes" | null;
};
type ExtraRow = {
  scheduled_workout_id: string;
  kind: string;
  overview: string | null;
  count: number | null;
  distance_m: number | null;
  duration_s: number | null;
  items: string[] | null;
};
// Exported -- also reused by page.tsx for mapping workout_template_steps
// into a template's own StepInput[] (same "parent_id, step fields" shape,
// just a template_id-keyed parent rather than a scheduled_workout_id-keyed
// one), so template step-mapping doesn't duplicate this logic separately.
export type StepRow = {
  parent_id: string;
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
type CompletionRow = {
  scheduled_workout_id: string;
  actual_distance_m: number | null;
  actual_duration_s: number | null;
  strava_activity_id: number | null;
  rpe: number | null;
  athlete_notes: string | null;
  effort_level: string | null;
};

export function mapSteps(rows: StepRow[], parentId: string): StepInput[] {
  return rows
    .filter((r) => r.parent_id === parentId)
    .map((row) => ({
      stepType: row.step_type,
      durationS: row.duration_s,
      durationMaxS: row.duration_max_s,
      distanceM: row.distance_m,
      distanceMaxM: row.distance_max_m,
      targetType: row.target_type,
      targetMin: row.target_min,
      targetMax: row.target_max,
      targetUnit: row.target_unit,
      targetPaceReference: row.target_pace_reference,
      targetPacePercentBasis: row.target_pace_percent_basis,
      targetPacePercentMin: row.target_pace_percent_min,
      targetPacePercentMax: row.target_pace_percent_max,
      repetitions: row.repetitions,
      repetitionsMax: row.repetitions_max,
      restS: row.rest_s,
      restMaxS: row.rest_max_s,
      instructions: row.instructions,
    }));
}

// Every distinct Monday covered by a (possibly multi-week, e.g. Month
// View's) date list -- what fetchWeekTargets below actually needs to
// batch-fetch training_week_plans for.
function distinctWeekStarts(dates: string[]): string[] {
  return [...new Set(dates.map((d) => mostRecentMonday(new Date(`${d}T00:00:00Z`))))];
}

// One small, indexed training_week_plans query per call site (Week/Day
// View's own single week, Month View's up to six) -- self-contained, the
// same "resolve live, here, rather than trust a caller to have already
// fetched it" shape as getAthleteMostRecentRace, so this module never
// depends on a caller happening to already have the week target on hand.
async function fetchWeekTargets(supabase: Supabase, athleteId: string, weekStarts: string[]): Promise<Map<string, WeekTarget>> {
  if (weekStarts.length === 0) return new Map();
  const { data } = await supabase
    .from("training_week_plans")
    .select("week_start, target_volume_min, target_volume_max, target_volume_unit")
    .eq("athlete_id", athleteId)
    .in("week_start", weekStarts)
    .returns<WeekTargetRow[]>();
  return new Map(
    (data ?? []).map((row) => [
      row.week_start,
      { targetVolumeMin: row.target_volume_min, targetVolumeMax: row.target_volume_max, targetVolumeUnit: row.target_volume_unit },
    ]),
  );
}

// The shared workout-fetching-and-shaping layer -- extracted from what
// used to be inline in schedule/page.tsx so Week (main + adjacent
// strips), Day, and Month views all read the identical CalendarWorkout
// model instead of each view inventing its own interpretation of status/
// distance/day-label/extras/completion. `dates` is deliberately an
// explicit list, not a week/month assumption, so every caller only fetches
// the range it actually needs. Never queries strava_pending_matches --
// an unreviewed Strava match must stay indistinguishable from "no
// completion yet" on every coach-facing calendar surface.
export async function fetchCalendarWorkouts(
  supabase: Supabase,
  athleteId: string,
  coachId: string,
  dates: string[],
  today: string,
): Promise<Record<string, CalendarWorkout[]>> {
  const workoutsByDate: Record<string, CalendarWorkout[]> = Object.fromEntries(dates.map((d) => [d, []]));
  if (dates.length === 0) return workoutsByDate;

  const { data: workoutRows } = await supabase
    .from("scheduled_workouts")
    .select(
      "id, scheduled_date, title, workout_type, day_label, session_slot, notes_from_coach, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, pace_percent_basis, pace_percent_min, pace_percent_max, planned_volume_percent, planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max, published_at",
    )
    .eq("athlete_id", athleteId)
    .eq("coach_id", coachId)
    .gte("scheduled_date", dates[0])
    .lte("scheduled_date", dates[dates.length - 1])
    .returns<WorkoutRow[]>();

  const workoutIds = (workoutRows ?? []).map((w) => w.id);
  // getAthleteMostRecentRace/fetchWeekTargets both run alongside the other
  // queries even when no workout actually uses a reference/percent --
  // cheap (a handful of indexed rows), and resolving them once here
  // (rather than conditionally, which would need to inspect every row/step
  // first) keeps this function simple. See pace-reference.ts/
  // volume-reference.ts for why resolution must happen live, here, rather
  // than ever being cached on the row itself.
  const [{ data: workoutStepRows }, { data: workoutExtraRows }, { data: completionRows }, mostRecentRace, weekTargets, fitnessEstimates] = await Promise.all([
    workoutIds.length
      ? supabase
          .from("scheduled_workout_steps")
          .select(
            "scheduled_workout_id, step_type, duration_s, duration_max_s, distance_m, distance_max_m, target_type, target_min, target_max, target_unit, target_pace_reference, target_pace_percent_basis, target_pace_percent_min, target_pace_percent_max, repetitions, repetitions_max, rest_s, rest_max_s, instructions",
          )
          .in("scheduled_workout_id", workoutIds)
          .order("step_order")
      : Promise.resolve({ data: [] }),
    workoutIds.length
      ? supabase
          .from("scheduled_workout_extras")
          .select("scheduled_workout_id, kind, overview, count, distance_m, duration_s, items")
          .in("scheduled_workout_id", workoutIds)
          .order("extra_order")
          .returns<ExtraRow[]>()
      : Promise.resolve({ data: [] as ExtraRow[] }),
    workoutIds.length
      ? supabase
          .from("completed_workouts")
          .select("scheduled_workout_id, actual_distance_m, actual_duration_s, strava_activity_id, rpe, athlete_notes, effort_level")
          .in("scheduled_workout_id", workoutIds)
          .returns<CompletionRow[]>()
      : Promise.resolve({ data: [] as CompletionRow[] }),
    getAthleteMostRecentRace(supabase, athleteId),
    fetchWeekTargets(supabase, athleteId, distinctWeekStarts(dates)),
    getAthleteFitnessEstimates(supabase, athleteId),
  ]);

  const stepsByWorkout = (workoutStepRows ?? []).map((r) => ({ ...r, parent_id: r.scheduled_workout_id }) as StepRow);
  const extrasByWorkoutId = new Map<string, WorkoutExtraInput[]>();
  for (const row of workoutExtraRows ?? []) {
    const extra: WorkoutExtraInput = {
      kind: row.kind,
      overview: row.overview,
      count: row.count,
      distanceM: row.distance_m,
      durationS: row.duration_s,
      items: row.items ?? [],
    };
    const list = extrasByWorkoutId.get(row.scheduled_workout_id) ?? [];
    list.push(extra);
    extrasByWorkoutId.set(row.scheduled_workout_id, list);
  }
  const completionByWorkoutId = new Map((completionRows ?? []).map((c) => [c.scheduled_workout_id, c]));

  for (const w of workoutRows ?? []) {
    const completion = completionByWorkoutId.get(w.id) ?? null;
    // pace_reference and pace_percent_basis are mutually exclusive at the
    // DB layer -- whichever is set resolves live the same way, from a
    // different source (a race result vs. the athlete's own current
    // fitness estimate). See fitness-estimates.ts's own header comment for
    // why a percent-of-pace prescription resolves live here now, exactly
    // like pace_reference always has.
    const resolvedWorkoutPace: ResolvedPaceReference | null = w.pace_reference
      ? resolvePaceReference(w.pace_reference, mostRecentRace)
      : w.pace_percent_basis != null && w.pace_percent_min != null && w.pace_percent_max != null
        ? resolvePacePercent(w.pace_percent_basis, w.pace_percent_min, w.pace_percent_max, fitnessEstimates)
        : null;
    const weekStart = mostRecentMonday(new Date(`${w.scheduled_date}T00:00:00Z`));
    const resolvedVolume = w.planned_volume_percent != null ? resolveVolumePercent(w.planned_volume_percent, weekTargets.get(weekStart) ?? null) : null;
    const volumeFields = resolvedVolumeToFields(resolvedVolume);
    const steps = mapSteps(stepsByWorkout, w.id);
    const stepPaceReferences = steps.map((s) =>
      s.targetPaceReference
        ? resolvePaceReference(s.targetPaceReference, mostRecentRace)
        : s.targetPacePercentBasis != null && s.targetPacePercentMin != null && s.targetPacePercentMax != null
          ? resolvePacePercent(s.targetPacePercentBasis, s.targetPacePercentMin, s.targetPacePercentMax, fitnessEstimates)
          : null,
    );
    const calendarWorkout: CalendarWorkout = {
      id: w.id,
      scheduledDate: w.scheduled_date,
      title: w.title,
      workoutType: w.workout_type,
      dayLabel: w.day_label,
      sessionSlot: w.session_slot,
      extras: extrasByWorkoutId.get(w.id) ?? [],
      notesFromCoach: w.notes_from_coach,
      plannedDistanceM: w.planned_distance_m,
      plannedDistanceMaxM: w.planned_distance_max_m,
      plannedDurationS: w.planned_duration_s,
      plannedDurationMaxS: w.planned_duration_max_s,
      plannedPaceSPerMi: w.planned_pace_s_per_mi,
      plannedPaceMaxSPerMi: w.planned_pace_max_s_per_mi,
      paceReference: w.pace_reference,
      pacePercentBasis: w.pace_percent_basis,
      pacePercentMin: w.pace_percent_min,
      pacePercentMax: w.pace_percent_max,
      resolvedPaceMinSPerMi: resolvedWorkoutPace?.minSPerMi ?? null,
      resolvedPaceMaxSPerMi: resolvedWorkoutPace?.maxSPerMi ?? null,
      paceReferenceSourceLabel: resolvedWorkoutPace?.sourceLabel ?? null,
      volumePercent: w.planned_volume_percent,
      resolvedDistanceM: volumeFields.resolvedDistanceM,
      resolvedDistanceMaxM: volumeFields.resolvedDistanceMaxM,
      resolvedDurationS: volumeFields.resolvedDurationS,
      resolvedDurationMaxS: volumeFields.resolvedDurationMaxS,
      volumeSourceLabel: volumeFields.volumeSourceLabel,
      plannedHrBpm: w.planned_hr_bpm,
      plannedHrMaxBpm: w.planned_hr_max_bpm,
      plannedRpe: w.planned_rpe,
      plannedRpeMax: w.planned_rpe_max,
      steps,
      stepPaceReferences,
      publishedAt: w.published_at,
      completion: completion
        ? {
            actualDistanceM: completion.actual_distance_m,
            actualDurationS: completion.actual_duration_s,
            stravaActivityId: completion.strava_activity_id,
            rpe: completion.rpe,
            hasNotes: !!completion.athlete_notes?.trim(),
            effortLevel: completion.effort_level,
          }
        : null,
      status: computeWorkoutStatus({
        publishedAt: w.published_at,
        scheduledDate: w.scheduled_date,
        hasCompletion: completion !== null,
        today,
      }),
    };
    (workoutsByDate[w.scheduled_date] ??= []).push(calendarWorkout);
  }

  return workoutsByDate;
}

// The exact per-workout "label + a short figure" formatting shared by
// WeekStrip's adjacent-week summaries (via fetchWeekSummary below) --
// reuses the same compact distance-range formatter Month View's own
// day-cell chips use (formatCompactDistanceRange) and the same
// formatDurationRange every other calendar surface uses, so a workout
// with a real range ("6-8mi") never gets silently rounded down to a
// single point figure just because it's shown in a lighter-weight
// surface. Never a fabricated figure: a duration-only or cross-training
// workout shows its minutes, never a pace-derived distance guess.
export function summarizeWorkoutFigure(
  label: string,
  distanceM: number | null,
  distanceMaxM: number | null,
  durationS: number | null,
  durationMaxS: number | null,
): string {
  const plannedDistanceM = getWorkoutPlannedDistanceM(distanceM);
  if (plannedDistanceM != null) return `${label} ${formatCompactDistanceRange(plannedDistanceM, distanceMaxM)}`;
  if (durationS != null) return `${label} ${formatDurationRange(durationS, durationMaxS)}`;
  return label;
}

export type WeekSummaryDay = {
  date: string;
  /** e.g. "Easy 8", "XT 60min", "Off" -- never a fabricated figure, see fetchWeekSummary's own comment. */
  label: string;
};

// A deliberately much lighter query than fetchCalendarWorkouts -- day
// label + a single distance/duration figure only, no steps/extras/
// completion joins -- for WeekStrip's adjacent-week context, which needs
// to be genuinely informative (not just status dots) without approaching
// the cost of the main week's full fetch. The distance figure shown is a
// straight port of the exact value the main week footer already sums
// (planned_distance_m, i.e. a workout's own minimum/point distance) --
// never an estimate for a duration-only or cross-training day, and never
// a pace-derived conversion. A day with no scheduled workout reads "Off."
export type WeekSummary = { days: WeekSummaryDay[]; totalDistanceM: number };

export async function fetchWeekSummary(
  supabase: Supabase,
  athleteId: string,
  coachId: string,
  weekStart: string,
  weekEnd: string,
): Promise<WeekSummary> {
  type SummaryRow = {
    scheduled_date: string;
    title: string | null;
    day_label: string | null;
    planned_distance_m: number | null;
    planned_distance_max_m: number | null;
    planned_duration_s: number | null;
    planned_duration_max_s: number | null;
    planned_volume_percent: number | null;
    published_at: string | null;
  };
  const [{ data: rows }, weekTargets] = await Promise.all([
    supabase
      .from("scheduled_workouts")
      .select(
        "scheduled_date, title, day_label, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_volume_percent, published_at",
      )
      .eq("athlete_id", athleteId)
      .eq("coach_id", coachId)
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd)
      .order("scheduled_date")
      .returns<SummaryRow[]>(),
    fetchWeekTargets(supabase, athleteId, [weekStart]),
  ]);
  const weekTarget = weekTargets.get(weekStart) ?? null;

  // A volume-percent day resolves the same way fetchCalendarWorkouts
  // resolves it -- this is still a straight port of the coach's own
  // resolved prescription, never a pace-derived estimate (that's Weekly
  // Load's own, deliberately separate, Part B computation).
  function effectiveFigure(row: SummaryRow): { distanceM: number | null; distanceMaxM: number | null; durationS: number | null; durationMaxS: number | null } {
    if (row.planned_volume_percent == null) {
      return { distanceM: row.planned_distance_m, distanceMaxM: row.planned_distance_max_m, durationS: row.planned_duration_s, durationMaxS: row.planned_duration_max_s };
    }
    const fields = resolvedVolumeToFields(resolveVolumePercent(row.planned_volume_percent, weekTarget));
    return { distanceM: fields.resolvedDistanceM, distanceMaxM: fields.resolvedDistanceMaxM, durationS: fields.resolvedDurationS, durationMaxS: fields.resolvedDurationMaxS };
  }

  const byDate = new Map<string, SummaryRow[]>();
  for (const row of rows ?? []) {
    const list = byDate.get(row.scheduled_date) ?? [];
    list.push(row);
    byDate.set(row.scheduled_date, list);
  }

  const dates: string[] = [];
  let current = weekStart;
  while (current <= weekEnd) {
    dates.push(current);
    current = addDays(current, 1);
  }

  const days: WeekSummaryDay[] = dates.map((date) => {
    const dayRows = byDate.get(date) ?? [];
    if (dayRows.length === 0) return { date, label: "Off" };
    const parts = dayRows.map((w) => {
      const effective = effectiveFigure(w);
      return summarizeWorkoutFigure(getWorkoutDisplayLabel(w.day_label, w.title), effective.distanceM, effective.distanceMaxM, effective.durationS, effective.durationMaxS);
    });
    return { date, label: parts.join(" + ") };
  });

  // Must sum the exact same workout set `days` above lists -- summing
  // each workout's own minimum/point distance, a volume-percent day
  // already resolved to its real figure above -- not pace-based
  // estimation for a duration-only or XT day, that's Weekly Load's own
  // separate Part B computation. Previously filtered to published-only,
  // which disagreed with `days` (unfiltered) the moment a future week was
  // entirely drafts: the day list showed every workout's real distance
  // while this total silently summed to 0. Weekly Load's own footer
  // (weekly-load.ts) was already fixed to be publish-agnostic for the
  // same reason -- this brings fetchWeekSummary in line with it.
  const totalDistanceM = (rows ?? []).reduce((sum, w) => sum + (getWorkoutPlannedDistanceM(effectiveFigure(w).distanceM) ?? 0), 0);

  return { days, totalDistanceM };
}
