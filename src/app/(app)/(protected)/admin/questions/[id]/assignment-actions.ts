"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

export type AssignmentState = { error?: string; success?: boolean };

// Deliberately a separate file/action from updateQuestion (actions.ts) --
// assignment is an admin-only, additive concern layered on top of the
// existing triage workflow, not a replacement for any of its fields.
export async function assignQuestionCollaborators(
  _prevState: AssignmentState,
  formData: FormData,
): Promise<AssignmentState> {
  const session = await getAppSession();
  if (!session?.isAdmin) return { error: "Not authorized." };

  const questionId = formData.get("questionId");
  if (typeof questionId !== "string" || !questionId) return { error: "Missing question." };

  const assignedToRaw = formData.get("assignedTo");
  const assignedReviewerRaw = formData.get("assignedReviewer");
  const assignedTo = typeof assignedToRaw === "string" && assignedToRaw ? assignedToRaw : null;
  const assignedReviewer =
    typeof assignedReviewerRaw === "string" && assignedReviewerRaw ? assignedReviewerRaw : null;

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("questions")
    .update({ assigned_to: assignedTo, assigned_reviewer: assignedReviewer })
    .eq("id", questionId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/questions/${questionId}`);
  revalidatePath("/admin/questions");
  revalidatePath("/contribute/questions");
  return { success: true };
}

export type PromoteDraftResult = { error?: string; success?: boolean };

// Deliberately a manual, explicit copy rather than any automatic sync --
// admin_response is what the public questions/FAQ pages read (unchanged),
// so a contributor's draft only ever reaches readers once an admin
// consciously decides it's ready.
export async function promoteDraftAnswer(questionId: string): Promise<PromoteDraftResult> {
  const session = await getAppSession();
  if (!session?.isAdmin) return { error: "Not authorized." };

  const admin = createServiceRoleClient();
  const { data: question } = await admin
    .from("questions")
    .select("draft_answer")
    .eq("id", questionId)
    .maybeSingle();
  if (!question?.draft_answer) return { error: "No draft answer to use yet." };

  const { error } = await admin
    .from("questions")
    .update({ admin_response: question.draft_answer })
    .eq("id", questionId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/questions/${questionId}`);
  revalidatePath("/admin/questions");
  return { success: true };
}
