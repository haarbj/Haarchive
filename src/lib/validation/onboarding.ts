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

export type GoalInput = z.infer<typeof goalSchema>;
export type RaceResultInput = z.infer<typeof raceResultSchema>;
