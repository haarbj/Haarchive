import { z } from "zod";

// Mirrors submitContactMessageSchema's shape (trim-then-length, plain-
// English messages, trailing honeypot refine) -- this is the second
// anonymous-or-authenticated public submission form, and there's no reason
// for its validation conventions to diverge from the first.
export const submitBugReportSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(10, "Give a bit more detail than that")
      .max(2000, "Keep the description under 2000 characters"),
    pageUrl: z.string().trim().min(1, "Missing page URL").max(2000, "Page URL is unexpectedly long"),
    viewportWidth: z.coerce.number().int().positive().max(20000).optional(),
    viewportHeight: z.coerce.number().int().positive().max(20000).optional(),
    devicePixelRatio: z.coerce.number().positive().max(20).optional(),
    userAgent: z.string().trim().max(500).optional(),
    // Honeypot: real visitors never see or fill this field (hidden via CSS).
    website: z.string().optional(),
  })
  .refine((data) => !data.website, "Submission rejected");

export type SubmitBugReportInput = z.infer<typeof submitBugReportSchema>;
