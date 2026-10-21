import { z } from "zod";

const currentYear = new Date().getFullYear();

export const TRAINING_FACILITIES = ["track", "treadmill", "trails", "hills", "gym_strength", "pool_cross_training"] as const;
export type TrainingFacility = (typeof TRAINING_FACILITIES)[number];
export const TRAINING_FACILITY_LABELS: Record<TrainingFacility, string> = {
  track: "Track",
  treadmill: "Treadmill",
  trails: "Trails",
  hills: "Hills",
  gym_strength: "Gym / strength equipment",
  pool_cross_training: "Pool / cross-training",
};

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

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
  // Intake gap-check (see intake-gaps.ts) -- all optional, same reasoning
  // as every other field here: a coach plans around what's missing,
  // nothing on this form blocks on being incomplete.
  trainingFacilities: z.array(z.enum(TRAINING_FACILITIES)).optional(),
  homeAltitudeM: z.coerce.number().min(0).max(6000, "That's higher than Everest base camp -- double check this number").optional(),
  recentTrainingDetail: z.string().max(2000).optional(),
  longRunDay: z.enum(WEEKDAYS).optional(),
  blackoutDays: z.array(z.enum(WEEKDAYS)).optional(),
});

export type AthleteProfileInput = z.infer<typeof athleteProfileSchema>;

// A statement, not an essay -- long enough for "qualify for Boston and
// get there healthy enough to enjoy it" plus real room to elaborate,
// short enough that it still reads as one held idea rather than a
// second training-background summary. Enforced here and by the
// migration's own check constraint, so a client that somehow bypasses
// this schema still can't write past it.
export const SEASON_GOAL_MAX_LENGTH = 500;
export const seasonGoalSchema = z
  .string()
  .trim()
  .max(SEASON_GOAL_MAX_LENGTH, `Keep it to ${SEASON_GOAL_MAX_LENGTH} characters or fewer.`);
