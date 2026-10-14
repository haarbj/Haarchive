"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getAthleteGoalRace } from "@/lib/private-coaching/goal-race";
import {
  POST_SEASON_REVIEW_MARKER,
  RECOVERY_FRAMEWORK_KEY,
  postRaceFlow,
  postSeasonReviewMessage,
  redemptionRaceGuardrail,
  type PostRaceFlow,
  type RedemptionGuardrail,
} from "@/lib/private-coaching/post-race";

// Part H, coach-only. Every step's "done" state is DERIVED from real data
// rather than stored as bookkeeping, so the flow cannot claim something
// happened that did not, and a coach who does one of these steps by hand
// outside the flow still sees it as done.
//
// The one place that is not clean is whether the review has been sent:
// there is no record of "a questionnaire was sent", so it is detected by
// looking for its own marker line in the message thread. That works and is
// honest about what it is, with one real consequence -- renaming the
// questionnaire's title would make previously-sent copies stop being
// recognised, and the flow would offer it again.

export type PostRaceView = {
  error?: string;
  flow?: PostRaceFlow;
  /** The program id to deep-link the assign form to, when the coach has a recovery template. */
  recoveryProgramId?: string | null;
  raceName?: string | null;
  raceDate?: string | null;
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
    .maybeSingle<{ id: string }>();
  if (!relationship) return { error: "You don't coach this athlete." as const };
  return { session, supabase, relationshipId: relationship.id };
}

export async function loadPostRaceFlow(input: { athleteId: string }): Promise<PostRaceView> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { session, supabase, relationshipId } = auth;

  const goalRace = await getAthleteGoalRace(supabase, input.athleteId);
  const today = new Date().toISOString().slice(0, 10);
  if (!goalRace || goalRace.goalDate > today) {
    return { flow: postRaceFlow({ raceDate: null, today, recoveryAssigned: false, reviewSent: false, nextCyclePlanned: false }) };
  }

  const { data: recoveryProgram } = await supabase
    .from("training_programs")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("framework_key", RECOVERY_FRAMEWORK_KEY)
    .maybeSingle<{ id: string }>();

  // Phases that start after the race, which is what "planned next" means.
  const { data: phasesAfter } = await supabase
    .from("training_phases")
    .select("source_program_id, start_date")
    .eq("athlete_id", input.athleteId)
    .gt("start_date", goalRace.goalDate)
    .returns<{ source_program_id: string | null; start_date: string }[]>();
  const after = phasesAfter ?? [];

  const recoveryAssigned = recoveryProgram != null && after.some((p) => p.source_program_id === recoveryProgram.id);
  // "Next cycle planned" means a block after the race that is NOT the
  // recovery program -- recovery is the step before planning, not the plan.
  const nextCyclePlanned = after.some((p) => p.source_program_id != null && p.source_program_id !== recoveryProgram?.id);

  const { data: messages } = await supabase
    .from("coach_athlete_messages")
    .select("id")
    .eq("coach_athlete_id", relationshipId)
    .ilike("body", `%${POST_SEASON_REVIEW_MARKER}%`)
    .limit(1)
    .returns<{ id: string }[]>();

  return {
    flow: postRaceFlow({
      raceDate: goalRace.goalDate,
      today,
      recoveryAssigned,
      reviewSent: (messages ?? []).length > 0,
      nextCyclePlanned,
    }),
    recoveryProgramId: recoveryProgram?.id ?? null,
    raceName: goalRace.raceName,
    raceDate: goalRace.goalDate,
  };
}

export async function sendPostSeasonReview(input: { athleteId: string }): Promise<{ error?: string; ok?: true }> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { session, supabase, relationshipId } = auth;

  const { error } = await supabase.from("coach_athlete_messages").insert({
    coach_athlete_id: relationshipId,
    sender_id: session.userId,
    body: postSeasonReviewMessage(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/coaching/athletes/${input.athleteId}/schedule`);
  return { ok: true };
}

/**
 * Item 20. Checked against the athlete's most recent PAST goal race, and
 * only for a buildup that is itself a marathon plan: a 5K block starting
 * three weeks after a marathon is a different and often sensible thing.
 */
export async function checkRedemptionRaceGuardrail(input: {
  athleteId: string;
  programId: string;
  startDate: string;
  dnfFromMishap?: boolean;
}): Promise<{ error?: string; guardrail?: RedemptionGuardrail }> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const { data: program } = await supabase
    .from("training_programs")
    .select("event_distance, framework_key")
    .eq("id", input.programId)
    .maybeSingle<{ event_distance: string | null; framework_key: string | null }>();

  // The recovery program is itself the thing this guardrail recommends, so
  // it must never be warned about.
  if (!program || program.event_distance !== "marathon" || program.framework_key === RECOVERY_FRAMEWORK_KEY) {
    return { guardrail: { flagged: false, title: "", detail: "", actions: [] } };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: pastRaces } = await supabase
    .from("goals")
    .select("goal_date, distance_m")
    .eq("user_id", input.athleteId)
    .not("goal_date", "is", null)
    .lte("goal_date", today)
    .order("goal_date", { ascending: false })
    .limit(5)
    .returns<{ goal_date: string; distance_m: number | null }[]>();

  // Marathon-ish only: a recent 10K is not something to recover from for
  // six weeks.
  const lastMarathon = (pastRaces ?? []).find((r) => r.distance_m == null || r.distance_m >= 40000) ?? null;

  return {
    guardrail: redemptionRaceGuardrail({
      lastMarathonDate: lastMarathon?.goal_date ?? null,
      newBuildupStartDate: input.startDate,
      dnfFromMishap: input.dnfFromMishap === true,
    }),
  };
}
