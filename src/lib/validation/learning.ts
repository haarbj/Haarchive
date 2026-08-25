import { z } from "zod";

// "Why are you here" (onboarding Step 1) -- deliberately not the same
// vocabulary as athlete_profiles.current_level (beginner/intermediate/
// advanced/elite): this is about intent, not ability.
export const learningOrientationSchema = z.enum([
  "new_runner",
  "training_goal",
  "science",
  "coaching",
  "exploring",
]);
export type LearningOrientation = z.infer<typeof learningOrientationSchema>;

// "What do you want to learn about" (onboarding Step 2) -- the four
// intellectual domains from sections.ts's categories, not the two
// supporting non-domain areas (library, tools) alongside them -- those
// aren't "areas of interest" in the same sense the four domains are.
// Previously a 5-slug subset of the old 8-category taxonomy; the old
// the-science/recovery-and-fueling categories both migrated into a single
// physiology domain, so this enum is now 4 entries, not 5 -- a real
// consequence of the migration, not a mistake.
export const learningInterestCategorySchema = z.enum([
  "physiology",
  "psychology",
  "philosophy",
  "practice",
]);
export type LearningInterestCategory = z.infer<typeof learningInterestCategorySchema>;

export const learningPreferencesSchema = z.object({
  orientation: learningOrientationSchema.nullable(),
  interestCategorySlugs: z.array(learningInterestCategorySchema).max(5),
});
export type LearningPreferencesInput = z.infer<typeof learningPreferencesSchema>;
