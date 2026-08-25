import type { ContentBlock } from "@/lib/sections";
import { createClient } from "@/lib/db/server";
import { estimateReadingMinutes } from "@/lib/reading-time";

export type PublishedArticleListItem = {
  slug: string;
  title: string;
  subtitle: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  articleType: string;
  readingMinutes: number;
};

// Shared by the Articles index (every published article) and an individual
// article page's "Continue Reading" list (see selectRelatedArticles below)
// -- one query, not two separately hand-maintained ones.
export async function loadPublishedArticleList(): Promise<PublishedArticleListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("slug, title, subtitle, published_at, cover_image_url, tags, article_type, content")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .returns<
      {
        slug: string;
        title: string;
        subtitle: string | null;
        published_at: string | null;
        cover_image_url: string | null;
        tags: string[] | null;
        article_type: string;
        content: ContentBlock[] | null;
      }[]
    >();
  return (data ?? []).map((row) => ({
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    publishedAt: row.published_at,
    coverImageUrl: row.cover_image_url,
    tags: row.tags ?? [],
    articleType: row.article_type,
    readingMinutes: estimateReadingMinutes(row.content ?? []),
  }));
}

// "Continue Reading" candidates for an individual article page. Pure and
// separately testable, per this project's convention for anything with
// real selection logic (see e.g. hr-model.ts). Existing data only -- no
// invented metadata: prefers other published articles that share at least
// one tag with the current one (most shared tags first, tie-broken by
// most recent), falls back to the most recent other articles once the
// shared-tag pool runs out, and never includes the current article.
export function selectRelatedArticles(
  all: PublishedArticleListItem[],
  currentSlug: string,
  tags: string[],
  limit = 3,
): PublishedArticleListItem[] {
  const currentTags = new Set(tags);
  const candidates = all.filter((article) => article.slug !== currentSlug);

  const scored = candidates.map((article) => ({
    article,
    sharedTagCount: article.tags.filter((tag) => currentTags.has(tag)).length,
  }));

  scored.sort((a, b) => {
    if (b.sharedTagCount !== a.sharedTagCount) return b.sharedTagCount - a.sharedTagCount;
    const aTime = a.article.publishedAt ? new Date(a.article.publishedAt).getTime() : 0;
    const bTime = b.article.publishedAt ? new Date(b.article.publishedAt).getTime() : 0;
    return bTime - aTime;
  });

  return scored.slice(0, limit).map((entry) => entry.article);
}
