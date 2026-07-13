import { z } from "zod";

import { categories } from "@/lib/sections";

const categorySlugs = categories.map((category) => category.slug) as [string, ...string[]];

// Comma-separated tag input from a plain text field -- trimmed, lowercased,
// deduped, capped so one submitter can't spam an unbounded tag list.
function parseTags(input: string | undefined): string[] {
  if (!input) return [];
  const tags = input
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 8);
}

export const submitQuestionSchema = z
  .object({
    type: z.enum(["question", "topic_suggestion"]).default("question"),
    title: z
      .string()
      .trim()
      .min(8, "Give it a bit more detail than that")
      .max(160, "Keep the title under 160 characters"),
    description: z
      .string()
      .trim()
      .max(2000, "Keep the description under 2000 characters")
      .optional()
      .transform((val) => (val ? val : undefined)),
    category: z
      .string()
      .optional()
      .transform((val) => (val ? val : undefined))
      .refine((val) => !val || (categorySlugs as string[]).includes(val), "Not a recognized category"),
    tagsInput: z.string().optional().transform(parseTags),
    displayName: z
      .string()
      .trim()
      .max(60, "Keep the name under 60 characters")
      .optional()
      .transform((val) => (val ? val : undefined)),
    sourceSectionSlug: z
      .string()
      .optional()
      .transform((val) => (val ? val : undefined)),
    // Honeypot: real visitors never see or fill this field (hidden via CSS).
    website: z.string().optional(),
  })
  .refine((data) => !data.website, "Submission rejected");

export type SubmitQuestionInput = z.infer<typeof submitQuestionSchema>;

export const adminUpdateQuestionSchema = z.object({
  title: z.string().trim().min(8).max(160).optional(),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((val) => (val ? val : undefined)),
  category: z
    .string()
    .optional()
    .transform((val) => (val ? val : undefined))
    .refine((val) => !val || (categorySlugs as string[]).includes(val), "Not a recognized category"),
  tagsInput: z.string().optional().transform(parseTags),
  status: z
    .enum(["new", "under_review", "planned", "researching", "answered", "added_to_library"])
    .optional(),
  adminNotes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((val) => (val ? val : undefined)),
  adminResponse: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((val) => (val ? val : undefined)),
  isFaq: z.coerce.boolean().optional(),
  linkedSectionSlug: z
    .string()
    .optional()
    .transform((val) => (val ? val : undefined)),
});

export type AdminUpdateQuestionInput = z.infer<typeof adminUpdateQuestionSchema>;
