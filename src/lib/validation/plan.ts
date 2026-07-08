import { z } from "zod";

export const generatePlanSchema = z.object({
  currentWeeklyMileage: z.coerce
    .number()
    .positive("Enter your current weekly mileage")
    .max(200, "That's a lot of miles -- double check this number"),
  daysPerWeek: z.coerce
    .number()
    .int()
    .min(3, "Pick at least 3 days a week")
    .max(6, "Pick at most 6 days a week"),
});

export const completeWorkoutSchema = z.object({
  actualDistanceInput: z.string().optional(),
  actualTimeInput: z.string().optional(),
  rpeInput: z.string().optional(),
});

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
export type CompleteWorkoutInput = z.infer<typeof completeWorkoutSchema>;
