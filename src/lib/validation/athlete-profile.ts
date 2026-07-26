import { z } from "zod";

const currentYear = new Date().getFullYear();

export const athleteProfileSchema = z.object({
  birthYear: z.coerce
    .number()
    .int()
    .min(currentYear - 100, "Enter a realistic birth year")
    .max(currentYear - 5, "Enter a realistic birth year"),
  weightLb: z.coerce
    .number()
    .positive("Enter your weight")
    .max(600, "That's a lot of pounds -- double check this number"),
  currentWeeklyMileage: z.coerce
    .number()
    .positive("Enter your current weekly mileage")
    .max(200, "That's a lot of miles -- double check this number"),
  daysPerWeek: z.coerce
    .number()
    .int()
    .min(1, "Pick at least 1 day a week")
    .max(7, "Pick at most 7 days a week"),
});

export type AthleteProfileInput = z.infer<typeof athleteProfileSchema>;
