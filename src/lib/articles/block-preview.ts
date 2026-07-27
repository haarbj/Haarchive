import type { ContentBlock } from "@/lib/sections";

// A short, plain-text preview of any block, for read-only summaries
// (review queue preview, admin content listing) that don't need full
// ArticleLayout rendering.
export function blockPreviewText(block: ContentBlock): string {
  if (block.type === "list") {
    return block.items.map((item) => (typeof item === "string" ? item : item.text)).join(" · ");
  }
  if (block.type === "image") return block.url;
  return block.text ?? "";
}
