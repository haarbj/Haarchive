import { sectionMap } from "@/lib/sections";

// Phase 4.1 audit finding, extracted in Phase 5.1 so the dashboard and the
// Library can't drift apart on this definition: means "this topic can fire
// content_viewed/content_engaged," NOT "this topic has a sections.ts
// `content` array" -- those aren't the same set. training-plans and every
// calculator have neither (tool_used is genuinely their only possible
// signal, contributed once as a flat, non-repeating +8 -- see
// algorithm.ts's WEIGHT_TOOL -- which never crosses the 20-point Familiar
// threshold, making Exploring their real, permanent ceiling). But
// coaching-library, athlete-library, and training-philosophy *also* have
// no sections.ts `content` array (all three are bespoke templates) while
// genuinely firing content_viewed/content_engaged from real prose
// elsewhere (coach/athlete detail pages, the flagship essay page) -- see
// mastery-explanation.ts's own comment on the original dashboard bug this
// fixed, and library/page.tsx's Continue Reading section for the second
// place this same distinction turned out to matter (Phase 5.1).
export function hasReadableContent(slug: string): boolean {
  return (
    !!sectionMap.get(slug)?.content?.length ||
    slug === "coaching-library" ||
    slug === "athlete-library" ||
    slug === "training-philosophy"
  );
}
