// Deterministic section-depth analysis -- Part 2 of the feature spec.
// Deliberately no LLM involved anywhere in this file (Part 13): every
// signal below is a plain count or regex match over the section's own real
// content blocks.

import { countWords, extractSectionUnits } from "@/lib/knowledge-checks/extract";
import type { ConceptCandidate, CognitiveLevel, DepthAssessment, DepthTier, SectionForAnalysis, SectionMetrics } from "@/lib/knowledge-checks/types";

// Density signals -- Part 2's "numerical ranges or formulas" and "named
// researchers/coaches/models" bullets. Deliberately simple, high-precision
// patterns over a broad NLP-style one: false negatives (missing an
// occasional number/citation) are fine for a *depth* signal that's already
// combined with several others; false positives would inflate every
// section roughly equally and stop being a useful discriminator.
const NUMERIC_SIGNAL_RE = /\d+(\.\d+)?\s*(%|percent|mmol|mmol\/l|ml|l\/min|bpm|bpm\/min|g\/min|kg|km|miles?|mi\b|meters?|m\b|minutes?|min\b|seconds?|sec\b|weeks?|hours?|hrs?)\b/gi;
const CITATION_SIGNAL_RE = /\([A-Z][a-zA-Z'.-]+(?:,|\s+(?:&|and|et al\.))/g;

export function computeSectionMetrics(section: SectionForAnalysis, conceptCount: number): SectionMetrics {
  const content = section.content ?? [];
  const units = extractSectionUnits(section);

  let wordCount = 0;
  let paragraphCount = 0;
  let listItemCount = 0;
  let numericSignalCount = 0;
  let citationSignalCount = 0;

  for (const unit of units) {
    wordCount += countWords(unit.text);
    numericSignalCount += unit.text.match(NUMERIC_SIGNAL_RE)?.length ?? 0;
    citationSignalCount += unit.text.match(CITATION_SIGNAL_RE)?.length ?? 0;
    if (unit.blockType === "paragraph") paragraphCount += 1;
    if (unit.blockType === "list") listItemCount += 1;
  }

  // Counted from the raw block list, not from `units` -- a callout with
  // both a title and a body text produces two text-bearing units above,
  // but it's still one callout block structurally, which is the signal
  // this count is meant to be (Part 2's "callout" density bullet).
  let headingCount = 0;
  let h2Count = 0;
  const calloutCounts: Record<string, number> = {};
  for (const block of content) {
    if (block.type === "heading") {
      headingCount += 1;
      if ((block.level ?? 2) === 2) h2Count += 1;
    } else if (block.type === "callout") {
      calloutCounts[block.variant] = (calloutCounts[block.variant] ?? 0) + 1;
    }
  }

  return {
    slug: section.slug,
    wordCount,
    headingCount,
    h2Count,
    paragraphCount,
    listItemCount,
    calloutCounts,
    numericSignalCount,
    citationSignalCount,
    conceptCount,
  };
}

// A blended score, not raw word count -- Part 2's explicit requirement.
// Weights were chosen, then checked, against the real distribution across
// all 43 sections.ts entries (see docs/knowledge-check-scaling/audit.md):
// word count dominates (most sections' depth genuinely does track how much
// there is to say), but heading/concept/callout/density counts pull a
// short-but-dense section up and a long-but-repetitive one down relative
// to word count alone.
const WORDS_PER_POINT = 500;
const WEIGHT_HEADING = 0.5;
const WEIGHT_CONCEPT = 1.0;
const WEIGHT_CALLOUT = 0.3;
const CALLOUT_CAP = 10;
const WEIGHT_DENSITY = 0.2;
const DENSITY_CAP = 15;

export function computeDepthScore(metrics: SectionMetrics): number {
  const calloutTotal = Object.values(metrics.calloutCounts).reduce((a, b) => a + b, 0);
  const densitySignals = metrics.numericSignalCount + metrics.citationSignalCount;

  return (
    metrics.wordCount / WORDS_PER_POINT +
    metrics.headingCount * WEIGHT_HEADING +
    metrics.conceptCount * WEIGHT_CONCEPT +
    Math.min(calloutTotal, CALLOUT_CAP) * WEIGHT_CALLOUT +
    Math.min(densitySignals, DENSITY_CAP) * WEIGHT_DENSITY
  );
}

// Tier boundaries, calibrated against the real score distribution across
// every sections.ts entry that has content (see the audit doc). Expressed
// as "score below this upper bound" rather than a linear formula, per the
// spec's explicit "tiered system rather than an arbitrary linear formula"
// instruction.
const TIER_BOUNDS: { tier: DepthTier; scoreBelow: number; recommended: number }[] = [
  { tier: "very_short", scoreBelow: 4, recommended: 2 },
  { tier: "short", scoreBelow: 8, recommended: 3 },
  { tier: "moderate", scoreBelow: 16, recommended: 4 },
  { tier: "long", scoreBelow: 28, recommended: 6 },
  { tier: "very_long", scoreBelow: Infinity, recommended: 8 },
];

// Within "moderate" and "very_long", the top half of the range earns one
// extra question (5 instead of 4; 10 instead of 8) -- a coarse two-step
// split inside the tier rather than a fixed number for the whole tier,
// since "moderate" and "very_long" both span a genuinely wide score range.
function refineRecommendedCount(tier: DepthTier, score: number): number {
  if (tier === "moderate") return score >= 12 ? 5 : 4;
  if (tier === "long") return score >= 22 ? 7 : 6;
  if (tier === "very_long") return score >= 40 ? 10 : score >= 34 ? 9 : 8;
  return TIER_BOUNDS.find((b) => b.tier === tier)!.recommended;
}

// Target cognitive-level mix per tier, expressed as weights (Part 4): a
// short section stays mostly recall/understand; longer, denser sections
// shift toward apply/reason. Rounded to fit the tier's exact recommended
// count via largest-remainder, so the four numbers always sum to it.
const COGNITIVE_WEIGHTS: Record<DepthTier, Record<CognitiveLevel, number>> = {
  very_short: { recall: 0.6, understand: 0.4, apply: 0, reason: 0 },
  short: { recall: 0.4, understand: 0.35, apply: 0.25, reason: 0 },
  moderate: { recall: 0.3, understand: 0.3, apply: 0.25, reason: 0.15 },
  long: { recall: 0.25, understand: 0.3, apply: 0.25, reason: 0.2 },
  very_long: { recall: 0.2, understand: 0.3, apply: 0.25, reason: 0.25 },
};

function distributeCognitiveLevels(tier: DepthTier, count: number): Record<CognitiveLevel, number> {
  const weights = COGNITIVE_WEIGHTS[tier];
  const levels: CognitiveLevel[] = ["recall", "understand", "apply", "reason"];
  const raw = levels.map((level) => weights[level] * count);
  const floors = raw.map(Math.floor);
  let remainder = count - floors.reduce((a, b) => a + b, 0);

  // Largest-remainder method: hand out leftover slots to whichever levels
  // rounded down the most, so small counts (e.g. 2-3 questions) still
  // produce a sensible, non-empty mix instead of collapsing to one level.
  const order = raw
    .map((value, i) => ({ i, frac: value - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }

  const result = {} as Record<CognitiveLevel, number>;
  levels.forEach((level, i) => (result[level] = floors[i]));
  return result;
}

export function classifyDepthTier(metrics: SectionMetrics): DepthAssessment {
  const score = computeDepthScore(metrics);
  const bound = TIER_BOUNDS.find((b) => score < b.scoreBelow) ?? TIER_BOUNDS[TIER_BOUNDS.length - 1];
  const recommendedQuestions = refineRecommendedCount(bound.tier, score);

  return {
    tier: bound.tier,
    score,
    recommendedQuestions,
    cognitiveLevelTargets: distributeCognitiveLevels(bound.tier, recommendedQuestions),
  };
}

export function assessSectionDepth(
  section: SectionForAnalysis,
  concepts: ConceptCandidate[],
): { metrics: SectionMetrics; assessment: DepthAssessment } {
  const metrics = computeSectionMetrics(section, concepts.length);
  return { metrics, assessment: classifyDepthTier(metrics) };
}
