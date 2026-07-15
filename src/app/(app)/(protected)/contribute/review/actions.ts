"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

export type AddCommentState = { error?: string; success?: boolean };

async function isAssignedReviewer(userId: string, articleId: string): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("article_contributors")
    .select("id")
    .eq("article_id", articleId)
    .eq("user_id", userId)
    .eq("contributor_role", "reviewer")
    .maybeSingle();
  return !!data;
}

// Reviewers can only comment on an article they're actually assigned to
// (article_contributors role='reviewer') -- admins can comment on anything.
// Contributors never reach this action at all (see review/[id]/page.tsx's
// own gate), but the check is repeated here since Server Actions can be
// invoked directly, bypassing any page-level gate.
export async function addArticleComment(
  _prevState: AddCommentState,
  formData: FormData,
): Promise<AddCommentState> {
  const session = await getAppSession();
  if (!session) return { error: "Not authorized." };

  const articleId = formData.get("articleId");
  const comment = formData.get("comment");
  const blockIndexRaw = formData.get("blockIndex");
  if (typeof articleId !== "string" || typeof comment !== "string" || !comment.trim()) {
    return { error: "Enter a comment." };
  }

  if (!session.isAdmin && !(await isAssignedReviewer(session.userId, articleId))) {
    return { error: "Not authorized." };
  }

  const blockIndex = typeof blockIndexRaw === "string" && blockIndexRaw !== "" ? Number(blockIndexRaw) : null;

  const admin = createServiceRoleClient();
  const { error } = await admin.from("article_comments").insert({
    article_id: articleId,
    user_id: session.userId,
    block_index: blockIndex,
    comment: comment.trim(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/contribute/review/${articleId}`);
  return { success: true };
}

export async function toggleCommentResolved(commentId: string, articleId: string): Promise<void> {
  const session = await getAppSession();
  if (!session) return;

  const admin = createServiceRoleClient();
  const { data: comment } = await admin
    .from("article_comments")
    .select("user_id, resolved")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return;
  if (!session.isAdmin && comment.user_id !== session.userId) return;

  await admin.from("article_comments").update({ resolved: !comment.resolved }).eq("id", commentId);
  revalidatePath(`/contribute/review/${articleId}`);
}
