import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { ARTICLE_STATUS_LABELS } from "@/lib/articles/constants";
import { buildArticleAttribution } from "@/lib/articles/attribution";
import { isArticleAuthor } from "@/lib/articles/is-author";
import { mapArticleRow, type ArticleRow } from "@/lib/articles/map-row";
import { mapPublicCitationRow } from "@/lib/articles/citations";
import { categoryMap, type Section } from "@/lib/sections";
import { estimateReadingMinutes } from "@/lib/reading-time";
import { ArticleHero } from "@/components/article-hero";
import { ArticleLayout } from "@/components/article-layout";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";

type ContributorRow = { user_id: string; contributor_role: string; title_override: string | null };
type ProfileRow = { id: string; display_name: string; avatar_url: string | null };
type ContributorProfileRow = { user_id: string; title: string | null };

// Which page linked here -- admin/articles/[id], contribute/articles/[id],
// and contribute/review/[id] each pass their own `?from=` so "back" returns
// to the actual queue the viewer came from, rather than being guessed from
// role. Guessing from isAuthor/isAdmin alone broke for an admin previewing
// their own article: they're both an admin AND the author, so role alone
// can't tell whether they arrived from the admin queue or their own drafts.
type PreviewOrigin = "admin" | "review" | "author";

const BACK_HREF: Record<PreviewOrigin, (articleId: string) => string> = {
  admin: (articleId) => `/admin/articles/${articleId}`,
  review: (articleId) => `/contribute/review/${articleId}`,
  author: (articleId) => `/contribute/articles/${articleId}`,
};

const BACK_LABEL: Record<PreviewOrigin, string> = {
  admin: "article",
  review: "review",
  author: "draft",
};

function isPreviewOrigin(value: string | undefined): value is PreviewOrigin {
  return value === "admin" || value === "review" || value === "author";
}

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
export default async function PreviewArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const session = await getAppSession(); // non-null: contribute/layout.tsx already gated
  const admin = createServiceRoleClient();

  const { data: row } = await admin.from("articles").select("*").eq("id", id).maybeSingle<ArticleRow>();
  if (!row) notFound();

  const isAuthor = await isArticleAuthor(admin, id, session!.userId, row.primary_author_id);
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

  const [{ data: contributors }, { data: citationRows }] = await Promise.all([
    admin
      .from("article_contributors")
      .select("user_id, contributor_role, title_override")
      .eq("article_id", article.id)
      .returns<ContributorRow[]>(),
    // service-role, so this isn't gated by article_citations_select_
    // published like the live page is -- a preview should show citations
    // on a still-unpublished draft too.
    admin
      .from("article_citations")
      .select("id, paper_title, authors, year, link_or_doi")
      .eq("article_id", article.id)
      .returns<{ id: string; paper_title: string; authors: string | null; year: number | null; link_or_doi: string | null }[]>(),
  ]);
  const citations = (citationRows ?? []).map(mapPublicCitationRow);

  const userIds = (contributors ?? []).map((c) => c.user_id);
  const [{ data: profiles }, { data: contributorProfiles }] = userIds.length
    ? await Promise.all([
        admin.from("profiles").select("id, display_name, avatar_url").in("id", userIds).returns<ProfileRow[]>(),
        admin.from("contributor_profiles").select("user_id, title").in("user_id", userIds).returns<ContributorProfileRow[]>(),
      ])
    : [{ data: [] as ProfileRow[] }, { data: [] as ContributorProfileRow[] }];

  // A still-unpublished draft has no real published_at yet -- since this
  // page's whole premise is "exactly how it'll look once published,"
  // showing today's date here simulates publishing it right now, rather
  // than silently dropping the date line until it actually goes live.
  const attribution = buildArticleAttribution(
    contributors ?? [],
    profiles ?? [],
    contributorProfiles ?? [],
    article.primaryAuthorId,
    article.publishedAt ?? new Date().toISOString(),
    article.evidenceCategory,
  );

  const parentCategory = categoryMap.get("archive")!;
  const previewSection: Section = {
    slug: article.slug,
    title: article.title,
    mission: article.subtitle ?? "",
    topics: [],
    category: "archive",
    content: article.content,
  };

  // Falls back to the old role-based guess only when `from` is missing
  // (e.g. a bookmarked or shared preview URL with no origin attached).
  const origin: PreviewOrigin = isPreviewOrigin(from) ? from : isAuthor ? "author" : "review";
  const backHref = BACK_HREF[origin](article.id);
  const backLabel = BACK_LABEL[origin];

  return (
    <Container variant="content">
      <div className="rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200">
        <strong>Preview</strong>: this is exactly how the article will look once published ({ARTICLE_STATUS_LABELS[article.status]} now). Not visible to readers yet.
      </div>
      <div className="mt-4">
        <BackLink href={backHref}>Back to {backLabel}</BackLink>
      </div>
      <ArticleHero
        title={previewSection.title}
        mission={article.subtitle}
        articleType={article.articleType}
        attribution={attribution}
        readingMinutes={estimateReadingMinutes(article.content)}
        contentSlug={previewSection.slug}
        content={previewSection.content ?? []}
        // A still-unpublished draft can't have a real bookmark yet -- no
        // query needed, this is trivially always false in a preview.
        initialBookmarked={false}
      />
      <ArticleLayout
        section={previewSection}
        category={parentCategory}
        content={previewSection.content ?? []}
        attribution={attribution}
        citations={citations}
        coverImageUrl={article.coverImageUrl}
      />
    </Container>
  );
}
