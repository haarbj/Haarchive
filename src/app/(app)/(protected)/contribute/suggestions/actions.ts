"use server";

import { revalidatePath } from "next/cache";

import { getAppSession, type AppSession } from "@/lib/auth/session";
import { hasContentPermission } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { submitContentSuggestionSchema } from "@/lib/validation/content-suggestions";
import { citationSchema } from "@/lib/validation/articles";

export type SuggestionFormState = { error?: string; success?: boolean };

function canContribute(session: AppSession): boolean {
  return !!session && (session.isAdmin || hasContentPermission(session.permissions, "content_contributor"));
}

// Never writes to sections.ts -- this is purely a suggestion box. An admin
// reviews it in /admin/suggestions and manually integrates any change,
// exactly as the original spec describes; Foundations stays code-controlled.
export async function submitContentSuggestion(
  _prevState: SuggestionFormState,
  formData: FormData,
): Promise<SuggestionFormState> {
  const session = await getAppSession();
  if (!canContribute(session)) return { error: "Not authorized." };

  const parsed = submitContentSuggestionSchema.safeParse({
    sectionSlug: formData.get("sectionSlug"),
    suggestion: formData.get("suggestion"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createServiceRoleClient();
  const { error } = await admin.from("content_suggestions").insert({
    section_slug: parsed.data.sectionSlug,
    suggestion: parsed.data.suggestion,
    reason: parsed.data.reason ?? null,
    submitted_by: session!.userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/contribute/suggestions");
  revalidatePath("/admin/suggestions");
  return { success: true };
}

// A citation not tied to any specific article draft -- article_id is left
// null (see the content_suggestions migration's own comment on why that
// column was nullable from the start).
export async function submitStandaloneCitation(
  _prevState: SuggestionFormState,
  formData: FormData,
): Promise<SuggestionFormState> {
  const session = await getAppSession();
  if (!canContribute(session)) return { error: "Not authorized." };

  const parsed = citationSchema.safeParse({
    paperTitle: formData.get("paperTitle"),
    authors: formData.get("authors"),
    year: formData.get("year"),
    linkOrDoi: formData.get("linkOrDoi"),
    topic: formData.get("topic"),
    claimSupported: formData.get("claimSupported"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createServiceRoleClient();
  const { error } = await admin.from("article_citations").insert({
    article_id: null,
    paper_title: parsed.data.paperTitle,
    authors: parsed.data.authors ?? null,
    year: parsed.data.year ?? null,
    link_or_doi: parsed.data.linkOrDoi ?? null,
    topic: parsed.data.topic ?? null,
    claim_supported: parsed.data.claimSupported ?? null,
    notes: parsed.data.notes ?? null,
    submitted_by: session!.userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/contribute/suggestions");
  revalidatePath("/admin/suggestions");
  return { success: true };
}
