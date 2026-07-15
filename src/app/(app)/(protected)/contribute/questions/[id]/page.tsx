import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { mapQuestionCommentRow, mapQuestionRow } from "@/lib/questions/map-row";
import { DraftAnswerForm } from "./draft-answer-form";
import { QuestionCommentThread, type QuestionCommentWithAuthor } from "./question-comment-thread";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const admin = createServiceRoleClient();
  const { data } = await admin.from("questions").select("title").eq("id", id).maybeSingle<{ title: string }>();
  return { title: data?.title ?? "Assigned Question" };
}

export default async function AssignedQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAppSession(); // non-null: contribute/layout.tsx already gated
  const admin = createServiceRoleClient();

  const { data } = await admin.from("questions").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const question = mapQuestionRow(data);

  const isContributor = question.assignedTo === session!.userId;
  const isReviewer = question.assignedReviewer === session!.userId;
  if (!session!.isAdmin && !isContributor && !isReviewer) notFound();

  const { data: commentRows } = await admin
    .from("question_comments")
    .select("*")
    .eq("question_id", id)
    .order("created_at", { ascending: true })
    .returns<Record<string, unknown>[]>();
  const comments = (commentRows ?? []).map(mapQuestionCommentRow);

  const userIds = Array.from(new Set(comments.map((c) => c.userId).filter((v): v is string => !!v)));
  const { data: profiles } = userIds.length
    ? await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds)
        .returns<{ id: string; display_name: string }[]>()
    : { data: [] as { id: string; display_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const commentsWithAuthor: QuestionCommentWithAuthor[] = comments.map((c) => ({
    id: c.id,
    authorName: c.userId ? (nameById.get(c.userId) ?? "Runner") : "Runner",
    comment: c.comment,
    resolved: c.resolved,
    isOwn: c.userId === session!.userId,
  }));

  return (
    <Container variant="narrow">
      <BackLink href="/contribute/questions">Back to Assigned Questions</BackLink>
      <Heading variant="compact">{question.title}</Heading>
      {question.description ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{question.description}</p>
      ) : null}

      {isContributor || session!.isAdmin ? (
        <div className="mt-8">
          <DraftAnswerForm questionId={question.id} initialDraftAnswer={question.draftAnswer ?? ""} />
        </div>
      ) : (
        <div className="mt-8 rounded-lg bg-black/[0.03] p-4 text-sm whitespace-pre-wrap text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-200">
          {question.draftAnswer || "No draft yet."}
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Feedback</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          {isReviewer || session!.isAdmin
            ? "Leave feedback for the contributor drafting this answer."
            : "Feedback from the assigned reviewer, if any."}
        </p>
        <div className="mt-4">
          <QuestionCommentThread
            questionId={question.id}
            comments={commentsWithAuthor}
            canComment={isReviewer || session!.isAdmin}
            canModerate={session!.isAdmin}
          />
        </div>
      </div>
    </Container>
  );
}
