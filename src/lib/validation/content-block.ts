import { z } from "zod";

// Mirrors the ContentBlock union in src/lib/sections.ts exactly -- this is
// what validates the JSON blob the block editor serializes into a hidden
// form field (see contribute/articles/content-block-editor.tsx).
export const calloutVariantSchema = z.enum(["tip", "mistake", "research", "takeaway", "advanced"]);

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

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
    items: z.array(z.string().trim().min(1)).min(1, "Add at least one list item"),
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
  }),
  z.object({
    type: z.literal("image"),
    url: z.string().trim().refine(isHttpUrl, "Image URL must start with http:// or https://"),
    alt: z.string().trim().optional(),
    caption: z.string().trim().optional(),
  }),
]);

export const contentBlocksSchema = z.array(contentBlockSchema);
