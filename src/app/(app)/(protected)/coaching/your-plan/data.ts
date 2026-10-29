import type { createClient } from "@/lib/db/server";
import { mostRecentMonday, addDays } from "@/lib/week";
import { getAthleteGoalRace, type AthleteGoalRace } from "@/lib/private-coaching/goal-race";
import { getAthleteMostRecentRace } from "@/lib/private-coaching/pace-reference";
import { getAthleteFitnessEstimates, suggestFitnessEstimateFromRace, type FitnessEstimateSuggestion } from "@/lib/private-coaching/fitness-estimates";
import type { FitnessEstimateRow } from "@/app/(app)/(protected)/settings/fitness-estimates-section";
import { getPhaseForWeek, type TrainingPhase } from "@/lib/private-coaching/training-phases";
import { phaseStripPurpose, pickFirstAction, PACE_BAND_WHY, type PlanPayoffFirstAction } from "@/lib/private-coaching/plan-payoff";
import { evaluateIntakeGaps, type IntakeGapEvaluation } from "@/lib/private-coaching/intake-gaps";
import { fetchCalendarWorkouts } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-data";
import type { CalendarWorkout } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-types";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PlanPayoffPhaseStripItem = {
  id: string;
  phaseType: string;
  name: string | null;
  isCurrent: boolean;
  /** Hasn't started yet as of `today` -- rendered as "Upcoming · starts <date>" rather than the "Current" tag. Mutually exclusive with isCurrent. */
  isUpcoming: boolean;
  startDate: string;
  purpose: string | null;
};

export type PlanPayoffPaceRow = {
  key: string; // reference key, or `${basis}:${min}:${max}` for a percent band
  label: string;
  rangeText: string; // formatted, e.g. "8:45-9:15/mi" or "7:30/mi"
  sourceLabel: string;
  why: string | null;
};

export type PlanPayoffData = {
  athleteId: string;
  today: string;

  goalRace: AthleteGoalRace | null;

  program: { name: string; totalWeeks: number } | null;
  phaseStrip: PlanPayoffPhaseStripItem[];

  /** Null means neither a race result nor a fitness estimate exists at all -- the inline race-result remedy renders in place of a table. */
  paceRows: PlanPayoffPaceRow[] | null;
  hasFitnessAnchor: boolean;

  /** The athlete's own self-reported 5K/marathon estimates (athlete_fitness_estimates), for the "Your current fitness estimate" block -- distinct from paceRows, which only ever shows a reference THIS WEEK's workouts actually use. */
  fitnessEstimateRows: FitnessEstimateRow[];
  /** "Recompute from your race" offers, resolved the same way resolvePaceReference already is -- empty when no race is on file. */
  fitnessEstimateSuggestions: Partial<Record<"5k" | "marathon", FitnessEstimateSuggestion>>;

  /** Only meaningful when `program` is set (a Program-sourced phase is live) -- distinguishes "assigned, but not yet published" (weekWorkouts empty because every workout in the program's own range is still a draft) from everything else. A freehand (non-Program) phase has no "unpublished" state, so this stays true whenever `program` is null -- see phaseStrip for what actually governs the empty state now. */
  programPublished: boolean;

  weekStart: string;
  weekWorkouts: CalendarWorkout[];
  /** training_week_plans.notes for weekStart -- the same coach-authored note Week View's own WeekPlanEditor shows under its heading. */
  weekNotes: string | null;

  firstAction: PlanPayoffFirstAction;

  intakeGaps: IntakeGapEvaluation;
};

type IntakeProfileRow = {
  training_facilities: string[] | null;
  elevation_m: number | null;
  recent_training_detail: string | null;
  running_days_per_week: number | null;
  long_run_day: string | null;
  training_background_injury_history: string | null;
};

function paceReferenceLabel(key: PaceReferenceKey): string {
  const labels: Record<PaceReferenceKey, string> = {
    easy: "Easy Pace",
    steady: "Steady Pace",
    tempo: "Tempo Pace",
    interval: "Interval Pace",
    "5k": "5K Pace",
    "10k": "10K Pace",
    half: "Half Marathon Pace",
    marathon: "Marathon Pace",
  };
  return labels[key];
}

function formatRangeFromSPerMi(minSPerMi: number, maxSPerMi: number | null): string {
  const formatOne = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };
  return maxSPerMi != null && maxSPerMi !== minSPerMi
    ? `${formatOne(minSPerMi)}-${formatOne(maxSPerMi)}/mi`
    : `${formatOne(minSPerMi)}/mi`;
}

// Built directly from this week's already-resolved CalendarWorkout rows
// (calendar-data.ts's own resolvePaceReference/resolvePacePercent calls,
// same ones the schedule itself renders from) -- never a second
// resolution path, which is what guarantees these values can't drift
// from what the schedule shows for the same athlete. Deduplicated by
// reference key / percent band so a week with three easy runs shows
// "Easy Pace" once.
export function buildPaceRowsFromWorkouts(workouts: CalendarWorkout[]): PlanPayoffPaceRow[] {
  const rows = new Map<string, PlanPayoffPaceRow>();

  for (const w of workouts) {
    if (w.resolvedPaceMinSPerMi == null) continue;

    if (w.paceReference) {
      const key = w.paceReference;
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          label: paceReferenceLabel(w.paceReference),
          rangeText: formatRangeFromSPerMi(w.resolvedPaceMinSPerMi, w.resolvedPaceMaxSPerMi),
          sourceLabel: w.paceReferenceSourceLabel ?? "",
          why: PACE_BAND_WHY[w.paceReference] ?? null,
        });
      }
    } else if (w.pacePercentBasis && w.pacePercentMin != null) {
      const key = `${w.pacePercentBasis}:${w.pacePercentMin}:${w.pacePercentMax ?? w.pacePercentMin}`;
      if (!rows.has(key)) {
        const percentText = w.pacePercentMax != null && w.pacePercentMax !== w.pacePercentMin ? `${w.pacePercentMin}-${w.pacePercentMax}%` : `${w.pacePercentMin}%`;
        rows.set(key, {
          key,
          label: `${percentText} ${paceReferenceLabel(w.pacePercentBasis)}`,
          rangeText: formatRangeFromSPerMi(w.resolvedPaceMinSPerMi, w.resolvedPaceMaxSPerMi),
          sourceLabel: w.paceReferenceSourceLabel ?? "",
          why: PACE_BAND_WHY[w.pacePercentBasis] ?? null,
        });
      }
    }
  }

  return [...rows.values()];
}

// The "Your program" card's own phase set: every phase not yet fully
// over as of `today` (its end date hasn't passed), active or still to
// come -- Program-sourced or freehand, it doesn't matter here (only the
// "<program name> · N weeks" heading itself cares about that
// distinction; see loadPlanPayoffData's own comment). A fully completed
// phase with nothing current or upcoming has no place on this small
// home-page card (the full history lives on /coaching/training's
// roadmap), but a phase that simply hasn't started yet must never be
// treated as if it didn't exist -- that exact confusion was the
// athlete-side deep-dive's Finding 4: a real, scheduled-but-not-started
// phase rendering as "no training phases are set up yet."
export function buildPhaseStrip(phases: TrainingPhase[], currentPhase: TrainingPhase | null, today: string): PlanPayoffPhaseStripItem[] {
  return phases
    .filter((p) => p.endDate >= today)
    .map((p) => ({
      id: p.id,
      phaseType: p.phaseType,
      name: p.name,
      isCurrent: currentPhase?.id === p.id,
      isUpcoming: currentPhase?.id !== p.id && p.startDate > today,
      startDate: p.startDate,
      purpose: p.explainer?.trim() ? null : phaseStripPurpose(p.phaseType),
    }));
}

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

/**
 * Loads everything the "Your Plan" payoff view needs for one athlete,
 * resolved through the exact same functions the rest of the platform
 * already uses for goal race, pace, and the schedule -- never a second,
 * parallel resolution. `coachId` is the athlete's own active coach
 * (resolved by the caller via getActiveCoachRelationship for the real
 * athlete route, or simply the previewing coach's own id for the coach-
 * preview route) -- fetchCalendarWorkouts needs it to scope the query,
 * matching every other caller of that function.
 */
export async function loadPlanPayoffData(supabase: Supabase, athleteId: string, coachId: string, today: string): Promise<PlanPayoffData> {
  const [goalRace, { data: phaseRows }] = await Promise.all([
    getAthleteGoalRace(supabase, athleteId),
    supabase
      .from("training_phases")
      .select(
        "id, athlete_id, phase_type, name, start_date, end_date, goal_id, notes, explainer, source_program_id, source_program_phase_definition_id",
      )
      .eq("athlete_id", athleteId)
      .order("start_date")
      .returns<PhaseRow[]>(),
  ]);

  const phases: TrainingPhase[] = (phaseRows ?? []).map((p) => ({
    id: p.id,
    athleteId: p.athlete_id,
    phaseType: p.phase_type,
    name: p.name,
    startDate: p.start_date,
    endDate: p.end_date,
    goalId: p.goal_id,
    notes: p.notes,
    explainer: p.explainer,
    sourceProgramId: p.source_program_id,
    sourceProgramPhaseDefinitionId: p.source_program_phase_definition_id,
  }));

  const weekStart = mostRecentMonday(new Date(`${today}T00:00:00Z`));
  const currentPhase = getPhaseForWeek(phases, weekStart);

  // The "first assigned program": whichever sourceProgramId the current
  // phase belongs to, or (before/after any phase's own range -- e.g. the
  // payoff is opened a day before the plan technically starts) the most
  // recently started phase's program. Phases with no sourceProgramId at
  // all (a coach-authored, freehand phase, added directly via "+ Add
  // phase" on the schedule page rather than generated from a Program
  // template) have no branded program name to show -- programPhases
  // stays empty and `program` stays null for them. That used to also
  // empty out phaseStrip and trip the "no training phases" message even
  // though a real, scheduled phase existed (the athlete-side deep-dive's
  // Finding 4) -- phaseStrip is now built from every current-or-upcoming
  // phase below, Program-sourced or not, so a freehand phase still shows
  // up on the card; only the "<program name> · N weeks" heading itself
  // stays conditional on a real Program.
  const programId =
    currentPhase?.sourceProgramId ?? [...phases].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]?.sourceProgramId ?? null;
  const programPhases = programId ? phases.filter((p) => p.sourceProgramId === programId) : [];

  let program: PlanPayoffData["program"] = null;
  if (programId && programPhases.length > 0) {
    const { data: programRow } = await supabase.from("training_programs").select("name").eq("id", programId).maybeSingle<{ name: string }>();
    if (programRow) {
      const earliestStart = programPhases.reduce((min, p) => (p.startDate < min ? p.startDate : min), programPhases[0].startDate);
      const latestEnd = programPhases.reduce((max, p) => (p.endDate > max ? p.endDate : max), programPhases[0].endDate);
      const totalWeeks = Math.max(1, Math.round((new Date(`${latestEnd}T00:00:00Z`).getTime() - new Date(`${earliestStart}T00:00:00Z`).getTime()) / (7 * 86_400_000)) + 1);
      program = { name: programRow.name, totalWeeks };
    }
  }

  const phaseStrip = buildPhaseStrip(phases, currentPhase, today);

  const [race, fitnessEstimates, { data: intakeProfileRow }] = await Promise.all([
    getAthleteMostRecentRace(supabase, athleteId),
    getAthleteFitnessEstimates(supabase, athleteId),
    supabase
      .from("athlete_profiles")
      .select("training_facilities, elevation_m, recent_training_detail, running_days_per_week, long_run_day, training_background_injury_history")
      .eq("user_id", athleteId)
      .maybeSingle<IntakeProfileRow>(),
  ]);
  const hasFitnessAnchor = race != null || Object.keys(fitnessEstimates).length > 0;

  const fitnessEstimateRows: FitnessEstimateRow[] = (["5k", "marathon"] as const)
    .filter((key) => fitnessEstimates[key])
    .map((key) => {
      const estimate = fitnessEstimates[key]!;
      return { referenceKey: key, estimatedTimeS: estimate.estimatedTimeS, updatedAt: estimate.updatedAt };
    });
  const fitnessEstimateSuggestions: PlanPayoffData["fitnessEstimateSuggestions"] = {};
  for (const key of ["5k", "marathon"] as const) {
    const suggestion = suggestFitnessEstimateFromRace(key, race);
    if (suggestion) fitnessEstimateSuggestions[key] = suggestion;
  }

  const intakeGaps = evaluateIntakeGaps({
    hasGoalRace: goalRace != null,
    hasFitnessAnchor,
    trainingFacilities: intakeProfileRow?.training_facilities ?? null,
    homeAltitudeM: intakeProfileRow?.elevation_m ?? null,
    recentTrainingDetail: intakeProfileRow?.recent_training_detail ?? null,
    injuryLimitations: intakeProfileRow?.training_background_injury_history ?? null,
    runningDaysPerWeek: intakeProfileRow?.running_days_per_week ?? null,
    longRunDay: intakeProfileRow?.long_run_day ?? null,
  });

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [workoutsByDate, { data: weekPlanRow }] = await Promise.all([
    fetchCalendarWorkouts(supabase, athleteId, coachId, weekDates, today),
    supabase.from("training_week_plans").select("notes").eq("athlete_id", athleteId).eq("week_start", weekStart).maybeSingle<{ notes: string | null }>(),
  ]);
  const allWeekWorkouts = weekDates.flatMap((d) => workoutsByDate[d] ?? []);
  // Explicit filter, not a reliance on RLS -- the coach-preview route
  // queries with the coach's own session (which sees drafts too), so
  // this is what makes "what the coach previews is what the athlete
  // gets" true regardless of which session loaded the data (see this
  // function's own header comment).
  const weekWorkouts = allWeekWorkouts.filter((w) => w.publishedAt != null);

  const paceRows = hasFitnessAnchor ? buildPaceRowsFromWorkouts(weekWorkouts) : null;

  // "Assigned, not yet published": phases exist, but nothing in this
  // week is visible to the athlete yet. Checked against this week only
  // (not the whole program's range) -- cheap, and the payoff's own
  // "first week" section is scoped to this week anyway, so there's
  // nothing more this check needs to know.
  const programPublished = programPhases.length === 0 ? true : weekWorkouts.length > 0 || allWeekWorkouts.length === 0;

  const todayWorkout = weekWorkouts.find((w) => w.scheduledDate === today) ?? null;
  const nextUpcoming = weekWorkouts.filter((w) => w.scheduledDate > today).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ?? null;
  const firstAction = pickFirstAction({ todayWorkoutId: todayWorkout?.id ?? null, nextUpcomingWorkoutId: nextUpcoming?.id ?? null });

  return {
    athleteId,
    today,
    goalRace,
    program,
    phaseStrip,
    paceRows,
    hasFitnessAnchor,
    fitnessEstimateRows,
    fitnessEstimateSuggestions,
    programPublished,
    weekStart,
    weekWorkouts,
    weekNotes: weekPlanRow?.notes ?? null,
    firstAction,
    intakeGaps,
  };
}
