import { z } from "zod";

import { ARTICLE_TYPES, EVIDENCE_CATEGORIES } from "@/lib/articles/constants";
import { contentBlocksSchema } from "@/lib/validation/content-block";

// Comma-separated free text, lowercased/deduped/capped -- same shape as
// questions' parseTags, since these serve the same "filter/browse by tag"
// purpose (unlike contributor-profile expertise, which is display-only and
// case-preserved).
function parseTags(input: string | undefined): string[] {
  if (!input) return [];
  const tags = input
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 8);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

export const articleDraftSchema = z.object({
  title: z.string().trim().min(8, "Give it a real title").max(160, "Keep the title under 160 characters"),
  subtitle: z
    .string()
    .trim()
    .max(200, "Keep the subtitle under 200 characters")
    .optional()
    .transform((val) => (val ? val : undefined)),
  articleType: z.enum(ARTICLE_TYPES).default("article"),
  evidenceCategory: z
    .string()
    .optional()
    .transform((val) => (val ? val : undefined))
    .refine(
      (val) => !val || (EVIDENCE_CATEGORIES as readonly string[]).includes(val),
      "Not a recognized evidence category",
    ),
  tagsInput: z.string().optional().transform(parseTags),
  coverImageUrl: z
    .string()
    .trim()
    .refine((val) => !val || isHttpUrl(val), "Enter a valid image URL (starting with http:// or https://)"),
  contentJson: z
    .string()
    .transform((val, ctx) => {
      try {
        return JSON.parse(val) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid content." });
        return z.NEVER;
      }
    })
    .pipe(contentBlocksSchema),
});

export type ArticleDraftInput = z.infer<typeof articleDraftSchema>;

export const citationSchema = z.object({
  paperTitle: z.string().trim().min(1, "Every citation needs a title"),
  authors: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val : undefined)),
  year: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val === undefined || val === "" ? undefined : Number(val)))
    .refine(
      (val) => val === undefined || (Number.isInteger(val) && val > 1900 && val < 2100),
      "Enter a valid year",
    ),
  linkOrDoi: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val : undefined)),
  topic: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val : undefined)),
  claimSupported: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val : undefined)),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val : undefined)),
});

export const citationsSchema = z.array(citationSchema);
export type CitationInput = z.infer<typeof citationSchema>;
