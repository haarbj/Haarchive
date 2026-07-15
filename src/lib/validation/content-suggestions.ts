import { z } from "zod";

import { isFoundationsSuggestionTarget } from "@/lib/content-suggestions/foundations-targets";

export const submitContentSuggestionSchema = z.object({
  sectionSlug: z.string().refine(isFoundationsSuggestionTarget, "Choose a real Foundations page"),
  suggestion: z.string().trim().min(10, "Describe the suggested change in a bit more detail").max(2000),
  reason: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((val) => (val ? val : undefined)),
});

export type SubmitContentSuggestionInput = z.infer<typeof submitContentSuggestionSchema>;
