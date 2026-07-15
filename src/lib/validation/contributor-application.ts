import { z } from "zod";

export const CONTRIBUTION_TYPES = ["article", "answer_questions", "review"] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  article: "Write articles",
  answer_questions: "Answer reader questions",
  review: "Review submissions",
};

export const submitContributorApplicationSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(100, "Keep your name under 100 characters"),
    email: z.string().trim().email("Enter a valid email address").max(200, "Keep your email under 200 characters"),
    contributionTypes: z
      .array(z.enum(CONTRIBUTION_TYPES))
      .min(1, "Pick at least one way you'd like to contribute"),
    background: z
      .string()
      .trim()
      .min(20, "Give a bit more detail than that")
      .max(2000, "Keep this under 2000 characters"),
    topicIdea: z
      .string()
      .trim()
      .max(2000, "Keep this under 2000 characters")
      .optional()
      .transform((val) => (val ? val : undefined)),
    motivation: z
      .string()
      .trim()
      .min(20, "Give a bit more detail than that")
      .max(2000, "Keep this under 2000 characters"),
    // Honeypot: real visitors never see or fill this field (hidden via CSS).
    website: z.string().optional(),
  })
  .refine((data) => !data.website, "Submission rejected");

export type SubmitContributorApplicationInput = z.infer<typeof submitContributorApplicationSchema>;
