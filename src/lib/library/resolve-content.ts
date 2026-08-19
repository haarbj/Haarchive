import { categoryMap, sectionMap } from "@/lib/sections";

export type ResolvedContent = {
  title: string;
  categorySlug: string | null;
  categoryTitle: string | null;
};

// A note or bookmark's content_slug/topic_slug can point at either a real
// taxonomy topic (sections.ts) or a DB-backed contributor article (a
// separate slug namespace entirely -- see article-layout.tsx's own
// `attribution` branch). This only ever resolves the first kind; the
// Library page itself falls back to a direct `articles` table lookup (by
// slug, batched in one query) for whatever this returns null for, since
// that lookup needs a DB round-trip this pure, sync function can't make.
export function resolveTopicMetadata(slug: string): ResolvedContent | null {
  const section = sectionMap.get(slug);
  if (!section) return null;
  const category = categoryMap.get(section.category);
  return {
    title: section.title,
    categorySlug: section.category,
    categoryTitle: category?.title ?? null,
  };
}
