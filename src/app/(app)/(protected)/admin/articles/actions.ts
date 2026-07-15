"use server";

import { revalidatePath } from "next/cache";

import { getAppSession, type AppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import {
  ALLOWED_ARTICLE_TRANSITIONS,
  ARTICLE_CONTRIBUTOR_ROLES,
  ARTICLE_STATUSES,
  type ArticleContributorRole,
} from "@/lib/articles/constants";

export type ArticleAdminState = { error?: string; success?: boolean };

async function requireAdmin(): Promise<AppSession> {
  const session = await getAppSession();
  return session?.isAdmin ? session : null;
}

// Admin-only: assigning authors/reviewers/contributors is part of "managing
// the content workflow", not something a contributor does for themselves
// (see the original permissions spec's Content Contributor/Reviewer "cannot"
// lists). upsert on (article_id, user_id) so re-adding someone with a
// different role just changes their role rather than erroring.
export async function addArticleContributor(
  _prevState: ArticleAdminState,
  formData: FormData,
): Promise<ArticleAdminState> {
  const session = await requireAdmin();
  if (!session) return { error: "Not authorized." };

  const articleId = formData.get("articleId");
  const userId = formData.get("userId");
  const role = formData.get("contributorRole");
  if (typeof articleId !== "string" || typeof userId !== "string" || typeof role !== "string" || !userId) {
    return { error: "Choose a user and a role." };
  }
  if (!(ARTICLE_CONTRIBUTOR_ROLES as readonly string[]).includes(role)) {
    return { error: "Invalid role." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("article_contributors")
    .upsert(
      { article_id: articleId, user_id: userId, contributor_role: role as ArticleContributorRole },
      { onConflict: "article_id,user_id" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/admin/articles/${articleId}`);
  return { success: true };
}

export async function removeArticleContributor(contributorRowId: string, articleId: string): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const admin = createServiceRoleClient();
  await admin.from("article_contributors").delete().eq("id", contributorRowId);
  revalidatePath(`/admin/articles/${articleId}`);
}

export async function transitionArticleStatus(
  _prevState: ArticleAdminState,
  formData: FormData,
): Promise<ArticleAdminState> {
  const session = await requireAdmin();
  if (!session) return { error: "Not authorized." };

  const articleId = formData.get("articleId");
  const nextStatusRaw = formData.get("nextStatus");
  if (typeof articleId !== "string" || typeof nextStatusRaw !== "string") return { error: "Missing fields." };
  if (!(ARTICLE_STATUSES as readonly string[]).includes(nextStatusRaw)) return { error: "Invalid status." };
  const nextStatus = nextStatusRaw as (typeof ARTICLE_STATUSES)[number];

  const admin = createServiceRoleClient();
  const { data: article } = await admin.from("articles").select("status").eq("id", articleId).maybeSingle();
  if (!article) return { error: "Article not found." };

  const allowed = ALLOWED_ARTICLE_TRANSITIONS[article.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return { error: `Can't move an article from ${article.status} to ${nextStatus}.` };
  }

  const update: { status: string; published_at?: string | null } = { status: nextStatus };
  if (nextStatus === "published") update.published_at = new Date().toISOString();
  if (article.status === "published" && nextStatus !== "published") update.published_at = null;

  const { data: updated, error } = await admin
    .from("articles")
    .update(update)
    .eq("id", articleId)
    .select("slug")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath("/admin/articles");
  revalidatePath("/contribute/articles");
  revalidatePath("/contribute/review");
  if (updated?.slug) {
    revalidatePath(`/${updated.slug}`);
    revalidatePath("/articles");
  }
  return { success: true };
}

// Deliberately refuses to delete a published article (must be unpublished
// first) -- deleting a live, linked page out from under readers is a
// different, riskier action than cleaning up an abandoned draft.
export async function deleteArticleDraft(articleId: string): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const admin = createServiceRoleClient();
  const { data: article } = await admin.from("articles").select("status").eq("id", articleId).maybeSingle();
  if (!article || article.status === "published") return;

  await admin.from("articles").delete().eq("id", articleId);
  revalidatePath("/admin/articles");
}
