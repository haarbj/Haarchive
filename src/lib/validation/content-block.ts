import { z } from "zod";

// Mirrors the ContentBlock union in src/lib/sections.ts -- with two
// deliberate exceptions: "calculator" and "figure" are hand-authored-only
// block types (see components/inline-calculators and
// components/article-figures) and are kept out of BLOCK_TYPES in
// contribute/articles/content-block-editor.tsx so a contributor can never
// submit one through the article editor's UI. "figure" (unlike
// "calculator") IS still included in this schema below -- this is what
// re-validates an article's whole content array on every save
// (updateArticleDraft), and a discriminated union rejects any block type
// it doesn't recognize. Without this, editing an article that already
// contains a hand-inserted figure block (via a seed script, never the
// editor) would fail validation or silently strip the figure on the next
// save. The editor UI still can't add a NEW one -- it's just no longer
// destructive to an EXISTING one.
export const calloutVariantSchema = z.enum(["tip", "mistake", "research", "takeaway", "advanced"]);

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

// Mirrors the ListItem type in sections.ts -- a plain string, or an item
// with its own (non-nested) sub-items.
const listItemSchema = z.union([
  z.string().trim().min(1),
  z.object({
    text: z.string().trim().min(1),
    items: z.array(z.string().trim().min(1)),
  }),
]);

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    text: z.string().trim().min(1, "Heading text can't be empty"),
    level: z.union([z.literal(2), z.literal(3)]).optional(),
  }),
  z.object({
    type: z.literal("paragraph"),
    text: z.string().trim().min(1, "Paragraph text can't be empty"),
    linkHref: z.string().trim().optional(),
    linkText: z.string().trim().optional(),
  }),
  z.object({
    type: z.literal("list"),
    items: z.array(listItemSchema).min(1, "Add at least one list item"),
  }),
  z.object({
    type: z.literal("quote"),
    text: z.string().trim().min(1, "Quote text can't be empty"),
    attribution: z.string().trim().optional(),
  }),
  z.object({
    type: z.literal("callout"),
    variant: calloutVariantSchema,
    title: z.string().trim().optional(),
    text: z.string().trim().optional(),
    items: z.array(z.string().trim()).optional(),
    collapsed: z.boolean().optional(),
    linkHref: z.string().trim().optional(),
    linkText: z.string().trim().optional(),
  }),
  z.object({
    type: z.literal("image"),
    url: z.string().trim().refine(isHttpUrl, "Image URL must start with http:// or https://"),
    alt: z.string().trim().optional(),
    caption: z.string().trim().optional(),
  }),
  z.object({
    type: z.literal("figure"),
    figureId: z.enum(["boston-marathon-fueling", "gastric-emptying-explorer", "carbohydrate-transport-diagram"]),
  }),
]);

export const contentBlocksSchema = z.array(contentBlockSchema);
