import { z } from "zod";

// Mirrors contributor-profile.ts's length-limit conventions -- same
// order-of-magnitude fields (a short bio, no structured data), same
// reasoning for the caps (long enough for a real bio, short enough that a
// public profile page doesn't get overwhelmed by one field).
export const communityProfileSchema = z.object({
  avatarUrl: z
    .string()
    .trim()
    .refine((val) => !val || /^https?:\/\//.test(val), "Enter a valid image URL (starting with http:// or https://)"),
  bio: z.string().trim().max(1000, "Keep the bio under 1000 characters"),
  location: z.string().trim().max(100, "Keep the location under 100 characters"),
  favoriteDistances: z.array(z.string()).max(12, "Pick up to 12 favorite distances"),
});

export type CommunityProfileInput = z.infer<typeof communityProfileSchema>;
