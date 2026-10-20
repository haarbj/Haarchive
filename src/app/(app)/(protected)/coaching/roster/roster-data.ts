import { createClient } from "@/lib/db/server";
import { todayForViewer } from "@/lib/viewer-timezone";
import { addDays, mostRecentMonday } from "@/lib/week";
import { pickClosestActiveGoal } from "@/lib/private-coaching/goal-race";
import { computeWeeklyLoad, type WeeklyLoadEntry } from "@/lib/private-coaching/weekly-load";
import type { TrainingPhase } from "@/lib/private-coaching/training-phases";
import {
  buildRosterRow,
  computeRosterAttentionBadges,
  hasActiveProgramForWeek,
  type RosterRecentCompletion,
  type RosterRow,
} from "@/lib/private-coaching/roster-row";
import { evaluateIntakeGaps } from "@/lib/private-coaching/intake-gaps";

// The data-dense roster dashboard's own batched loader -- every query
// here is fired once for the coach's WHOLE roster (.in(athleteId, ids)),
// never once per athlete, following the exact discipline
// coach-home-data.ts's own file-level comment already documents for
// Coach Home. All the actual triage/aggregation math lives in
// roster-row.ts as plain, Supabase-free functions; this file is only
// "fetch the batched rows, build a Map per athleteId, call the pure
// functions once per relationship."
//
// Scope cut, deliberate: "this week"'s planned/completed figures use
// each workout's raw planned_distance_m/planned_duration_s directly,
// not the volume-percent-resolved effective value effectiveWorkoutVolume
// produces elsewhere (week-calendar.tsx, the workout tiles) -- resolving
// volume-percent here would mean also batching training_week_plans and
// fitness-estimate lookups for a dashboard-level summary figure, real
// added query cost for a difference that only shows up for an athlete on
// a volume-percent day. A later pass can add it if that gap turns out to
// matter in practice.

// How far back completed_workouts is queried for "last logged activity"
// -- unbounded would mean this query grows forever as an athlete's
// history grows, which is exactly the kind of per-athlete-unbounded cost
// this task's own performance requirement rules out. 90 days is well
// past the 7-day attention window and generous enough that "no activity
// in 90+ days" is itself an honest, real answer (shown as "—"), not a
// gap this dashboard is failing to find.
const RECENCY_LOOKBACK_DAYS = 90;

type CoachAthleteRow = { id: string; athlete_id: string; started_at: string };
type ProfileRow = { id: string; display_name: string; avatar_url: string | null };
type PhaseRow = {
  id: string;
  athlete_id: string;
  phase_type: string;
  name: string | null;
  start_date: string;
  end_date: string;
  goal_id: string | null;
  notes: string | null;
  explainer: string | null;
  source_program_id: string | null;
  source_program_phase_definition_id: string | null;
};
type ProgramRow = { id: string; name: string };
type ScheduledWorkoutRow = {
  id: string;
  athlete_id: string;
  scheduled_date: string;
  day_label: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
  status: string;
  published_at: string | null;
};
type CompletedWorkoutRow = {
  athlete_id: string;
  scheduled_workout_id: string;
  completed_at: string;
  actual_distance_m: number | null;
  actual_duration_s: number | null;
  rpe: number | null;
};
type CheckinRow = { user_id: string; week_start: string };
type GoalRow = { id: string; user_id: string; race_name: string; goal_date: string | null; status: string };
type AthleteIntakeProfileRow = {
  user_id: string;
  training_facilities: string[] | null;
  elevation_m: number | null;
  recent_training_detail: string | null;
  running_days_per_week: number | null;
  long_run_day: string | null;
  training_background_injury_history: string | null;
};
type RaceResultExistsRow = { user_id: string };
type FitnessEstimateExistsRow = { athlete_id: string };

export async function loadRosterRows(coachId: string): Promise<RosterRow[]> {
  const supabase = await createClient();
  const today = await todayForViewer();
  const weekStart = mostRecentMonday(new Date(`${today}T00:00:00Z`));
  const weekEnd = addDays(weekStart, 6);
  const sevenDaysAgo = addDays(today, -7);
  const recencyLookback = addDays(today, -RECENCY_LOOKBACK_DAYS);
  // Covers both "this week" and the 7-day attention window in one
  // scheduled_workouts query -- weekStart is always within 6 days of
  // today, so it's always later than sevenDaysAgo; weekEnd always
  // contains today.
  const scheduledRangeStart = sevenDaysAgo < weekStart ? sevenDaysAgo : weekStart;

  const { data: relationships } = await supabase
    .from("coach_athletes")
    .select("id, athlete_id, started_at")
    .eq("coach_id", coachId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .returns<CoachAthleteRow[]>();

  if (!relationships || relationships.length === 0) return [];
  const athleteIds = relationships.map((r) => r.athlete_id);

  const [
    { data: profiles },
    { data: phaseRows },
    { data: scheduledRows },
    { data: completedRows },
    { data: checkinRows },
    { data: goalRows },
    { data: intakeProfileRows },
    { data: raceResultExistsRows },
    { data: fitnessEstimateExistsRows },
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url").in("id", athleteIds).returns<ProfileRow[]>(),
    supabase
      .from("training_phases")
      .select(
        "id, athlete_id, phase_type, name, start_date, end_date, goal_id, notes, explainer, source_program_id, source_program_phase_definition_id",
      )
      .in("athlete_id", athleteIds)
      .order("start_date", { ascending: true })
      .returns<PhaseRow[]>(),
    supabase
      .from("scheduled_workouts")
      .select(
        "id, athlete_id, scheduled_date, day_label, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_rpe, planned_rpe_max, status, published_at",
      )
      .in("athlete_id", athleteIds)
      .gte("scheduled_date", scheduledRangeStart)
      .lte("scheduled_date", weekEnd)
      .returns<ScheduledWorkoutRow[]>(),
    supabase
      .from("completed_workouts")
      .select("athlete_id, scheduled_workout_id, completed_at, actual_distance_m, actual_duration_s, rpe")
      .in("athlete_id", athleteIds)
      .gte("completed_at", `${recencyLookback}T00:00:00Z`)
      .returns<CompletedWorkoutRow[]>(),
    supabase.from("weekly_checkins").select("user_id, week_start").in("user_id", athleteIds).returns<CheckinRow[]>(),
    supabase
      .from("goals")
      .select("id, user_id, race_name, goal_date, status")
      .in("user_id", athleteIds)
      .eq("status", "active")
      .not("goal_date", "is", null)
      .returns<GoalRow[]>(),
    // The next three are only ever used for the roster's own "Intake
    // incomplete" badge (intake-gaps.ts) -- existence checks, not the
    // actual race/estimate figures, which this dashboard has no other
    // use for.
    supabase
      .from("athlete_profiles")
      .select("user_id, training_facilities, elevation_m, recent_training_detail, running_days_per_week, long_run_day, training_background_injury_history")
      .in("user_id", athleteIds)
      .returns<AthleteIntakeProfileRow[]>(),
    supabase.from("race_results").select("user_id").in("user_id", athleteIds).returns<RaceResultExistsRow[]>(),
    supabase.from("athlete_fitness_estimates").select("athlete_id").in("athlete_id", athleteIds).returns<FitnessEstimateExistsRow[]>(),
  ]);

  // Program names are a second wave: which programs to look up depends on
  // the first wave's own phase rows (their source_program_id values),
  // still exactly one query for every program name the whole roster
  // needs, never one per athlete.
  const programIds = [...new Set((phaseRows ?? []).map((p) => p.source_program_id).filter((id): id is string => id != null))];
  const { data: programRows } = programIds.length
    ? await supabase.from("training_programs").select("id, name").in("id", programIds).returns<ProgramRow[]>()
    : { data: [] as ProgramRow[] };
  const programNameById = new Map((programRows ?? []).map((p) => [p.id, p.name]));

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const avatarById = new Map((profiles ?? []).map((p) => [p.id, p.avatar_url]));

  const phasesByAthlete = new Map<string, TrainingPhase[]>();
  for (const row of phaseRows ?? []) {
    const phase: TrainingPhase = {
      id: row.id,
      athleteId: row.athlete_id,
      phaseType: row.phase_type,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      goalId: row.goal_id,
      notes: row.notes,
      explainer: row.explainer,
      sourceProgramId: row.source_program_id,
      sourceProgramPhaseDefinitionId: row.source_program_phase_definition_id,
    };
    const list = phasesByAthlete.get(row.athlete_id) ?? [];
    list.push(phase);
    phasesByAthlete.set(row.athlete_id, list);
  }

  const scheduledByAthlete = new Map<string, ScheduledWorkoutRow[]>();
  for (const row of scheduledRows ?? []) {
    const list = scheduledByAthlete.get(row.athlete_id) ?? [];
    list.push(row);
    scheduledByAthlete.set(row.athlete_id, list);
  }

  const completedByAthlete = new Map<string, CompletedWorkoutRow[]>();
  for (const row of completedRows ?? []) {
    const list = completedByAthlete.get(row.athlete_id) ?? [];
    list.push(row);
    completedByAthlete.set(row.athlete_id, list);
  }

  // Most recent check-in per athlete -- weekly_checkins has no separate
  // "submitted at" timestamp (see its own schema), so week_start is the
  // best available recency signal, the same proxy the single-athlete
  // precedent (coaching/athletes/[athleteId]/page.tsx) already uses.
  const lastCheckinByAthlete = new Map<string, string>();
  for (const row of checkinRows ?? []) {
    const current = lastCheckinByAthlete.get(row.user_id);
    if (!current || row.week_start > current) lastCheckinByAthlete.set(row.user_id, row.week_start);
  }

  const goalsByAthlete = new Map<string, GoalRow[]>();
  for (const row of goalRows ?? []) {
    const list = goalsByAthlete.get(row.user_id) ?? [];
    list.push(row);
    goalsByAthlete.set(row.user_id, list);
  }

  const intakeProfileByAthlete = new Map((intakeProfileRows ?? []).map((row) => [row.user_id, row]));
  const athleteIdsWithRaceResult = new Set((raceResultExistsRows ?? []).map((row) => row.user_id));
  const athleteIdsWithFitnessEstimate = new Set((fitnessEstimateExistsRows ?? []).map((row) => row.athlete_id));

  return relationships.map((rel) => {
    const athleteId = rel.athlete_id;
    const phases = phasesByAthlete.get(athleteId) ?? [];
    const scheduled = scheduledByAthlete.get(athleteId) ?? [];
    const completed = completedByAthlete.get(athleteId) ?? [];
    const currentPhase = phases.find((p) => weekStart >= p.startDate && weekStart <= p.endDate) ?? null;

    // Joined by scheduled_workouts.id -- unambiguous even for an athlete
    // with two sessions on the same day (an AM/PM double), unlike a
    // date-based match.
    const completionByWorkoutId = new Map(completed.map((c) => [c.scheduled_workout_id, c]));
    const scheduledByWorkoutId = new Map(scheduled.map((w) => [w.id, w]));

    const thisWeekScheduled = scheduled.filter((w) => w.scheduled_date >= weekStart && w.scheduled_date <= weekEnd);
    const thisWeekEntries: WeeklyLoadEntry[] = thisWeekScheduled.map((w) => {
      const completion = completionByWorkoutId.get(w.id) ?? null;
      return {
        dayLabel: w.day_label,
        distanceM: w.planned_distance_m,
        durationS: w.planned_duration_s,
        actualDistanceM: completion?.actual_distance_m ?? null,
        actualDurationS: completion?.actual_duration_s ?? null,
        scheduledDate: w.scheduled_date,
      };
    });
    const weeklyLoad = computeWeeklyLoad(thisWeekEntries, null, today);
    const thisWeek =
      weeklyLoad.scheduledWorkoutCount > 0
        ? {
            plannedCount: weeklyLoad.scheduledWorkoutCount,
            completedCount: weeklyLoad.completedWorkoutCount,
            plannedDistanceM: weeklyLoad.scheduledMileageM,
            completedDistanceM: weeklyLoad.completedMileageM,
          }
        : null;

    const lastActivityAt = completed.reduce<string | null>((latest, c) => (!latest || c.completed_at > latest ? c.completed_at : latest), null);

    // A completion whose own workout fell outside the batched
    // scheduled_workouts window (logged late, for a workout scheduled
    // further back than this query bothers to fetch) has no planned RPE
    // to pair against here -- isRpeNoteworthy then falls back to its
    // unprescribed threshold, a safe default, not a crash.
    const recentCompletions: RosterRecentCompletion[] = completed.map((c) => {
      const scheduledWorkout = scheduledByWorkoutId.get(c.scheduled_workout_id) ?? null;
      return {
        completedAt: c.completed_at,
        plannedRpe: scheduledWorkout?.planned_rpe ?? null,
        plannedRpeMax: scheduledWorkout?.planned_rpe_max ?? null,
        loggedRpe: c.rpe,
      };
    });

    const missedWorkoutDates = scheduled
      .filter((w) => w.status === "scheduled" && w.published_at != null && w.scheduled_date < today)
      .map((w) => w.scheduled_date);

    const hasActiveProgram = hasActiveProgramForWeek(phases, weekStart);
    const lastCheckinWeekStart = lastCheckinByAthlete.get(athleteId) ?? null;

    const intakeProfile = intakeProfileByAthlete.get(athleteId);
    const intakeGaps = evaluateIntakeGaps({
      hasGoalRace: (goalsByAthlete.get(athleteId) ?? []).length > 0,
      hasFitnessAnchor: athleteIdsWithRaceResult.has(athleteId) || athleteIdsWithFitnessEstimate.has(athleteId),
      trainingFacilities: intakeProfile?.training_facilities ?? null,
      homeAltitudeM: intakeProfile?.elevation_m ?? null,
      recentTrainingDetail: intakeProfile?.recent_training_detail ?? null,
      injuryLimitations: intakeProfile?.training_background_injury_history ?? null,
      runningDaysPerWeek: intakeProfile?.running_days_per_week ?? null,
      longRunDay: intakeProfile?.long_run_day ?? null,
    });

    const attentionBadges = computeRosterAttentionBadges({
      missedWorkoutDates,
      recentCompletions,
      scheduledWorkoutDates: scheduled.map((w) => w.scheduled_date),
      hasActiveProgram,
      lastCheckinWeekStart,
      today,
      hasIncompleteIntake: intakeGaps.missing.length > 0,
    });

    const nextRaceGoal = pickClosestActiveGoal(goalsByAthlete.get(athleteId) ?? [], today);
    const nextRace = nextRaceGoal && nextRaceGoal.goal_date != null ? { raceName: nextRaceGoal.race_name, goalDate: nextRaceGoal.goal_date } : null;

    return buildRosterRow({
      athleteId,
      coachAthleteId: rel.id,
      displayName: nameById.get(athleteId) ?? "Athlete",
      avatarUrl: avatarById.get(athleteId) ?? null,
      programName: currentPhase?.sourceProgramId ? programNameById.get(currentPhase.sourceProgramId) ?? null : null,
      phases,
      weekStart,
      thisWeek,
      lastActivityAt,
      lastCheckinWeekStart,
      nextRace,
      attentionBadges,
    });
  });
}
