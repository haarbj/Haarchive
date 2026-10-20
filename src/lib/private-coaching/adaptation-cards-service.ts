import type { createClient } from "@/lib/db/server";
import { createNotification } from "@/lib/notifications/create-notification";
import { addDays } from "@/lib/week";
import {
  evaluateAdaptationSignals,
  fingerprintAdaptationCard,
  type AdaptationSignalResult,
  type AdaptationWorkoutRecord,
  type DisruptionWindow,
} from "@/lib/private-coaching/adaptation-signals";

// The Supabase-touching half of consent-based adaptation cards -- fetches
// an athlete's recent/upcoming workouts and declared disruption windows,
// runs the pure signal engine (adaptation-signals.ts), and owns the
// adaptation_cards row's whole lifecycle (create-or-find, accept,
// dismiss). Deliberately NOT a "use server" actions file itself, mirroring
// realignment-service.ts's own reasoning exactly: this is plain, shared
// logic both the coach-home surface and the athlete-schedule surface
// import, so the two surfaces can never drift into two separately-
// maintained copies of the same lifecycle.

type Supabase = Awaited<ReturnType<typeof createClient>>;

// A wide-enough window to cover every signal's own lookback (the going-
// quiet/fatigue windows reach back 14 days; fitness-up/plan-too-low only
// care about the N most recent qualifying workouts, however far back that
// happens to be) plus enough upcoming workouts to find a next-key-session
// or next-comparable-distance target.
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 30;

type WorkoutRow = {
  id: string;
  scheduled_date: string;
  workout_type: AdaptationWorkoutRecord["workoutType"];
  day_label: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
  is_optional: boolean;
};

type CompletionRow = {
  scheduled_workout_id: string;
  completed_at: string;
  actual_distance_m: number | null;
  rpe: number | null;
};

// Completion is its own one-row-per-workout table (completed_workouts),
// not columns on scheduled_workouts -- see calendar-data.ts's own
// fetchCalendarWorkouts for the established join-by-scheduled_workout_id
// pattern this mirrors.
async function fetchAthleteWorkouts(supabase: Supabase, athleteId: string, today: string): Promise<AdaptationWorkoutRecord[]> {
  const { data: workoutRows } = await supabase
    .from("scheduled_workouts")
    .select("id, scheduled_date, workout_type, day_label, planned_distance_m, planned_distance_max_m, planned_rpe, planned_rpe_max, is_optional")
    .eq("athlete_id", athleteId)
    .gte("scheduled_date", addDays(today, -LOOKBACK_DAYS))
    .lte("scheduled_date", addDays(today, LOOKAHEAD_DAYS))
    .returns<WorkoutRow[]>();

  const rows = workoutRows ?? [];
  const workoutIds = rows.map((w) => w.id);

  const { data: completionRows } =
    workoutIds.length > 0
      ? await supabase
          .from("completed_workouts")
          .select("scheduled_workout_id, completed_at, actual_distance_m, rpe")
          .in("scheduled_workout_id", workoutIds)
          .returns<CompletionRow[]>()
      : { data: [] as CompletionRow[] };

  const completionByWorkoutId = new Map((completionRows ?? []).map((c) => [c.scheduled_workout_id, c]));

  return rows.map((row) => {
    const completion = completionByWorkoutId.get(row.id);
    return {
      id: row.id,
      scheduledDate: row.scheduled_date,
      workoutType: row.workout_type,
      dayLabel: row.day_label,
      plannedDistanceM: row.planned_distance_m,
      plannedDistanceMaxM: row.planned_distance_max_m,
      plannedRpe: row.planned_rpe,
      plannedRpeMax: row.planned_rpe_max,
      isOptional: row.is_optional,
      completedAt: completion?.completed_at ?? null,
      actualDistanceM: completion?.actual_distance_m ?? null,
      loggedRpe: completion?.rpe ?? null,
    };
  });
}

async function fetchRealignmentWindows(supabase: Supabase, athleteId: string): Promise<DisruptionWindow[]> {
  // Any declared disruption counts, regardless of whether the coach went
  // on to accept or dismiss the resulting proposal -- the disruption
  // itself (the athlete was sick, traveling, etc.) is the real-world fact
  // "going quiet" shouldn't pile a second card on top of, independent of
  // what the coach did with the plan afterward.
  const { data } = await supabase
    .from("realignment_proposals")
    .select("disruption_start_date, disruption_end_date")
    .eq("athlete_id", athleteId)
    .returns<{ disruption_start_date: string; disruption_end_date: string }[]>();
  return (data ?? []).map((row) => ({ startDate: row.disruption_start_date, endDate: row.disruption_end_date }));
}

export type AdaptationCardRow = {
  id: string;
  athlete_id: string;
  coach_id: string;
  signal: AdaptationSignalResult["signal"];
  fingerprint: string;
  evidence: AdaptationSignalResult["evidence"];
  action: AdaptationSignalResult["action"];
  status: "pending" | "accepted" | "dismissed";
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
};

/** A dismissed card's evidence stays suppressed for this many days -- see this module's own header comment. */
export const DISMISSAL_SUPPRESSION_DAYS = 14;

/**
 * Runs the signal engine for one athlete and inserts a pending card for
 * every signal that fires and isn't currently suppressed -- skipped
 * entirely when:
 *   - a card for that (athlete, signal) is already pending (the "never a
 *     stack of duplicates" rule -- also enforced by a partial unique
 *     index at the database), or
 *   - that exact fingerprint was dismissed within the last
 *     DISMISSAL_SUPPRESSION_DAYS days.
 * Never updates or deletes an existing card -- this only ever adds new
 * pending ones, so a coach mid-review of a card never has it change
 * under them.
 */
export async function createOrRefreshAdaptationCards(supabase: Supabase, athleteId: string, coachId: string, today: string): Promise<AdaptationCardRow[]> {
  const [workouts, realignmentWindows, existing] = await Promise.all([
    fetchAthleteWorkouts(supabase, athleteId, today),
    fetchRealignmentWindows(supabase, athleteId),
    supabase.from("adaptation_cards").select("*").eq("athlete_id", athleteId).returns<AdaptationCardRow[]>(),
  ]);

  const existingRows = existing.data ?? [];
  const results = evaluateAdaptationSignals(workouts, today, realignmentWindows);

  const suppressionCutoff = addDays(today, -DISMISSAL_SUPPRESSION_DAYS);

  const toInsert: { signal: AdaptationSignalResult["signal"]; fingerprint: string; evidence: unknown; action: unknown }[] = [];
  for (const result of results) {
    const fingerprint = fingerprintAdaptationCard(athleteId, result);

    const alreadyPending = existingRows.some((row) => row.signal === result.signal && row.status === "pending");
    if (alreadyPending) continue;

    const suppressingDismissal = existingRows.some(
      (row) =>
        row.signal === result.signal &&
        row.fingerprint === fingerprint &&
        row.status === "dismissed" &&
        row.decided_at != null &&
        row.decided_at.slice(0, 10) >= suppressionCutoff,
    );
    if (suppressingDismissal) continue;

    toInsert.push({ signal: result.signal, fingerprint, evidence: result.evidence, action: result.action });
  }

  if (toInsert.length === 0) return existingRows;

  const { data: inserted } = await supabase
    .from("adaptation_cards")
    .insert(toInsert.map((entry) => ({ athlete_id: athleteId, coach_id: coachId, ...entry })))
    .select("*")
    .returns<AdaptationCardRow[]>();

  return [...existingRows, ...(inserted ?? [])];
}

export async function listAdaptationCards(supabase: Supabase, athleteId: string): Promise<AdaptationCardRow[]> {
  const { data } = await supabase
    .from("adaptation_cards")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .returns<AdaptationCardRow[]>();
  return data ?? [];
}

export async function listPendingAdaptationCardsForCoach(supabase: Supabase, coachId: string): Promise<AdaptationCardRow[]> {
  const { data } = await supabase
    .from("adaptation_cards")
    .select("*")
    .eq("coach_id", coachId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<AdaptationCardRow[]>();
  return data ?? [];
}

/**
 * Applies exactly the stated action for this card's signal and marks it
 * 'accepted'. Every workout mutation forces published_at = null
 * regardless of prior state -- Accept is not Publish, mirroring
 * acceptRealignmentProposal's exact same rule: the athlete only learns of
 * a change via a later, ordinary, separate publish step.
 *
 * `chosenDate` is required for fitness_up (the task's own spec: "coach
 * picks the day on Accept") and ignored for every other signal.
 */
export async function acceptAdaptationCard(
  supabase: Supabase,
  cardId: string,
  decidedBy: string,
  options: { chosenDate?: string } = {},
): Promise<{ error?: string }> {
  const { data: row } = await supabase.from("adaptation_cards").select("*").eq("id", cardId).eq("status", "pending").maybeSingle<AdaptationCardRow>();
  if (!row) return { error: "That card is no longer pending." };

  if (row.signal === "fitness_up") {
    if (!options.chosenDate) return { error: "A date is required to schedule the retest workout." };
    const { error } = await supabase.from("scheduled_workouts").insert({
      athlete_id: row.athlete_id,
      coach_id: row.coach_id,
      scheduled_date: options.chosenDate,
      workout_type: "tempo",
      day_label: "Retest / threshold check",
      notes_from_coach: "Recent easy sessions have come in well under prescribed RPE -- checking whether thresholds have moved.",
      is_optional: false,
      published_at: null,
    });
    if (error) return { error: error.message };
  } else if (row.signal === "fatigue_accumulating") {
    const action = row.action as { kind: "convert_to_easy"; workoutId: string };
    const { error } = await supabase
      .from("scheduled_workouts")
      .update({
        workout_type: "easy",
        day_label: "Easy (adjusted)",
        planned_rpe: 4,
        planned_rpe_max: null,
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", action.workoutId);
    if (error) return { error: error.message };
  } else if (row.signal === "plan_too_low") {
    const action = row.action as { kind: "raise_distance"; workoutId: string; newDistanceM: number };
    const { error } = await supabase
      .from("scheduled_workouts")
      .update({ planned_distance_m: action.newDistanceM, published_at: null, updated_at: new Date().toISOString() })
      .eq("id", action.workoutId);
    if (error) return { error: error.message };
  } else {
    // going_quiet: no plan change -- the existing check-in system's other
    // direction, see notification-href.ts's checkin_requested branch.
    await createNotification({
      userId: row.athlete_id,
      type: "checkin_requested",
      content: "Your coach would like a quick check-in on how training's going.",
    });
  }

  const { error: statusError } = await supabase
    .from("adaptation_cards")
    .update({ status: "accepted", decided_at: new Date().toISOString(), decided_by: decidedBy })
    .eq("id", cardId);
  if (statusError) return { error: statusError.message };
  return {};
}

export async function dismissAdaptationCard(supabase: Supabase, cardId: string, decidedBy: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("adaptation_cards")
    .update({ status: "dismissed", decided_at: new Date().toISOString(), decided_by: decidedBy })
    .eq("id", cardId)
    .eq("status", "pending");
  if (error) return { error: error.message };
  return {};
}
