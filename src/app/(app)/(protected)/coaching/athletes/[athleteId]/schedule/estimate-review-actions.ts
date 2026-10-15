"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { phaseFamily } from "@/lib/private-coaching/adjustment-playbook";
import {
  REVIEW_WINDOW_DAYS,
  detectDeterioration,
  proposeEstimateReview,
  type DeteriorationFlag,
  type EstimateReviewProposal,
  type PastReview,
  type RecentRaceEvidence,
  type ReviewSession,
} from "@/lib/private-coaching/estimate-review";
import { metersFor } from "@/lib/race-distances";

// Part F, coach-only. Reads the athlete's logged work and proposes a
// revised estimate; the coach confirms, and the confirmation is recorded
// here rather than written onto the athlete's own estimate.
//
// THAT BOUNDARY IS DELIBERATE AND NOT A GAP. athlete_fitness_estimates is
// athlete-writable only -- the coach has SELECT and nothing else, by
// design (20260926020000's policies; see also assign-program-actions.ts on
// why this platform never enters an athlete's fitness estimate for them).
// So a review produces the coach's conclusion plus the reasoning behind
// it, which the coach takes to the athlete through the messaging that
// already exists. Nothing here silently changes the number the athlete's
// paces resolve against.


export type EstimateReviewView = {
  error?: string;
  proposal?: EstimateReviewProposal;
  deterioration?: DeteriorationFlag;
  /** The phase the review was read against. */
  phaseKey?: string | null;
  /** Reference distance label, for display. */
  referenceKey?: "5k" | "marathon";
  /** Past reviews, newest first, for the trend. */
  history?: { reviewedAt: string; verdict: string; confirmedTimeS: number | null; proposedTimeS: number | null }[];
};

type CompletionRow = {
  scheduled_workout_id: string;
  actual_distance_m: number | null;
  actual_duration_s: number | null;
  rpe: number | null;
  effort_level: string | null;
  conditions_notes: string | null;
  pain_reported: boolean | null;
};

async function requireCoachOf(athleteId: string) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." as const };
  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." as const };
  return { session, supabase };
}

export async function runEstimateReview(input: { athleteId: string; windowDays?: number }): Promise<EstimateReviewView> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const today = new Date();
  const since = new Date(today.getTime() - (input.windowDays ?? REVIEW_WINDOW_DAYS) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  const { data: phaseRows } = await supabase
    .from("training_phases")
    .select("phase_type, start_date, end_date")
    .eq("athlete_id", input.athleteId)
    .order("start_date", { ascending: true })
    .returns<{ phase_type: string; start_date: string; end_date: string }[]>();
  const phases = phaseRows ?? [];
  // The review is read against the phase the athlete is in now, because
  // that decides which pace band is evidence at all.
  const currentPhaseKey = phases.find((p) => todayIso >= p.start_date && todayIso <= p.end_date)?.phase_type ?? null;
  const phaseForDate = (date: string) => phases.find((p) => date >= p.start_date && date <= p.end_date)?.phase_type ?? null;

  const { data: workoutRows } = await supabase
    .from("scheduled_workouts")
    .select("id, scheduled_date, day_label, notes_from_coach, planned_rpe, planned_rpe_max, is_optional")
    .eq("athlete_id", input.athleteId)
    .gte("scheduled_date", since)
    .lte("scheduled_date", todayIso)
    .returns<
      {
        id: string;
        scheduled_date: string;
        day_label: string | null;
        notes_from_coach: string | null;
        planned_rpe: number | null;
        planned_rpe_max: number | null;
        is_optional: boolean;
      }[]
    >();
  const workouts = workoutRows ?? [];

  const { data: completionRows } = workouts.length
    ? await supabase
        .from("completed_workouts")
        .select("scheduled_workout_id, actual_distance_m, actual_duration_s, rpe, effort_level, conditions_notes, pain_reported")
        .in("scheduled_workout_id", workouts.map((w) => w.id))
        .returns<CompletionRow[]>()
    : { data: [] as CompletionRow[] };
  const completionByWorkout = new Map((completionRows ?? []).map((c) => [c.scheduled_workout_id, c]));

  const sessions: ReviewSession[] = workouts
    .map((w) => {
      const completion = completionByWorkout.get(w.id);
      if (!completion) return null; // Never completed: nothing logged to read.
      return {
        id: w.id,
        scheduledDate: w.scheduled_date,
        dayLabel: w.day_label,
        prescription: w.notes_from_coach,
        plannedRpe: w.planned_rpe,
        plannedRpeMax: w.planned_rpe_max,
        phaseKey: phaseForDate(w.scheduled_date),
        isOptional: w.is_optional,
        actualDistanceM: completion.actual_distance_m,
        actualDurationS: completion.actual_duration_s,
        rpe: completion.rpe,
        effortLevel: completion.effort_level,
        conditionsNotes: completion.conditions_notes,
        painReported: completion.pain_reported === true,
      } satisfies ReviewSession;
    })
    .filter((s): s is ReviewSession => s != null);

  const referenceKey: "5k" | "marathon" = phaseFamily(currentPhaseKey) === "general" ? "5k" : "marathon";

  const [{ data: estimateRow }, { data: raceRow }] = await Promise.all([
    supabase
      .from("athlete_fitness_estimates")
      .select("estimated_time_s")
      .eq("athlete_id", input.athleteId)
      .eq("reference_key", referenceKey)
      .maybeSingle<{ estimated_time_s: number }>(),
    // The athlete's most recent race AT THIS DISTANCE -- not just their
    // most recent race overall (getAthleteMostRecentRace, used elsewhere
    // for pace references, deliberately ignores distance). Real evidence
    // regardless of who coached the training that produced it; see
    // raceEvidenceNote's own comment.
    supabase
      .from("race_results")
      .select("race_name, race_date, finish_time_s")
      .eq("user_id", input.athleteId)
      .eq("distance_m", Math.round(metersFor(referenceKey)))
      .order("race_date", { ascending: false })
      .limit(1)
      .maybeSingle<{ race_name: string; race_date: string; finish_time_s: number }>(),
  ]);

  const recentRace: RecentRaceEvidence | null = raceRow
    ? { raceName: raceRow.race_name, raceDate: raceRow.race_date, timeS: raceRow.finish_time_s }
    : null;

  const proposal = proposeEstimateReview({
    sessions,
    phaseKey: currentPhaseKey,
    currentTimeS: estimateRow?.estimated_time_s ?? null,
    referenceDistanceM: metersFor(referenceKey),
    recentRace,
  });

  const { data: historyRows } = await supabase
    .from("coach_estimate_reviews")
    .select("reviewed_at, verdict, proposed_time_s, confirmed_time_s, work_completed")
    .eq("athlete_id", input.athleteId)
    .eq("reference_key", referenceKey)
    .order("reviewed_at", { ascending: false })
    .limit(10)
    .returns<
      { reviewed_at: string; verdict: string; proposed_time_s: number | null; confirmed_time_s: number | null; work_completed: boolean }[]
    >();
  const history = historyRows ?? [];

  // Only reviews the coach actually settled a number on can form a trend --
  // a review that proposed nothing says nothing about direction over time.
  const pastReviews: PastReview[] = history
    .filter((r): r is typeof r & { confirmed_time_s: number } => r.confirmed_time_s != null)
    .map((r) => ({ reviewedAt: r.reviewed_at, estimateTimeS: r.confirmed_time_s, workCompleted: r.work_completed }))
    .reverse();

  return {
    proposal,
    deterioration: detectDeterioration(pastReviews),
    phaseKey: currentPhaseKey,
    referenceKey,
    history: history.map((r) => ({
      reviewedAt: r.reviewed_at,
      verdict: r.verdict,
      confirmedTimeS: r.confirmed_time_s,
      proposedTimeS: r.proposed_time_s,
    })),
  };
}

export async function saveEstimateReview(input: {
  athleteId: string;
  referenceKey: "5k" | "marathon";
  verdict: string;
  previousTimeS: number | null;
  proposedTimeS: number | null;
  /** What the coach concluded. Null means "reviewed, leaving the estimate alone". */
  confirmedTimeS: number | null;
  reasoning: string;
  sessionsCounted: number;
  workCompleted: boolean;
}): Promise<{ error?: string; ok?: true }> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { session, supabase } = auth;

  if (input.confirmedTimeS != null && (!Number.isFinite(input.confirmedTimeS) || input.confirmedTimeS <= 0)) {
    return { error: "A confirmed estimate has to be a positive time." };
  }

  const { error } = await supabase.from("coach_estimate_reviews").insert({
    coach_id: session.userId,
    athlete_id: input.athleteId,
    reference_key: input.referenceKey,
    previous_time_s: input.previousTimeS,
    proposed_time_s: input.proposedTimeS,
    confirmed_time_s: input.confirmedTimeS,
    verdict: input.verdict,
    reasoning: input.reasoning,
    sessions_counted: input.sessionsCounted,
    work_completed: input.workCompleted,
  });
  if (error) return { error: error.message };

  revalidatePath(`/coaching/athletes/${input.athleteId}/schedule`);
  return { ok: true };
}
