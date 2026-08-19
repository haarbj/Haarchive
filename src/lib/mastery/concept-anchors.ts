// Resolves "which of our curated Concepts have a real, in-page heading
// anchor on this specific topic page" -- the missing link that lets
// "concept breadth" (Phase 1's concept_engaged signal) actually fire.
// Every CONCEPT_SEEDS entry's topicSlug was deliberately chosen to match
// the page its glossary.ts href actually points at (see taxonomy.ts's own
// header comment), so a concept's anchor is always on its own topic's page
// when one exists -- never a different page's anchor.
//
// Known, documented gap (Phase 3 audit, unchanged as of this writing --
// content-authoring work, deliberately not attempted here): 7 of the 51
// seeded concepts have no resolvable anchor and can therefore never fire
// concept_engaged: vo2-max, capillary-density, mitochondria (page-level
// glossary hrefs, no #fragment), neuromuscular-power, biomechanics-form
// (no glossaryTermId at all), and double-threshold, vdot (hrefs point at
// a coach detail page with no fragment). A related, worse case:
// "periodization"'s href is /coaching-library#the-pyramid, but no heading
// with that id currently exists anywhere in coaching-library-home.tsx --
// the anchor is stale, not just page-level, so this concept is
// unreachable even though conceptAnchorsForTopic can't detect that case
// specifically (a missing #fragment is filtered out below; a #fragment
// pointing at nothing isn't, since that requires knowing the live DOM).
//
// This is safe, not just documented: concept_engaged can only ever be
// logged through ReadingProgressBar's onConceptSeen callback, which only
// ever iterates the anchors this function actually returns (see
// article-layout.tsx and coaching-library/[coach]/page.tsx, the only two
// call sites) -- an unresolvable concept is never in that list, so it can
// never appear in a learning_events row and computeMastery's
// distinctConcepts() can never count it. The guarantee lives in "no call
// site bypasses this filter," not a database constraint -- worth keeping
// true if a future call site is ever added.

import { glossaryTerms } from "@/lib/glossary";
import { CONCEPT_SEEDS } from "@/lib/mastery/taxonomy";

export type ConceptAnchor = {
  slug: string;
  anchorId: string;
};

const glossaryHrefById = new Map(glossaryTerms.map((term) => [term.id, term.href]));

function anchorIdFromHref(href: string): string | null {
  const hashIndex = href.indexOf("#");
  return hashIndex === -1 ? null : href.slice(hashIndex + 1);
}

// Concepts with no glossaryTermId (e.g. "neuromuscular-power",
// "biomechanics-form" -- see taxonomy.ts) or whose glossary href has no
// anchor fragment (a page-level link, not a specific heading) have nothing
// to detect a scroll-past against, so they're correctly excluded here
// rather than firing on every visit to the page.
export function conceptAnchorsForTopic(topicSlug: string): ConceptAnchor[] {
  return CONCEPT_SEEDS.filter((c) => c.topicSlug === topicSlug)
    .map((c): ConceptAnchor | null => {
      if (!c.glossaryTermId) return null;
      const href = glossaryHrefById.get(c.glossaryTermId);
      if (!href) return null;
      const anchorId = anchorIdFromHref(href);
      return anchorId ? { slug: c.slug, anchorId } : null;
    })
    .filter((a): a is ConceptAnchor => a !== null);
}
