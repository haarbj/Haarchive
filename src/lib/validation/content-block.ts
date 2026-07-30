import { z } from "zod";

// Mirrors the ContentBlock union in src/lib/sections.ts -- with one
// deliberate exception: "calculator" is a hand-authored-only block type
// (see components/inline-calculators) and is intentionally left out here so
// a contributor can never submit one through the article editor (see
// contribute/articles/content-block-editor.tsx, which also excludes it from
// BLOCK_TYPES). This is what validates the JSON blob the block editor
// serializes into a hidden form field.
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
]);

export const contentBlocksSchema = z.array(contentBlockSchema);
