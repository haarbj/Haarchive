import { z } from "zod";

// Mirrors the public.mesocycle_phase and public.workout_type Postgres enums
// exactly (supabase/migrations/20260708123357_init_schema.sql).
export type MesocyclePhase = "base" | "build" | "peak" | "taper" | "recovery";
export type WorkoutType = "easy" | "tempo" | "vo2" | "long" | "race" | "recovery" | "strength";

// `kind` deliberately mirrors the `workout_type` DB column even though
// that's redundant -- it lets workoutPrescriptionSchema.parse(row.prescription)
// safely narrow the type read back from a jsonb column (typed `any` by
// supabase-js) without cross-referencing a second column.
export const workoutPrescriptionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("easy"),
    distanceM: z.number().positive(),
    paceRangeSecPerKm: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    kind: z.literal("recovery"),
    distanceM: z.number().positive(),
    paceRangeSecPerKm: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    kind: z.literal("long"),
    distanceM: z.number().positive(),
    paceRangeSecPerKm: z.tuple([z.number(), z.number()]),
    // Marathon-specific specificity: "22 miles with the final 10 at marathon
    // pace" (Vandy Run Club guidelines). Only ever present for long-bucket
    // goals in build/peak phase -- see prescriptions.ts. distanceM above
    // stays the *total* run distance either way; this describes how much of
    // it is run at marathon (steady) pace rather than easy pace.
    marathonPaceSegment: z
      .object({
        distanceM: z.number().positive(),
        paceRangeSecPerKm: z.tuple([z.number(), z.number()]),
      })
      .optional(),
    // "A shakeout is not another workout" (both source guidelines, verbatim)
    // -- deliberately modeled as an optional suggestion attached to the long
    // run, not a second schedulable/completable workout row, for athletes
    // running 6 days/week. See prescriptions.ts for when this is set.
    suggestedShakeout: z
      .object({
        distanceM: z.number().positive(),
        paceRangeSecPerKm: z.tuple([z.number(), z.number()]),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal("tempo"),
    warmupM: z.number().nonnegative(),
    tempoM: z.number().positive(),
    cooldownM: z.number().nonnegative(),
    paceRangeSecPerKm: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    kind: z.literal("vo2"),
    warmupM: z.number().nonnegative(),
    reps: z.number().int().positive(),
    repM: z.number().positive(),
    recoveryM: z.number().nonnegative(),
    cooldownM: z.number().nonnegative(),
    paceRangeSecPerKm: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    kind: z.literal("race"),
    distanceM: z.number().positive(),
  }),
]);

export type WorkoutPrescription = z.infer<typeof workoutPrescriptionSchema>;

export type PaceZoneKey = "easy" | "steady" | "tempo" | "interval";
export type PaceZones = Record<PaceZoneKey, [fastSecPerKm: number, slowSecPerKm: number]>;

export type WeekPlan = {
  weekIndex: number;
  phase: MesocyclePhase;
  isCutback: boolean;
};

export type MesocycleAllocation = {
  phase: MesocyclePhase;
  weeks: number;
};

export type MesocycleDraft = {
  phase: MesocyclePhase;
  startDate: string;
  endDate: string;
  focusNotes: string;
};

export type WorkoutDraft = {
  mesocycleIndex: number;
  scheduledDate: string;
  workoutType: WorkoutType;
  prescription: WorkoutPrescription;
};

export type PlanDraft = {
  name: string;
  startDate: string;
  endDate: string;
  philosophy: "custom";
  status: "active";
};

export type GenerateTrainingPlanInput = {
  goal: {
    raceName: string;
    distanceM: number;
    timeS: number;
    date: string;
  };
  athlete: {
    currentWeeklyMileageM: number;
    daysPerWeek: number;
  };
  today: string;
};

export type GenerateTrainingPlanResult =
  | { ok: true; plan: PlanDraft; mesocycles: MesocycleDraft[]; workouts: WorkoutDraft[] }
  | { ok: false; error: string };
