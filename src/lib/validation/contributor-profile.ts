import { z } from "zod";

// Comma-separated free text, case-preserved (unlike questions' parseTags,
// which lowercases for filtering) since these are displayed verbatim on a
// public profile -- "Marathon Training" should render as typed, not
// "marathon training". Deduped case-insensitively, capped so the list stays
// readable on a byline.
function parseExpertise(input: string): string[] {
  const items = input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped.slice(0, 12);
}

export const updateContributorProfileSchema = z.object({
  title: z.string().trim().max(80, "Keep the title under 80 characters"),
  bio: z.string().trim().max(1000, "Keep the bio under 1000 characters"),
  expertiseInput: z.string().transform(parseExpertise),
  avatarUrl: z
    .string()
    .trim()
    .refine((val) => !val || /^https?:\/\//.test(val), "Enter a valid image URL (starting with http:// or https://)"),
});

export type UpdateContributorProfileInput = z.infer<typeof updateContributorProfileSchema>;
