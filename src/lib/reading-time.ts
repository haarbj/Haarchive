import type { ContentBlock } from "@/lib/sections";

const WORDS_PER_MINUTE = 230;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Derived purely from the content array, so every article -- present or
// future -- gets an accurate estimate with zero authoring effort.
export function estimateReadingMinutes(content: ContentBlock[]): number {
  const words = content.reduce((total, block) => {
    if (block.type === "paragraph" || block.type === "quote") {
      return total + wordCount(block.text);
    }
    if (block.type === "callout") {
      const textWords = block.text ? wordCount(block.text) : 0;
      const itemWords = block.items?.reduce((sum, item) => sum + wordCount(item), 0) ?? 0;
      return total + textWords + itemWords;
    }
    if (block.type === "list") {
      return total + block.items.reduce((sum, item) => sum + wordCount(item), 0);
    }
    return total;
  }, 0);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

// Level-2 headings are the article's "chapters" -- level-3 headings are
// subsections of one, so they don't count toward this number.
export function countTopLevelSections(content: ContentBlock[]): number {
  return content.filter(
    (block) => block.type === "heading" && (block.level ?? 2) === 2,
  ).length;
}
