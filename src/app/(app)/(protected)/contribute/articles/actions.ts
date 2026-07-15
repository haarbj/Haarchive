"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { hasContentPermission } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { articleDraftSchema, citationsSchema, type CitationInput } from "@/lib/validation/articles";
import { isReservedSlug, slugifyTitle } from "@/lib/articles/slugify";

export type ArticleDraftState = { error?: string; success?: boolean };

function parseDraftForm(formData: FormData) {
  return articleDraftSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle"),
    articleType: formData.get("articleType"),
    evidenceCategory: formData.get("evidenceCategory"),
    tagsInput: formData.get("tagsInput"),
    coverImageUrl: formData.get("coverImageUrl"),
    contentJson: formData.get("contentJson"),
  });
}

function parseCitationsForm(formData: FormData) {
  const raw = formData.get("citationsJson");
  let parsedJson: unknown = [];
  if (typeof raw === "string" && raw.trim()) {
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return { success: false as const, error: "Invalid citations." };
    }
  }
  const result = citationsSchema.safeParse(parsedJson);
  if (!result.success) return { success: false as const, error: result.error.issues[0]?.message ?? "Invalid citations." };
  return { success: true as const, data: result.data };
}

async function replaceCitations(
  admin: ReturnType<typeof createServiceRoleClient>,
  articleId: string,
  citations: CitationInput[],
  submittedBy: string,
) {
  await admin.from("article_citations").delete().eq("article_id", articleId);
  if (citations.length === 0) return null;
  const { error } = await admin.from("article_citations").insert(
    citations.map((c) => ({
      article_id: articleId,
      paper_title: c.paperTitle,
      authors: c.authors ?? null,
      year: c.year ?? null,
      link_or_doi: c.linkOrDoi ?? null,
      topic: c.topic ?? null,
      claim_supported: c.claimSupported ?? null,
      notes: c.notes ?? null,
      submitted_by: submittedBy,
    })),
  );
  return error;
}

// Contributors create/edit their own drafts here; everything is
// service-role-mediated (see the articles migration's own comment) since
// "am I the primary author, or admin, and is this still editable" is an
// application-level check, not something built into RLS for this table.
export async function createArticleDraft(
  _prevState: ArticleDraftState,
  formData: FormData,
): Promise<ArticleDraftState> {
  const session = await getAppSession();
  if (!session || (!session.isAdmin && !hasContentPermission(session.permissions, "content_contributor"))) {
    return { error: "Not authorized." };
  }

  const parsed = parseDraftForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const citationsResult = parseCitationsForm(formData);
  if (!citationsResult.success) return { error: citationsResult.error };

  const slug = slugifyTitle(parsed.data.title);
  if (!slug || isReservedSlug(slug)) {
    return { error: "That title produces a page address that's already in use — try a more specific title." };
  }

  const admin = createServiceRoleClient();
  const { data: existing } = await admin.from("articles").select("id").eq("slug", slug).maybeSingle();
  if (existing) return { error: "An article with that title already exists — try a more specific title." };

  const { data: article, error } = await admin
    .from("articles")
    .insert({
      slug,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle ?? null,
      article_type: parsed.data.articleType,
      evidence_category: parsed.data.evidenceCategory ?? null,
      tags: parsed.data.tagsInput,
      cover_image_url: parsed.data.coverImageUrl || null,
      content: parsed.data.contentJson,
      primary_author_id: session.userId,
    })
    .select("id")
    .single();
  if (error || !article) return { error: error?.message ?? "Could not create draft." };

  const { error: contributorError } = await admin
    .from("article_contributors")
    .insert({ article_id: article.id, user_id: session.userId, contributor_role: "author" });
  if (contributorError) return { error: contributorError.message };

  const citationError = await replaceCitations(admin, article.id, citationsResult.data, session.userId);
  if (citationError) return { error: citationError.message };

  revalidatePath("/contribute/articles");
  redirect(`/contribute/articles/${article.id}`);
}

export async function updateArticleDraft(
  _prevState: ArticleDraftState,
  formData: FormData,
): Promise<ArticleDraftState> {
  const session = await getAppSession();
  if (!session) return { error: "Not authorized." };

  const articleId = formData.get("articleId");
  if (typeof articleId !== "string") return { error: "Missing article." };

  const admin = createServiceRoleClient();
  const { data: article } = await admin
    .from("articles")
    .select("primary_author_id, status")
    .eq("id", articleId)
    .maybeSingle();
  if (!article) return { error: "Article not found." };

  const isAuthor = article.primary_author_id === session.userId;
  if (!session.isAdmin && !isAuthor) return { error: "Not authorized." };
  if (!session.isAdmin && article.status !== "draft" && article.status !== "in_review") {
    return { error: "This article can no longer be edited." };
  }

  const parsed = parseDraftForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const citationsResult = parseCitationsForm(formData);
  if (!citationsResult.success) return { error: citationsResult.error };

  // Slug is set once at creation and never changes here, even if the title
  // does -- a title edit shouldn't silently break a link someone already
  // shared to this article.
  const { error } = await admin
    .from("articles")
    .update({
      title: parsed.data.title,
      subtitle: parsed.data.subtitle ?? null,
      article_type: parsed.data.articleType,
      evidence_category: parsed.data.evidenceCategory ?? null,
      tags: parsed.data.tagsInput,
      cover_image_url: parsed.data.coverImageUrl || null,
      content: parsed.data.contentJson,
    })
    .eq("id", articleId);
  if (error) return { error: error.message };

  const citationError = await replaceCitations(admin, articleId, citationsResult.data, session.userId);
  if (citationError) return { error: citationError.message };

  revalidatePath(`/contribute/articles/${articleId}`);
  revalidatePath("/contribute/articles");
  return { success: true };
}

export type SubmitForReviewState = { error?: string; success?: boolean };

export async function submitForReview(
  _prevState: SubmitForReviewState,
  formData: FormData,
): Promise<SubmitForReviewState> {
  const session = await getAppSession();
  if (!session) return { error: "Not authorized." };

  const articleId = formData.get("articleId");
  if (typeof articleId !== "string") return { error: "Missing article." };

  const admin = createServiceRoleClient();
  const { data: article } = await admin
    .from("articles")
    .select("primary_author_id, status, content")
    .eq("id", articleId)
    .maybeSingle();
  if (!article) return { error: "Article not found." };
  if (article.primary_author_id !== session.userId && !session.isAdmin) return { error: "Not authorized." };
  if (article.status !== "draft") return { error: "Only a draft can be submitted for review." };
  if (!Array.isArray(article.content) || article.content.length === 0) {
    return { error: "Add some content before submitting for review." };
  }

  const { error } = await admin.from("articles").update({ status: "in_review" }).eq("id", articleId);
  if (error) return { error: error.message };

  revalidatePath(`/contribute/articles/${articleId}`);
  revalidatePath("/contribute/articles");
  revalidatePath("/admin/articles");
  return { success: true };
}
