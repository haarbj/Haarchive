"use server";

// Knowledge Checks (Phase 2) server actions. Same identity convention as
// learning-actions.ts (supabase.auth.getClaims(), never a client-supplied
// user id) -- but reads of knowledge_checks itself go through the
// service-role client, since that table has no RLS select policy for
// authenticated/public at all (it holds the answer key -- see the
// knowledge_checks migration's own comment). Every function here is
// careful to return only the service-role client's *columns it explicitly
// selected*, never the row wholesale, so the answer key can't leak by
// accident through a wider select.

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { recomputeTopicMastery, type DbClient } from "@/app/learning-actions";
import type { MasteryLevel } from "@/lib/mastery/algorithm";

export type KnowledgeCheckOption = { id: string; text: string };

export type SafeKnowledgeCheck = {
  id: string;
  topicId: string;
  conceptId: string | null;
  question: string;
  options: KnowledgeCheckOption[];
  difficulty: string;
  // The signed-in user's mastery level for this topic *before* answering --
  // null for a signed-out visitor, or a user with no engagement yet. Lets
  // the UI show "if it changed" after submitting, without a second query.
  currentLevel: MasteryLevel | null;
};

type KnowledgeCheckRow = {
  id: string;
  topic_id: string;
  concept_id: string | null;
  question: string;
  options: KnowledgeCheckOption[];
  difficulty: string;
};

function toSafe(row: KnowledgeCheckRow, currentLevel: MasteryLevel | null): SafeKnowledgeCheck {
  return {
    id: row.id,
    topicId: row.topic_id,
    conceptId: row.concept_id,
    question: row.question,
    options: row.options,
    difficulty: row.difficulty,
    currentLevel,
  };
}

// Returns one available question for a topic, or null if the topic has
// none (the common case today -- only a handful of topics have curated
// questions). Never returns correct_option_id or explanation -- those
// columns aren't even in the select list below, so there's nothing to
// accidentally forward to the client.
//
// For a signed-in visitor, prefers a question they haven't already
// answered correctly, so a repeat topic visit doesn't just keep re-showing
// an already-verified question; falls back to the first question once
// every one has been answered correctly (so it's still there to revisit).
export async function getKnowledgeCheckForTopic(topicSlug: string): Promise<SafeKnowledgeCheck | null> {
  const service = createServiceRoleClient();

  const { data: topic } = await service.from("topics").select("id").eq("section_slug", topicSlug).maybeSingle();
  if (!topic) return null;

  const { data: questions } = await service
    .from("knowledge_checks")
    .select("id, topic_id, concept_id, question, options, difficulty")
    .eq("topic_id", topic.id)
    .order("created_at", { ascending: true })
    .returns<KnowledgeCheckRow[]>();
  if (!questions || questions.length === 0) return null;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (userId) {
    // RLS-scoped client is fine here (not service-role) -- a user reading
    // their own learning_events/user_topic_mastery is exactly what
    // *_select_own-style ownership policies already allow.
    const [{ data: events }, { data: masteryRow }] = await Promise.all([
      supabase
        .from("learning_events")
        .select("metadata")
        .eq("user_id", userId)
        .eq("topic_id", topic.id)
        .eq("event_type", "knowledge_check_answered"),
      supabase
        .from("user_topic_mastery")
        .select("level")
        .eq("user_id", userId)
        .eq("topic_id", topic.id)
        .maybeSingle(),
    ]);

    const currentLevel = (masteryRow?.level as MasteryLevel | undefined) ?? null;

    const correctlyAnsweredIds = new Set(
      (events ?? [])
        .filter((e) => (e.metadata as { correct?: boolean } | null)?.correct)
        .map((e) => (e.metadata as { questionId?: string } | null)?.questionId)
        .filter((id): id is string => !!id),
    );

    const unanswered = questions.find((q) => !correctlyAnsweredIds.has(q.id));
    if (unanswered) return toSafe(unanswered, currentLevel);
    return toSafe(questions[0], currentLevel);
  }

  return toSafe(questions[0], null);
}

// For the dashboard's small "Verify your understanding · N questions"
// hint (LearningProgress) -- counts only, never question content or
// answer keys, so this is safe to call for every topic shown regardless
// of whether the caller ever renders a real question. Service-role, same
// reasoning as getKnowledgeCheckForTopic: knowledge_checks has no
// authenticated/public select policy at all.
export async function getKnowledgeCheckCounts(topicSlugs: string[]): Promise<Record<string, number>> {
  if (topicSlugs.length === 0) return {};

  const service = createServiceRoleClient();
  const { data: topics } = await service.from("topics").select("id, slug").in("section_slug", topicSlugs);
  if (!topics || topics.length === 0) return {};

  const { data: questions } = await service
    .from("knowledge_checks")
    .select("topic_id")
    .in(
      "topic_id",
      topics.map((t) => t.id),
    );

  const slugByTopicId = new Map(topics.map((t) => [t.id, t.slug]));
  const counts: Record<string, number> = {};
  for (const row of questions ?? []) {
    const slug = slugByTopicId.get(row.topic_id);
    if (!slug) continue;
    counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return counts;
}

export type SubmitKnowledgeCheckResult =
  | { error: string }
  | {
      correct: boolean;
      explanation: string;
      correctOptionId: string;
      newLevel: MasteryLevel;
    };

export async function submitKnowledgeCheckAnswer(
  questionId: string,
  selectedOptionId: string,
): Promise<SubmitKnowledgeCheckResult> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) {
    return { error: "Sign in to answer knowledge checks." };
  }

  // Full row, service-role -- this is the one place correct_option_id is
  // ever read, and it never leaves this function unevaluated.
  const service = createServiceRoleClient();
  const { data: question } = await service
    .from("knowledge_checks")
    .select("id, topic_id, concept_id, options, correct_option_id, explanation")
    .eq("id", questionId)
    .maybeSingle();
  if (!question) {
    return { error: "That question could not be found." };
  }

  const validOptionIds = new Set((question.options as KnowledgeCheckOption[]).map((o) => o.id));
  if (!validOptionIds.has(selectedOptionId)) {
    return { error: "That's not a valid answer for this question." };
  }

  // The only place correctness is decided -- a client-submitted "correct"
  // value is never accepted (there isn't one in this function's
  // parameters at all), and selectedOptionId is validated against the
  // question's real options above before this comparison ever runs.
  const correct = selectedOptionId === question.correct_option_id;

  const attemptNumber = await countPriorAttempts(supabase, userId, questionId);

  const { error: insertError } = await supabase.from("learning_events").insert({
    user_id: userId,
    event_type: "knowledge_check_answered",
    topic_id: question.topic_id,
    concept_id: question.concept_id,
    metadata: { questionId, selectedOptionId, correct, attemptNumber },
  });
  if (insertError) {
    return { error: insertError.message };
  }

  const { level: newLevel } = await recomputeTopicMastery(supabase, userId, question.topic_id);

  revalidatePath("/dashboard");
  return {
    correct,
    explanation: question.explanation,
    correctOptionId: question.correct_option_id,
    newLevel,
  };
}

// Server-computed, never client-supplied -- counts this user's own prior
// answers to this exact question (any correctness), so attemptNumber === 1
// always means a genuine first try.
async function countPriorAttempts(supabase: DbClient, userId: string, questionId: string): Promise<number> {
  const { data } = await supabase
    .from("learning_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", "knowledge_check_answered")
    .contains("metadata", { questionId });

  return (data?.length ?? 0) + 1;
}
