// Pure aggregation over submitted questions -- no ML, just counting. Groups
// visible, not-yet-in-the-library questions by category and by tag, so the
// admin dashboard can surface "N questions about X" and flag clusters worth
// turning into a dedicated article.

export type KnowledgeGapInput = {
  category: string | null;
  tags: string[];
  status: string;
};

export type KnowledgeGap = {
  label: string;
  kind: "category" | "tag";
  count: number;
  flagged: boolean;
};

const FLAG_THRESHOLD = 8;

// A question already folded into the library is no longer a gap -- counting
// it would make a solved topic look like open demand.
function isOpenGap(status: string): boolean {
  return status !== "added_to_library";
}

export function computeKnowledgeGaps(
  questions: KnowledgeGapInput[],
  threshold = FLAG_THRESHOLD,
): KnowledgeGap[] {
  const counts = new Map<string, { kind: "category" | "tag"; count: number }>();

  for (const question of questions) {
    if (!isOpenGap(question.status)) continue;

    if (question.category) {
      const key = `category:${question.category}`;
      counts.set(key, { kind: "category", count: (counts.get(key)?.count ?? 0) + 1 });
    }
    for (const tag of question.tags) {
      const key = `tag:${tag}`;
      counts.set(key, { kind: "tag", count: (counts.get(key)?.count ?? 0) + 1 });
    }
  }

  const gaps: KnowledgeGap[] = Array.from(counts.entries()).map(([key, value]) => ({
    label: key.slice(key.indexOf(":") + 1),
    kind: value.kind,
    count: value.count,
    flagged: value.count >= threshold,
  }));

  gaps.sort((a, b) => b.count - a.count);
  return gaps;
}
