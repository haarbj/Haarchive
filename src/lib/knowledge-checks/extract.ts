// Shared content-block -> plain-text extraction, used by depth.ts (word/
// heading counts), fingerprint.ts (the normalized snapshot), and
// concepts.ts (heading-derived concept candidates). Deliberately more
// complete than src/lib/ai/retrieval.ts's extractBlocks: retrieval only
// needs headings/paragraphs/quotes/list-items for keyword search, but depth
// analysis and fingerprinting need every block type with real educational
// content -- callouts especially, since a "research"/"advanced" callout is
// often the densest single block on a page.

import type { ContentBlock, ListItem, Section } from "@/lib/sections";

export type ExtractedUnit = {
  heading: string | null;
  headingLevel: 2 | 3 | null;
  text: string;
  blockType: ContentBlock["type"];
  calloutVariant: string | null;
};

function listItemText(item: ListItem): string[] {
  if (typeof item === "string") return [item];
  return [item.text, ...item.items];
}

// Flattens a section's content into one unit per meaningful piece of text,
// tracking the nearest preceding heading (and its level) as context. Image,
// calculator, and figure blocks carry no free-form educational prose (alt
// text and captions are describing an asset, not teaching a concept on
// their own), so they're intentionally excluded -- an image caption alone
// isn't something a knowledge-check question should be grounded in.
export function extractUnits(content: ContentBlock[]): ExtractedUnit[] {
  const units: ExtractedUnit[] = [];
  let heading: string | null = null;
  let headingLevel: 2 | 3 | null = null;

  for (const block of content) {
    if (block.type === "heading") {
      heading = block.text;
      headingLevel = block.level ?? 2;
      continue;
    }

    if (block.type === "paragraph") {
      units.push({ heading, headingLevel, text: block.text, blockType: block.type, calloutVariant: null });
    } else if (block.type === "quote") {
      const text = block.attribution ? `${block.text} (${block.attribution})` : block.text;
      units.push({ heading, headingLevel, text, blockType: block.type, calloutVariant: null });
    } else if (block.type === "list") {
      for (const item of block.items) {
        for (const text of listItemText(item)) {
          units.push({ heading, headingLevel, text, blockType: block.type, calloutVariant: null });
        }
      }
    } else if (block.type === "callout") {
      const parts = [block.title, block.text, ...(block.items ?? [])].filter(
        (part): part is string => typeof part === "string" && part.length > 0,
      );
      for (const text of parts) {
        units.push({ heading, headingLevel, text, blockType: block.type, calloutVariant: block.variant });
      }
    }
    // "image" and "calculator" blocks intentionally produce no unit -- see
    // header comment.
  }

  return units;
}

export function extractSectionUnits(section: Pick<Section, "content">): ExtractedUnit[] {
  return extractUnits(section.content ?? []);
}

// Every level-2 heading in order, each paired with the units that fall
// under it (up to, but not including, the next level-2 heading) -- the
// natural "major concept" boundary this feature's spec uses in its own
// Exercise Physiology example (Energy systems, VO2 max, Lactate threshold,
// ...), where h3s are sub-points of a broader h2 topic rather than their
// own major concept.
export type H2Group = { heading: string; units: ExtractedUnit[] };

export function groupByH2(content: ContentBlock[]): H2Group[] {
  const groups: H2Group[] = [];
  let current: H2Group | null = null;

  for (const block of content) {
    if (block.type === "heading" && (block.level ?? 2) === 2) {
      current = { heading: block.text, units: [] };
      groups.push(current);
      continue;
    }
    if (!current) continue; // content before the first h2 (rare) is not grouped

    if (block.type === "heading") {
      current.units.push({ heading: block.text, headingLevel: block.level ?? 3, text: block.text, blockType: "heading", calloutVariant: null });
    } else if (block.type === "paragraph") {
      current.units.push({ heading: current.heading, headingLevel: 2, text: block.text, blockType: block.type, calloutVariant: null });
    } else if (block.type === "quote") {
      const text = block.attribution ? `${block.text} (${block.attribution})` : block.text;
      current.units.push({ heading: current.heading, headingLevel: 2, text, blockType: block.type, calloutVariant: null });
    } else if (block.type === "list") {
      for (const item of block.items) {
        for (const text of listItemText(item)) {
          current.units.push({ heading: current.heading, headingLevel: 2, text, blockType: block.type, calloutVariant: null });
        }
      }
    } else if (block.type === "callout") {
      const parts = [block.title, block.text, ...(block.items ?? [])].filter(
        (part): part is string => typeof part === "string" && part.length > 0,
      );
      for (const text of parts) {
        current.units.push({ heading: current.heading, headingLevel: 2, text, blockType: block.type, calloutVariant: block.variant });
      }
    }
  }

  return groups;
}

const WORD_RE = /[A-Za-z0-9%'-]+/g;

export function countWords(text: string): number {
  return text.match(WORD_RE)?.length ?? 0;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1);
}

// Same list src/lib/ai/retrieval.ts already uses for the same reason:
// stopwords inflate a similarity/overlap score without meaning anything --
// two completely unrelated sentences that both happen to use "the" and
// "and" shouldn't register as related. `tokenize` above stays stopword-
// inclusive (fingerprint.ts's word-level diff genuinely wants every word,
// including "the", to count as real content that can change); this
// variant is for anything comparing two pieces of text for *meaning*.
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does",
  "for", "from", "had", "has", "have", "how", "i", "if", "in", "into", "is",
  "it", "its", "me", "my", "of", "on", "or", "should", "so", "than", "that",
  "the", "their", "them", "then", "there", "these", "this", "to", "was",
  "were", "what", "when", "where", "which", "who", "why", "will", "with",
  "would", "you", "your",
]);

export function tokenizeMeaningful(text: string): string[] {
  return tokenize(text).filter((t) => !STOPWORDS.has(t));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
