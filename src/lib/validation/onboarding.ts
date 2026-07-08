import { z } from "zod";

export const goalSchema = z.object({
  raceName: z.string().min(1, "Name your goal race"),
  distanceM: z.coerce.number().int().positive("Pick a distance"),
  goalTimeInput: z.string().optional(),
  goalDate: z.string().optional(),
});

export const raceResultSchema = z.object({
  raceName: z.string().min(1, "Name the race"),
  raceDate: z.string().min(1, "Add the race date"),
  distanceM: z.coerce.number().int().positive("Pick a distance"),
  finishTimeInput: z.string().min(1, "Add your finish time"),
  courseType: z.enum(["track", "road", "xc", "trail"]),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type RaceResultInput = z.infer<typeof raceResultSchema>;
