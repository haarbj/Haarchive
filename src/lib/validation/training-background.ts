import { z } from "zod";

import { TRAINING_BACKGROUND_SOURCES } from "@/lib/private-coaching/training-background";

// Mirrors athlete-profile.ts's own shape: coerced numbers for form inputs,
// everything but the source itself optional since a coach or athlete may
// not have every field yet (see training-background.ts's own header for why
// a missing peak falls back to a conservative default rather than blocking
// anything).
export const trainingBackgroundSchema = z.object({
  source: z.enum(TRAINING_BACKGROUND_SOURCES),
  // Neither name is required even when its source is picked -- a coach's
  // name or an app's name may not be known yet, and that's still worth
  // recording as neutral context rather than blocking the rest of the
  // intake on it.
  coachName: z.string().max(120).optional(),
  programName: z.string().max(120).optional(),
  recentTypicalMileage: z.coerce.number().min(0).max(250, "That's a lot of miles -- double check this number").optional(),
  peakMileage: z.coerce.number().min(0).max(250, "That's a lot of miles -- double check this number").optional(),
  summary: z.string().max(2000).optional(),
  injuryHistory: z.string().max(2000).optional(),
});

export type TrainingBackgroundInput = z.infer<typeof trainingBackgroundSchema>;
