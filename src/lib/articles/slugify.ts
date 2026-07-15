import { categoryMap, sectionMap } from "@/lib/sections";

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// A brand-new article's slug must never collide with a Foundations section
// or category slug -- both are rendered by the exact same [slug] route, and
// sectionMap/categoryMap are the real, permanent site map (an article slug
// can't collide with a future one either, since Foundations only changes
// via a code deploy this check would catch at review time).
export function isReservedSlug(slug: string): boolean {
  return sectionMap.has(slug) || categoryMap.has(slug);
}
