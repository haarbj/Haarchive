"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

export type DraftAnswerState = { error?: string; success?: boolean };

// Only the assigned contributor (or admin) can write the draft -- this is
// their workspace, never shown to readers until an admin explicitly
// promotes it into admin_response (see admin/questions/[id]/assignment-actions.ts).
export async function updateDraftAnswer(
  _prevState: DraftAnswerState,
  formData: FormData,
): Promise<DraftAnswerState> {
  const session = await getAppSession();
  if (!session) return { error: "Not authorized." };

  const questionId = formData.get("questionId");
  const draftAnswer = formData.get("draftAnswer");
  if (typeof questionId !== "string" || typeof draftAnswer !== "string") return { error: "Missing fields." };

  const admin = createServiceRoleClient();
  const { data: question } = await admin
    .from("questions")
    .select("assigned_to")
    .eq("id", questionId)
    .maybeSingle();
  if (!question) return { error: "Question not found." };
  if (!session.isAdmin && question.assigned_to !== session.userId) return { error: "Not authorized." };

  const { error } = await admin.from("questions").update({ draft_answer: draftAnswer }).eq("id", questionId);
  if (error) return { error: error.message };

  revalidatePath(`/contribute/questions/${questionId}`);
  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${questionId}`);
  return { success: true };
}

export type QuestionCommentState = { error?: string; success?: boolean };

async function isAssignedQuestionReviewer(userId: string, questionId: string): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("questions")
    .select("assigned_reviewer")
    .eq("id", questionId)
    .maybeSingle();
  return data?.assigned_reviewer === userId;
}

// Only the assigned reviewer (or admin) can leave feedback -- the
// contributor can still read it (see the question detail page), just not
// post through this action.
export async function addQuestionComment(
  _prevState: QuestionCommentState,
  formData: FormData,
): Promise<QuestionCommentState> {
  const session = await getAppSession();
  if (!session) return { error: "Not authorized." };

  const questionId = formData.get("questionId");
  const comment = formData.get("comment");
  if (typeof questionId !== "string" || typeof comment !== "string" || !comment.trim()) {
    return { error: "Enter a comment." };
  }

  if (!session.isAdmin && !(await isAssignedQuestionReviewer(session.userId, questionId))) {
    return { error: "Not authorized." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("question_comments").insert({
    question_id: questionId,
    user_id: session.userId,
    comment: comment.trim(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/contribute/questions/${questionId}`);
  return { success: true };
}

export async function toggleQuestionCommentResolved(commentId: string, questionId: string): Promise<void> {
  const session = await getAppSession();
  if (!session) return;

  const admin = createServiceRoleClient();
  const { data: comment } = await admin
    .from("question_comments")
    .select("user_id, resolved")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return;
  if (!session.isAdmin && comment.user_id !== session.userId) return;

  await admin.from("question_comments").update({ resolved: !comment.resolved }).eq("id", commentId);
  revalidatePath(`/contribute/questions/${questionId}`);
}
