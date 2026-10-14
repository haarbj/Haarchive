import { z } from "zod";

import { WORKOUT_STEP_TYPES, WORKOUT_TARGET_TYPES } from "@/lib/private-coaching/steps";
import { PACE_REFERENCE_KEYS } from "@/lib/private-coaching/pace-reference";

// Validates one workout_template_steps/scheduled_workout_steps row (see
// steps.ts's StepInput -- this is its runtime-checked counterpart). Bounds
// are deliberately generous (this site covers trail/ultra training, where
// a single step can legitimately be hours long or 50+ miles) -- the point
// is rejecting nonsensical input (a negative distance/duration/rest, zero
// repetitions), not second-guessing a real workout's numbers.
// targetMin/targetMax stay bounded to non-negative only, not a tighter
// per-type range: they mean very different things depending on targetType
// (pace in sec/mile, heart rate in bpm, power in watts, RPE 1-10...), and
// encoding all four scales here would be real complexity for a case this
// schema doesn't need to solve.
export const stepInputSchema = z
  .object({
    stepType: z.enum(WORKOUT_STEP_TYPES as [string, ...string[]]),
    durationS: z.number().int().min(0).max(43200, "Duration can't be more than 12 hours").nullable(),
    durationMaxS: z.number().int().min(0).max(43200, "Duration can't be more than 12 hours").nullable(),
    distanceM: z.number().min(0).max(200000, "That's further than this step type is meant for").nullable(),
    distanceMaxM: z.number().min(0).max(200000, "That's further than this step type is meant for").nullable(),
    targetType: z.enum(WORKOUT_TARGET_TYPES as [string, ...string[]]),
    targetMin: z.number().min(0).nullable(),
    targetMax: z.number().min(0).nullable(),
    targetUnit: z.string().max(30).nullable(),
    // Mirrors the DB's own two CHECK constraints (see the pace_reference
    // migration) at the app layer, for a real error message instead of a
    // raw constraint-violation string reaching the coach.
    targetPaceReference: z.enum(PACE_REFERENCE_KEYS as [string, ...string[]]).nullable(),
    // Program-only (program_day_steps) -- optional since workout_templates/
    // scheduled_workout_steps never populate these (see StepInput's own
    // comment in steps.ts).
    targetPacePercentBasis: z.enum(PACE_REFERENCE_KEYS as [string, ...string[]]).nullable().optional(),
    targetPacePercentMin: z.number().min(1).max(300).nullable().optional(),
    targetPacePercentMax: z.number().min(1).max(300).nullable().optional(),
    repetitions: z.number().int().min(1).max(200).nullable(),
    repetitionsMax: z.number().int().min(1).max(200).nullable(),
    restS: z.number().int().min(0).max(3600, "Rest can't be more than an hour").nullable(),
    restMaxS: z.number().int().min(0).max(3600, "Rest can't be more than an hour").nullable(),
    instructions: z.string().max(500).nullable(),
  })
  .superRefine((step, ctx) => {
    if (step.repetitionsMax != null && (step.repetitions == null || step.repetitionsMax < step.repetitions)) {
      ctx.addIssue({
        code: "custom",
        message: step.repetitions == null ? "Enter a minimum repetitions before a maximum." : "Maximum repetitions can't be less than the minimum.",
        path: ["repetitionsMax"],
      });
    }
    if (step.restMaxS != null && (step.restS == null || step.restMaxS < step.restS)) {
      ctx.addIssue({
        code: "custom",
        message: step.restS == null ? "Enter a minimum rest before a maximum." : "Maximum rest can't be less than the minimum.",
        path: ["restMaxS"],
      });
    }
    if (step.targetPaceReference) {
      if (step.targetMin != null || step.targetMax != null) {
        ctx.addIssue({
          code: "custom",
          message: "A step can't have both a fixed pace target and a pace reference -- pick one.",
          path: ["targetPaceReference"],
        });
      }
      if (step.targetType !== "pace") {
        ctx.addIssue({
          code: "custom",
          message: "A pace reference only applies when the target type is Pace.",
          path: ["targetPaceReference"],
        });
      }
    }
    if (step.targetPacePercentBasis != null) {
      if (step.targetPaceReference != null || step.targetMin != null || step.targetMax != null) {
        ctx.addIssue({
          code: "custom",
          message: "A step can't combine a percent-of-pace target with a fixed pace or a pace reference -- pick one.",
          path: ["targetPacePercentBasis"],
        });
      }
      if (step.targetType !== "pace") {
        ctx.addIssue({
          code: "custom",
          message: "A percent-of-pace target only applies when the target type is Pace.",
          path: ["targetPacePercentBasis"],
        });
      }
      if ((step.targetPacePercentMin == null) !== (step.targetPacePercentMax == null)) {
        ctx.addIssue({
          code: "custom",
          message: "Enter both a low and high percent.",
          path: ["targetPacePercentMax"],
        });
      }
    }
  });

export const stepInputsSchema = z.array(stepInputSchema);

export type StepInputParseResult = ReturnType<typeof stepInputsSchema.safeParse>;
