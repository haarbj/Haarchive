import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { ARTICLE_STATUS_LABELS } from "@/lib/articles/constants";
import { buildArticleAttribution } from "@/lib/articles/attribution";
import { mapArticleRow, type ArticleRow } from "@/lib/articles/map-row";
import { categoryMap, type Section } from "@/lib/sections";
import { ArticleLayout } from "@/components/article-layout";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

type ContributorRow = { user_id: string; contributor_role: string; title_override: string | null };
type ProfileRow = { id: string; display_name: string; avatar_url: string | null };
type ContributorProfileRow = { user_id: string; title: string | null };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const admin = createServiceRoleClient();
  const { data: article } = await admin.from("articles").select("title").eq("id", id).maybeSingle<{ title: string }>();
  return { title: article ? `Preview: ${article.title}` : "Preview" };
}

// The article-authoring pipeline stores drafts and published pieces in the
// exact same `articles` row/ContentBlock[] shape and renders both through
// the exact same ArticleLayout/ContentBlocks components (see [slug]/page.tsx
// -- publishing is purely a status-column flip, no content transform) --
// so a preview just means running that same render for a not-yet-published
// row, gated by permission instead of `status = 'published'`. Open to the
// author, an assigned reviewer, or an admin -- the same three audiences
// already split across the edit page and the review page.
export default async function PreviewArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAppSession(); // non-null: contribute/layout.tsx already gated
  const admin = createServiceRoleClient();

  const { data: row } = await admin.from("articles").select("*").eq("id", id).maybeSingle<ArticleRow>();
  if (!row) notFound();

  const isAuthor = row.primary_author_id === session!.userId;
  let isReviewer = false;
  if (!session!.isAdmin && !isAuthor) {
    const { data: assignment } = await admin
      .from("article_contributors")
      .select("id")
      .eq("article_id", id)
      .eq("user_id", session!.userId)
      .eq("contributor_role", "reviewer")
      .maybeSingle();
    isReviewer = !!assignment;
  }
  if (!session!.isAdmin && !isAuthor && !isReviewer) notFound();

  const article = mapArticleRow(row);

  const { data: contributors } = await admin
    .from("article_contributors")
    .select("user_id, contributor_role, title_override")
    .eq("article_id", article.id)
    .returns<ContributorRow[]>();

  const userIds = (contributors ?? []).map((c) => c.user_id);
  const [{ data: profiles }, { data: contributorProfiles }] = userIds.length
    ? await Promise.all([
        admin.from("profiles").select("id, display_name, avatar_url").in("id", userIds).returns<ProfileRow[]>(),
        admin.from("contributor_profiles").select("user_id, title").in("user_id", userIds).returns<ContributorProfileRow[]>(),
      ])
    : [{ data: [] as ProfileRow[] }, { data: [] as ContributorProfileRow[] }];

  const attribution = buildArticleAttribution(
    contributors ?? [],
    profiles ?? [],
    contributorProfiles ?? [],
    article.publishedAt,
    article.evidenceCategory,
  );

  const parentCategory = categoryMap.get("writing-and-resources")!;
  const previewSection: Section = {
    slug: article.slug,
    title: article.title,
    mission: article.subtitle ?? "",
    topics: [],
    category: "writing-and-resources",
    content: article.content,
  };

  const backHref = isAuthor ? `/contribute/articles/${article.id}` : `/contribute/review/${article.id}`;

  return (
    <Container variant="content">
      <div className="rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200">
        <strong>Preview</strong> — this is exactly how the article will look once published ({ARTICLE_STATUS_LABELS[article.status]} now). Not visible to readers yet.
      </div>
      <div className="mt-4">
        <BackLink href={backHref}>Back to {isAuthor ? "draft" : "review"}</BackLink>
      </div>
      <Heading>{previewSection.title}</Heading>
      {previewSection.mission ? (
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{previewSection.mission}</p>
      ) : null}
      <ArticleLayout section={previewSection} category={parentCategory} content={previewSection.content ?? []} attribution={attribution} />
    </Container>
  );
}
