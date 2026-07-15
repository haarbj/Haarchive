"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

export type AdminReviewState = { error?: string; success?: boolean };

async function requireAdmin() {
  const session = await getAppSession();
  return session?.isAdmin ? session : null;
}

export async function reviewContentSuggestion(
  _prevState: AdminReviewState,
  formData: FormData,
): Promise<AdminReviewState> {
  const session = await requireAdmin();
  if (!session) return { error: "Not authorized." };

  const id = formData.get("id");
  const status = formData.get("status");
  const adminNotes = formData.get("adminNotes");
  if (typeof id !== "string" || (status !== "accepted" && status !== "rejected")) {
    return { error: "Invalid request." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("content_suggestions")
    .update({ status, admin_notes: typeof adminNotes === "string" && adminNotes ? adminNotes : null })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/suggestions");
  return { success: true };
}

export async function reviewCitation(_prevState: AdminReviewState, formData: FormData): Promise<AdminReviewState> {
  const session = await requireAdmin();
  if (!session) return { error: "Not authorized." };

  const id = formData.get("id");
  const status = formData.get("status");
  const adminNotes = formData.get("adminNotes");
  if (typeof id !== "string" || (status !== "accepted" && status !== "rejected")) {
    return { error: "Invalid request." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("article_citations")
    .update({ status, admin_notes: typeof adminNotes === "string" && adminNotes ? adminNotes : null })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/suggestions");
  return { success: true };
}
