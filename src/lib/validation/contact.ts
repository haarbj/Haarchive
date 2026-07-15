import { z } from "zod";

export const submitContactMessageSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(100, "Keep your name under 100 characters"),
    email: z.string().trim().email("Enter a valid email address").max(200, "Keep your email under 200 characters"),
    message: z
      .string()
      .trim()
      .min(10, "Give a bit more detail than that")
      .max(4000, "Keep your message under 4000 characters"),
    // Honeypot: real visitors never see or fill this field (hidden via CSS).
    website: z.string().optional(),
  })
  .refine((data) => !data.website, "Submission rejected");

export type SubmitContactMessageInput = z.infer<typeof submitContactMessageSchema>;
