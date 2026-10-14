import { describe, expect, it } from "vitest";

import { stepInputSchema, stepInputsSchema } from "@/lib/validation/private-coaching";

function baseStep(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    stepType: "main",
    durationS: 1800,
    durationMaxS: null,
    distanceM: 5000,
    distanceMaxM: null,
    targetType: "pace",
    targetMin: 360,
    targetMax: 400,
    targetUnit: "sec_per_mile",
    targetPaceReference: null,
    repetitions: 1,
    repetitionsMax: null,
    restS: 60,
    restMaxS: null,
    instructions: null,
    ...overrides,
  };
}

describe("stepInputSchema", () => {
  it("accepts a normal, fully-populated step", () => {
    expect(stepInputSchema.safeParse(baseStep()).success).toBe(true);
  });

  it("accepts an all-null step (a coach who hasn't filled anything in yet)", () => {
    const result = stepInputSchema.safeParse(
      baseStep({ durationS: null, distanceM: null, targetMin: null, targetMax: null, repetitions: null, restS: null }),
    );
    expect(result.success).toBe(true);
  });

  it.each(["durationS", "durationMaxS", "distanceM", "distanceMaxM", "targetMin", "targetMax", "restS"])(
    "rejects a negative %s",
    (field) => {
      const result = stepInputSchema.safeParse(baseStep({ [field]: -1 }));
      expect(result.success).toBe(false);
    },
  );

  it("accepts a step with distance and duration ranges (e.g. a 1-2mi cooldown, a 15-20min warmup)", () => {
    const result = stepInputSchema.safeParse(baseStep({ distanceM: 1600, distanceMaxM: 3200, durationS: 900, durationMaxS: 1200 }));
    expect(result.success).toBe(true);
  });

  it("rejects a duration max longer than 12 hours", () => {
    expect(stepInputSchema.safeParse(baseStep({ durationMaxS: 50000 })).success).toBe(false);
  });

  it("rejects zero repetitions -- a step that repeats zero times isn't a real step", () => {
    expect(stepInputSchema.safeParse(baseStep({ repetitions: 0 })).success).toBe(false);
  });

  it("rejects a negative repetitions count", () => {
    expect(stepInputSchema.safeParse(baseStep({ repetitions: -3 })).success).toBe(false);
  });

  it("accepts a long ultra-distance, long-duration step (this site covers trail/ultra training)", () => {
    const result = stepInputSchema.safeParse(baseStep({ distanceM: 160000, durationS: 36000 }));
    expect(result.success).toBe(true);
  });

  it("rejects a duration longer than 12 hours", () => {
    expect(stepInputSchema.safeParse(baseStep({ durationS: 50000 })).success).toBe(false);
  });

  it("rejects an unrecognized stepType or targetType", () => {
    expect(stepInputSchema.safeParse(baseStep({ stepType: "sprint" })).success).toBe(false);
    expect(stepInputSchema.safeParse(baseStep({ targetType: "vibes" })).success).toBe(false);
  });

  it("rejects an unrecognized targetPaceReference", () => {
    expect(stepInputSchema.safeParse(baseStep({ targetMin: null, targetMax: null, targetPaceReference: "goal" })).success).toBe(false);
  });

  it("accepts a pace reference with no literal target set", () => {
    const result = stepInputSchema.safeParse(baseStep({ targetMin: null, targetMax: null, targetPaceReference: "tempo" }));
    expect(result.success).toBe(true);
  });

  it("rejects a step with both a literal pace target and a reference set", () => {
    const result = stepInputSchema.safeParse(baseStep({ targetPaceReference: "tempo" }));
    expect(result.success).toBe(false);
  });

  it("rejects a pace reference on a non-pace target type", () => {
    const result = stepInputSchema.safeParse(
      baseStep({ targetType: "heart_rate", targetMin: null, targetMax: null, targetUnit: "bpm", targetPaceReference: "tempo" }),
    );
    expect(result.success).toBe(false);
  });
});

describe("stepInputsSchema", () => {
  it("accepts an empty array -- a workout with no structured steps yet", () => {
    expect(stepInputsSchema.safeParse([]).success).toBe(true);
  });

  it("rejects the whole array if any one step is invalid", () => {
    const result = stepInputsSchema.safeParse([baseStep(), baseStep({ durationS: -5 })]);
    expect(result.success).toBe(false);
  });
});
