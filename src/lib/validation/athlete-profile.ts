import { z } from "zod";

const currentYear = new Date().getFullYear();

export const SEXES = ["male", "female", "unspecified"] as const;
export const ATHLETE_LEVELS = ["new", "recreational", "hs", "college", "masters", "elite", "ultra"] as const;
export const ATHLETE_LEVEL_LABELS: Record<(typeof ATHLETE_LEVELS)[number], string> = {
  new: "New to running",
  recreational: "Recreational",
  hs: "High school",
  college: "College",
  masters: "Masters",
  elite: "Elite",
  ultra: "Ultra",
};

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
  sex: z.enum(SEXES).optional(),
  heightIn: z.coerce
    .number()
    .positive()
    .max(96, "That's a lot of inches -- double check this number")
    .optional(),
  yearsRunning: z.coerce.number().int().min(0).max(90, "Enter a realistic number of years").optional(),
  currentLevel: z.enum(ATHLETE_LEVELS).optional(),
  primaryEvent: z.string().max(60).optional(),
});

export type AthleteProfileInput = z.infer<typeof athleteProfileSchema>;
