import type { ContentBlock } from "@/lib/sections";
import type { NoteAnchor } from "@/lib/notes/types";

// How much surrounding text to capture on each side of a selection. Wide
// enough that the same short phrase appearing twice nearby (a repeated
// word, a common term) still disambiguates; short enough that a minor edit
// a few sentences away doesn't break the match.
const CONTEXT_LENGTH = 40;

// The complete searchable text of a block -- deliberately more thorough
// than articles/block-preview.ts's blockPreviewText, which trims to a short
// display snippet. Anchor resolution needs every word a user could have
// selected, including callout titles/items and nested list sub-items that
// the preview version doesn't cover.
export function blockPlainText(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return block.text;
    case "paragraph":
      return block.text;
    case "quote":
      return block.text;
    case "list":
      return block.items
        .map((item) => {
          if (typeof item === "string") return item;
          return [item.text, ...item.items].join(" ");
        })
        .join(" ");
    case "callout":
      return [block.title ?? "", block.text ?? "", ...(block.items ?? [])].join(" ");
    case "image":
      return block.caption ?? "";
    case "calculator":
      return "";
  }
}

// Captures a text-quote anchor for a selection made inside content[blockIndex].
// Returns null if the selection text can't actually be found in that
// block's plain text (shouldn't happen for a real in-browser selection, but
// this keeps the function honest rather than fabricating context).
export function computeAnchor(content: ContentBlock[], blockIndex: number, selectedText: string): NoteAnchor | null {
  const block = content[blockIndex];
  if (!block) return null;
  const text = blockPlainText(block);
  const start = text.indexOf(selectedText);
  if (start === -1) return null;

  return {
    prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: text.slice(start + selectedText.length, start + selectedText.length + CONTEXT_LENGTH),
    blockIndex,
  };
}

export type AnchorResolution = { status: "resolved"; blockIndex: number } | { status: "unresolved" };

// Re-finds a highlighted note's passage against the article's *current*
// content. Never trusts anchor.blockIndex alone -- content can be edited,
// reordered, or removed independently of any note that points into it, so
// every read re-verifies the actual text is still there rather than
// assuming a stored position is still correct.
//
// Two passes, both real, exact substring matches -- no fuzzy matching, so a
// resolution is never a guess:
//   1. prefix + quote + suffix, across every block. This is what survives a
//      block being reordered (the text moves, but its neighbors travel
//      with it) and disambiguates a short quote that appears more than
//      once in the article.
//   2. If that fails, the quote alone, but ONLY if it's unambiguous across
//      the whole article -- a quote that could now match two different
//      places is not a resolution, it's a coin flip, and this never
//      silently attaches a note to the wrong passage.
// Anything else is unresolved: the note is preserved either way (this
// function never deletes or mutates data), the UI just can't point at a
// live passage for it anymore.
export function resolveAnchor(content: ContentBlock[], selectedText: string, anchor: NoteAnchor): AnchorResolution {
  const blocks = content.map((block, index) => ({ index, text: blockPlainText(block) }));

  const needle = anchor.prefix + selectedText + anchor.suffix;
  const exactMatches = blocks.filter(({ text }) => text.includes(needle)).map(({ index }) => index);

  if (exactMatches.length === 1) {
    return { status: "resolved", blockIndex: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    // Ambiguous even with context -- prefer the original block if it's
    // still one of the candidates, rather than picking arbitrarily.
    const blockIndex = exactMatches.includes(anchor.blockIndex) ? anchor.blockIndex : exactMatches[0];
    return { status: "resolved", blockIndex };
  }

  const quoteMatches = blocks.filter(({ text }) => text.includes(selectedText)).map(({ index }) => index);
  if (quoteMatches.length === 1) {
    return { status: "resolved", blockIndex: quoteMatches[0] };
  }

  return { status: "unresolved" };
}
