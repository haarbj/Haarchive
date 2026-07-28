"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { createNotification } from "@/lib/notifications/create-notification";
import { sectionMap } from "@/lib/sections";

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
  const { data: suggestion } = await admin
    .from("content_suggestions")
    .select("submitted_by, section_slug")
    .eq("id", id)
    .maybeSingle<{ submitted_by: string | null; section_slug: string }>();

  const { error } = await admin
    .from("content_suggestions")
    .update({ status, admin_notes: typeof adminNotes === "string" && adminNotes ? adminNotes : null })
    .eq("id", id);
  if (error) return { error: error.message };

  if (suggestion?.submitted_by) {
    const sectionTitle = sectionMap.get(suggestion.section_slug)?.title ?? suggestion.section_slug;
    await createNotification({
      userId: suggestion.submitted_by,
      type: "suggestion_reviewed",
      content: `Your suggestion for "${sectionTitle}" was ${status}.`,
      relatedEntityId: id,
    });
  }

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
  const { data: citation } = await admin
    .from("article_citations")
    .select("submitted_by, paper_title")
    .eq("id", id)
    .maybeSingle<{ submitted_by: string | null; paper_title: string }>();

  const { error } = await admin
    .from("article_citations")
    .update({ status, admin_notes: typeof adminNotes === "string" && adminNotes ? adminNotes : null })
    .eq("id", id);
  if (error) return { error: error.message };

  if (citation?.submitted_by) {
    await createNotification({
      userId: citation.submitted_by,
      type: "citation_reviewed",
      content: `Your citation "${citation.paper_title}" was ${status}.`,
      relatedEntityId: null,
    });
  }

  revalidatePath("/admin/suggestions");
  return { success: true };
}
