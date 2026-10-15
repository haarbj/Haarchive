// Concept coverage -- Part 3 of the feature spec: question count alone
// isn't enough, a knowledge check should sample across a section's major
// concepts rather than clustering around the first few paragraphs.

import type { ConceptCandidate, ConceptCoverage, ExistingQuestionSummary } from "@/lib/knowledge-checks/types";

export function computeCoverage(concepts: ConceptCandidate[], questions: Pick<ExistingQuestionSummary, "concepts">[]): ConceptCoverage {
  const coveredSlugs = new Set<string>();
  for (const q of questions) {
    for (const slug of q.concepts) coveredSlugs.add(slug);
  }

  const uncovered = concepts.filter((c) => !coveredSlugs.has(c.slug));
  const coveragePercent = concepts.length === 0 ? 100 : Math.round(((concepts.length - uncovered.length) / concepts.length) * 100);

  return { concepts, coveredSlugs, uncovered, coveragePercent };
}
