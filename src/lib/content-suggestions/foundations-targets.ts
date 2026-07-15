import { categoryMap, sections } from "@/lib/sections";

export type FoundationsSuggestionTarget = { slug: string; title: string; categoryTitle: string };

// Deliberately excludes "writing-and-resources" (the Articles pipeline now
// has its own contributor-authored workflow, see /contribute/articles) and
// "tools" (interactive calculators, not textual content) -- what's left is
// exactly the Foundations pages the original spec's examples name
// (Exercise Physiology, the Aerobic Base, Nutrition & Fueling, Recovery,
// Training Philosophy). Only sections with real content qualify, so a
// still-empty "Planned Topics" placeholder page can't be suggested against.
export function listFoundationsSuggestionTargets(): FoundationsSuggestionTarget[] {
  return sections
    .filter((s) => s.category !== "writing-and-resources" && s.category !== "tools" && !!s.content?.length)
    .map((s) => ({ slug: s.slug, title: s.title, categoryTitle: categoryMap.get(s.category)?.title ?? s.category }));
}

export function isFoundationsSuggestionTarget(slug: string): boolean {
  return listFoundationsSuggestionTargets().some((t) => t.slug === slug);
}
