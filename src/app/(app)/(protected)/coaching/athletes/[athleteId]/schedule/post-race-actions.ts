"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getAthleteGoalRace } from "@/lib/private-coaching/goal-race";
import {
  RECOVERY_FRAMEWORK_KEY,
  postRaceFlow,
  postSeasonReviewMessage,
  postSeasonReviewQuestions,
  redemptionRaceGuardrail,
  type PostRaceFlow,
  type RedemptionGuardrail,
} from "@/lib/private-coaching/post-race";
import { createNotification } from "@/lib/notifications/create-notification";

// Part H, coach-only. Every step's "done" state is DERIVED from real data
// rather than stored as bookkeeping, so the flow cannot claim something
// happened that did not, and a coach who does one of these steps by hand
// outside the flow still sees it as done.
//
// Whether the review has been sent now comes from a real
// post_season_review_requests row (scoped to this athlete + this race),
// not from searching the thread for the questionnaire's own title line.
// That earlier approach had a real consequence -- renaming the title would
// make previously-sent copies stop being recognised -- which this removes
// entirely: nothing here reads POST_SEASON_REVIEW_TITLE/MARKER at all.

export type PostRaceView = {
  error?: string;
  flow?: PostRaceFlow;
  /** The program id to deep-link the assign form to, when the coach has a recovery template. */
  recoveryProgramId?: string | null;
  raceName?: string | null;
  raceDate?: string | null;
  /** The most recent review request for this race, so the panel can offer "view answers". */
  reviewRequestId?: string | null;
  reviewSubmitted?: boolean;
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

  // Scoped to this athlete + this race, and ordered so the most recent
  // send wins if a coach ever sent it more than once -- a real request
  // row, not a text search, so renaming the questionnaire's title cannot
  // affect this.
  const { data: reviewRequest } = await supabase
    .from("post_season_review_requests")
    .select("id, submitted_at")
    .eq("coach_athlete_id", relationshipId)
    .eq("goal_id", goalRace.id)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; submitted_at: string | null }>();

  return {
    flow: postRaceFlow({
      raceDate: goalRace.goalDate,
      today,
      recoveryAssigned,
      reviewSent: reviewRequest != null,
      nextCyclePlanned,
    }),
    recoveryProgramId: recoveryProgram?.id ?? null,
    raceName: goalRace.raceName,
    raceDate: goalRace.goalDate,
    reviewRequestId: reviewRequest?.id ?? null,
    reviewSubmitted: reviewRequest?.submitted_at != null,
  };
}

export async function sendPostSeasonReview(input: { athleteId: string }): Promise<{ error?: string; ok?: true }> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { session, supabase, relationshipId } = auth;

  const goalRace = await getAthleteGoalRace(supabase, input.athleteId);
  if (!goalRace) return { error: "No race on record to send this for." };

  const { data: message, error: messageError } = await supabase
    .from("coach_athlete_messages")
    .insert({
      coach_athlete_id: relationshipId,
      sender_id: session.userId,
      body: postSeasonReviewMessage(),
    })
    .select("id")
    .single<{ id: string }>();
  if (messageError) return { error: messageError.message };

  // The structured record: a request row scoped to this race, plus one
  // empty answer row per question, pre-created now so the athlete's form
  // only ever updates an existing row rather than inserting one (see the
  // migration's RLS -- the athlete has no insert policy on answers at
  // all, by design).
  const { data: request, error: requestError } = await supabase
    .from("post_season_review_requests")
    .insert({
      coach_athlete_id: relationshipId,
      coach_id: session.userId,
      athlete_id: input.athleteId,
      goal_id: goalRace.id,
      message_id: message.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (requestError) return { error: requestError.message };

  const { error: answersError } = await supabase.from("post_season_review_answers").insert(
    postSeasonReviewQuestions().map((q) => ({
      request_id: request.id,
      section_heading: q.sectionHeading,
      question_index: q.questionIndex,
      question: q.question,
    })),
  );
  if (answersError) return { error: answersError.message };

  await createNotification({
    userId: input.athleteId,
    type: "post_season_review_sent",
    content: "Your coach sent you the post-season review for your race.",
    relatedEntityId: request.id,
  });

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

export type PostSeasonReviewAnswerView = { sectionHeading: string; questionIndex: number; question: string; answer: string };

/**
 * The coach-facing read of a sent review: per-question answers, not a
 * thread dump. submittedAt is null while the athlete hasn't submitted yet
 * -- the answer rows still exist (pre-created empty at send time), so this
 * shows live progress rather than nothing.
 */
export async function loadPostSeasonReviewAnswers(
  input: { athleteId: string; requestId: string },
): Promise<{ error?: string; answers?: PostSeasonReviewAnswerView[]; submittedAt?: string | null }> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const { data: request } = await supabase
    .from("post_season_review_requests")
    .select("id, submitted_at")
    .eq("id", input.requestId)
    .eq("athlete_id", input.athleteId)
    .maybeSingle<{ id: string; submitted_at: string | null }>();
  if (!request) return { error: "Review request not found." };

  const { data: rows, error } = await supabase
    .from("post_season_review_answers")
    .select("section_heading, question_index, question, answer")
    .eq("request_id", input.requestId)
    .returns<{ section_heading: string; question_index: number; question: string; answer: string }[]>();
  if (error) return { error: error.message };

  // Sorted by the questionnaire's own display order (section, then
  // question index within it), not alphabetically by section_heading --
  // "Reviewing the race" would otherwise sort ahead of "Reviewing your
  // training" and show the race questions first.
  const order = new Map(
    postSeasonReviewQuestions().map((q, i) => [`${q.sectionHeading}:${q.questionIndex}`, i]),
  );
  const answers = (rows ?? [])
    .map((r) => ({
      sectionHeading: r.section_heading,
      questionIndex: r.question_index,
      question: r.question,
      answer: r.answer,
    }))
    .sort(
      (a, b) =>
        (order.get(`${a.sectionHeading}:${a.questionIndex}`) ?? 0) -
        (order.get(`${b.sectionHeading}:${b.questionIndex}`) ?? 0),
    );

  return { submittedAt: request.submitted_at, answers };
}
