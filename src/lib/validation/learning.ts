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

// "What do you want to learn about" (onboarding Step 2) -- a deliberate
// subset of sections.ts's 8 real categories. getting-started,
// writing-and-resources, and tools aren't "areas of interest" in the same
// sense the other five are, so they're left off the picker.
export const learningInterestCategorySchema = z.enum([
  "foundations",
  "the-science",
  "coaching-and-training",
  "recovery-and-fueling",
  "mind-and-recovery",
]);
export type LearningInterestCategory = z.infer<typeof learningInterestCategorySchema>;

export const learningPreferencesSchema = z.object({
  orientation: learningOrientationSchema.nullable(),
  interestCategorySlugs: z.array(learningInterestCategorySchema).max(5),
});
export type LearningPreferencesInput = z.infer<typeof learningPreferencesSchema>;
