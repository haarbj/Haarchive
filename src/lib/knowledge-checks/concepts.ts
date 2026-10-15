// Concept derivation -- Part 3 of the feature spec. Reuses the existing,
// hand-curated CONCEPT_SEEDS (src/lib/mastery/taxonomy.ts) as the
// authoritative signal where it already covers a topic, and falls back to
// a deterministic, heading-derived concept list where it doesn't --
// CONCEPT_SEEDS' own header comment documents that coverage is
// intentionally uneven (several topics with real educational depth have
// zero curated concepts), so treating it as the *only* source would leave
// most of sections.ts unable to get concept-coverage tracking at all.
//
// Deliberately not a new taxonomy: this module never invents a concept
// slug that isn't traceable to either a real CONCEPT_SEEDS row or a real
// h2 heading already in sections.ts.

import { CONCEPT_SEEDS } from "@/lib/mastery/taxonomy";
import { groupByH2, slugify, tokenize } from "@/lib/knowledge-checks/extract";
import type { ConceptCandidate, SectionForAnalysis } from "@/lib/knowledge-checks/types";

function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let shared = 0;
  for (const t of aTokens) if (bTokens.has(t)) shared += 1;
  return shared / Math.min(aTokens.size, bTokens.size);
}

// A heading counts as "already represented" by a curated concept if their
// titles share most of their meaningful tokens (e.g. heading "VO2 Max Is
// Two Adaptations Sharing One Name" vs. curated concept "VO₂ Max") -- a
// loose match on purpose, since headings are usually a full sentence and
// concepts are usually a short noun phrase.
const OVERLAP_THRESHOLD = 0.5;

export function deriveConcepts(section: SectionForAnalysis): ConceptCandidate[] {
  const curated: ConceptCandidate[] = CONCEPT_SEEDS.filter((c) => c.topicSlug === section.slug).map((c) => ({
    slug: c.slug,
    title: c.title,
    source: "curated",
  }));

  const groups = groupByH2(section.content ?? []);
  const headingCandidates: ConceptCandidate[] = [];

  for (const group of groups) {
    const alreadyCovered = curated.some((c) => tokenOverlap(c.title, group.heading) >= OVERLAP_THRESHOLD);
    if (alreadyCovered) continue;

    const slug = slugify(group.heading);
    if (!slug) continue;
    // Skip near-duplicate headings within the fallback set itself (e.g. a
    // section with two very similarly-worded h2s) rather than producing
    // two concepts a reader would experience as the same idea.
    if (headingCandidates.some((c) => tokenOverlap(c.title, group.heading) >= OVERLAP_THRESHOLD)) continue;

    headingCandidates.push({ slug, title: group.heading, source: "heading" });
  }

  const derived = [...curated, ...headingCandidates];

  // A handful of real sections.ts entries have real prose but zero heading
  // blocks at all (e.g. training-through-the-decades) -- groupByH2 can't
  // derive anything from a section with no h2 to group under, but the
  // section still has real content someone should be able to write a
  // question about. Falling back to one whole-section concept keeps
  // coverage tracking and generation meaningful instead of permanently
  // reporting 0 concepts / 0% coverage for content that genuinely exists.
  if (derived.length === 0 && (section.content?.length ?? 0) > 0) {
    return [{ slug: slugify(section.title) || section.slug, title: section.title, source: "heading" }];
  }

  return derived;
}
