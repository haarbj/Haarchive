"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createNotification } from "@/lib/notifications/create-notification";
import { postSeasonReviewQuestions } from "@/lib/private-coaching/post-race";

// The athlete-facing side of the structured post-season review. Scoped
// entirely by requestId + the signed-in athlete owning it -- there is
// deliberately no listing of "my reviews" here, since the one place an
// athlete arrives from is the notification/thread link sendPostSeasonReview
// produces, which already carries the request id.

async function requireOwnRequest(requestId: string) {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first." as const };
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("post_season_review_requests")
    .select("id, athlete_id, coach_id, goal_id, submitted_at")
    .eq("id", requestId)
    .maybeSingle<{ id: string; athlete_id: string; coach_id: string; goal_id: string | null; submitted_at: string | null }>();
  if (!request || request.athlete_id !== session.userId) return { error: "Not found." as const };
  return { session, supabase, request };
}

export type PostSeasonReviewFormAnswer = { sectionHeading: string; questionIndex: number; question: string; answer: string };

export type PostSeasonReviewFormView = {
  error?: string;
  requestId?: string;
  raceName?: string | null;
  submittedAt?: string | null;
  answers?: PostSeasonReviewFormAnswer[];
};

export async function loadPostSeasonReviewForm(input: { requestId: string }): Promise<PostSeasonReviewFormView> {
  const auth = await requireOwnRequest(input.requestId);
  if ("error" in auth) return { error: auth.error };
  const { supabase, request } = auth;

  const { data: rows, error } = await supabase
    .from("post_season_review_answers")
    .select("section_heading, question_index, question, answer")
    .eq("request_id", input.requestId)
    .returns<{ section_heading: string; question_index: number; question: string; answer: string }[]>();
  if (error) return { error: error.message };

  // Sorted by the questionnaire's own display order -- see
  // loadPostSeasonReviewAnswers' identical comment on the coach side for
  // why this can't just be an alphabetical DB order() on section_heading.
  const order = new Map(postSeasonReviewQuestions().map((q, i) => [`${q.sectionHeading}:${q.questionIndex}`, i]));
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

  let raceName: string | null = null;
  if (request.goal_id) {
    const { data: goal } = await supabase
      .from("goals")
      .select("race_name")
      .eq("id", request.goal_id)
      .maybeSingle<{ race_name: string }>();
    raceName = goal?.race_name ?? null;
  }

  return { requestId: request.id, raceName, submittedAt: request.submitted_at, answers };
}

export type SaveAnswersState = { error?: string; success?: boolean };

/**
 * Saves every question's current value, keyed by its position in
 * postSeasonReviewQuestions() (field name `answer-<index>`) rather than by
 * question text -- the same reasoning as the DB's own snapshot: a later
 * copy edit to a question's wording shouldn't matter to which row this
 * writes.
 */
export async function savePostSeasonReviewAnswers(
  requestId: string,
  _prevState: SaveAnswersState,
  formData: FormData,
): Promise<SaveAnswersState> {
  const auth = await requireOwnRequest(requestId);
  if ("error" in auth) return { error: auth.error };
  const { supabase, request } = auth;
  if (request.submitted_at) return { error: "This review has already been submitted." };

  const questions = postSeasonReviewQuestions();
  for (let i = 0; i < questions.length; i++) {
    const value = formData.get(`answer-${i}`);
    if (typeof value !== "string") continue;
    const q = questions[i];
    const { error } = await supabase
      .from("post_season_review_answers")
      .update({ answer: value, updated_at: new Date().toISOString() })
      .eq("request_id", requestId)
      .eq("section_heading", q.sectionHeading)
      .eq("question_index", q.questionIndex);
    if (error) return { error: error.message };
  }

  return { success: true };
}

export async function submitPostSeasonReview(requestId: string): Promise<{ error?: string; ok?: true }> {
  const auth = await requireOwnRequest(requestId);
  if ("error" in auth) return { error: auth.error };
  const { session, supabase, request } = auth;
  if (request.submitted_at) return { ok: true };

  const { error } = await supabase
    .from("post_season_review_requests")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: error.message };

  const { data: athleteProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", session.userId)
    .maybeSingle<{ display_name: string }>();

  await createNotification({
    userId: request.coach_id,
    type: "post_season_review_submitted",
    content: `${athleteProfile?.display_name ?? "Your athlete"} submitted their post-season review.`,
    relatedEntityId: session.userId,
  });

  revalidatePath(`/coaching/post-season-review/${requestId}`);
  return { ok: true };
}
