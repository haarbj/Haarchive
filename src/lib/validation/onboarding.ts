import { z } from "zod";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const goalSchema = z.object({
  raceName: z.string().min(1, "Name your goal race"),
  distanceM: z.coerce.number().int().positive("Pick a distance"),
  goalTimeInput: z.string().optional(),
  goalDate: z
    .string()
    .optional()
    .refine((val) => !val || val >= todayStr(), "Goal date can't be in the past"),
});

export const raceResultSchema = z.object({
  raceName: z.string().min(1, "Name the race"),
  raceDate: z
    .string()
    .min(1, "Add the race date")
    .refine((val) => val <= todayStr(), "Race date can't be in the future"),
  distanceM: z.coerce.number().int().positive("Pick a distance"),
  finishTimeInput: z.string().min(1, "Add your finish time"),
  courseType: z.enum(["track", "road", "xc", "trail"]),
});

export const injurySchema = z
  .object({
    injuryType: z.string().min(1, "Name the injury"),
    bodyPart: z.string().min(1, "Add the body part"),
    startDate: z
      .string()
      .min(1, "Add a start date")
      .refine((val) => val <= todayStr(), "Start date can't be in the future"),
    endDate: z.string().optional(),
    severity: z.enum(["mild", "moderate", "severe"]),
    affectsTraining: z.coerce.boolean().optional().default(false),
    notes: z.string().optional(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "End date can't be before the start date",
    path: ["endDate"],
  });

const oneToFive = z.coerce.number().int().min(1, "Rate 1–5").max(5, "Rate 1–5");

export const weeklyCheckinSchema = z.object({
  fatigue: oneToFive,
  soreness: oneToFive,
  sleepQuality: oneToFive,
  stress: oneToFive,
  notes: z.string().optional(),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type RaceResultInput = z.infer<typeof raceResultSchema>;
export type InjuryInput = z.infer<typeof injurySchema>;
export type WeeklyCheckinInput = z.infer<typeof weeklyCheckinSchema>;
