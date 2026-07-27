import type { ContentBlock, Section } from "@/lib/sections";

// Keyword/heading-based retrieval over the site's existing educational
// content -- deliberately not a vector database. The content is already
// organized into named sections and headings, so exact-token matching
// against those, weighted toward the more curated fields (title, topics,
// heading) over raw body text, covers most questions with zero new
// infrastructure. pgvector is the natural upgrade once this stops being
// enough, per the architecture doc's own framing -- not a default to reach
// for before that's actually true.

export type RetrievedExcerpt = {
  sectionSlug: string;
  sectionTitle: string;
  heading: string | null;
  text: string;
  score: number;
};

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does",
  "for", "from", "had", "has", "have", "how", "i", "if", "in", "into", "is",
  "it", "its", "me", "my", "of", "on", "or", "should", "so", "than", "that",
  "the", "their", "them", "then", "there", "these", "this", "to", "was",
  "were", "what", "when", "where", "which", "who", "why", "will", "with",
  "would", "you", "your",
]);

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  return matches.filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function uniqueMatchCount(queryTokens: Set<string>, text: string): number {
  const seen = new Set<string>();
  for (const token of tokenize(text)) {
    if (queryTokens.has(token)) seen.add(token);
  }
  return seen.size;
}

type ExtractedBlock = { heading: string | null; text: string };

// Flattens a section's content blocks into individually-retrievable units,
// tracking the nearest preceding heading as context. Each list item is its
// own unit -- most of this content's lists are standalone facts (a race-day
// checklist, a week compared across coaching systems), and splitting them
// lets a specific item get cited on its own instead of dragging in the
// whole list around it.
function extractBlocks(content: ContentBlock[]): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let heading: string | null = null;

  for (const block of content) {
    if (block.type === "heading") {
      heading = block.text;
      continue;
    }
    if (block.type === "paragraph") {
      blocks.push({ heading, text: block.text });
    } else if (block.type === "quote") {
      blocks.push({ heading, text: block.attribution ? `${block.text} (${block.attribution})` : block.text });
    } else if (block.type === "list") {
      for (const item of block.items) {
        if (typeof item === "string") {
          blocks.push({ heading, text: item });
        } else {
          blocks.push({ heading, text: item.text });
          for (const subItem of item.items) {
            blocks.push({ heading, text: subItem });
          }
        }
      }
    }
  }

  return blocks;
}

const WEIGHT_TITLE = 3;
const WEIGHT_TOPIC = 2;
const WEIGHT_HEADING = 2;
const WEIGHT_MISSION = 1;
const WEIGHT_BODY = 1;

export function retrieveRelevantContent(
  query: string,
  sections: Section[],
  maxResults = 5,
): RetrievedExcerpt[] {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];

  const scored: RetrievedExcerpt[] = [];

  for (const section of sections) {
    if (!section.content || section.content.length === 0) continue;

    const titleScore = uniqueMatchCount(queryTokens, section.title) * WEIGHT_TITLE;
    const missionScore = uniqueMatchCount(queryTokens, section.mission) * WEIGHT_MISSION;
    const topicScore =
      uniqueMatchCount(queryTokens, section.topics.join(" ")) * WEIGHT_TOPIC;
    const sectionLevelScore = titleScore + missionScore + topicScore;

    for (const block of extractBlocks(section.content)) {
      const headingScore = block.heading ? uniqueMatchCount(queryTokens, block.heading) * WEIGHT_HEADING : 0;
      const bodyScore = uniqueMatchCount(queryTokens, block.text) * WEIGHT_BODY;
      const score = sectionLevelScore + headingScore + bodyScore;
      if (score === 0) continue;

      scored.push({
        sectionSlug: section.slug,
        sectionTitle: section.title,
        heading: block.heading,
        text: block.text,
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}
