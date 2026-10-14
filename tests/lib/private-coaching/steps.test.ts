import { describe, expect, it } from "vitest";

import {
  emptyStep,
  referencedVariableKeys,
  resolveAthleteVariables,
  summarizeDayPace,
  summarizeStep,
  validateStepRanges,
  type StepInput,
} from "@/lib/private-coaching/steps";

function step(overrides: Partial<StepInput> = {}): StepInput {
  return { ...emptyStep(), ...overrides };
}

describe("summarizeStep", () => {
  it("falls back to the step type label when nothing else is set", () => {
    expect(summarizeStep(step({ stepType: "warmup" }))).toBe("Warmup");
  });

  it("summarizes a distance interval with a pace target and rest, formatting a recognized pace unit as a clock time", () => {
    // Deliberately changed from the old raw "345 sec_per_km" rendering --
    // see summarizeStep's own PACE_UNIT_SUFFIXES comment. A coach reading
    // "5:45/km" understands it immediately; "345 sec_per_km" never did.
    const s = step({
      stepType: "interval",
      repetitions: 6,
      distanceM: 1000,
      targetType: "pace",
      targetMin: 345,
      targetMax: 345,
      targetUnit: "sec_per_km",
      restS: 90,
    });
    expect(summarizeStep(s)).toBe("6x 0.62mi @ 5:45/km 90s rest");
  });

  it("summarizes a pace range as mm:ss-mm:ss, not raw seconds", () => {
    const s = step({
      stepType: "interval",
      targetType: "pace",
      targetMin: 390, // 6:30/mi
      targetMax: 405, // 6:45/mi
      targetUnit: "sec_per_mile",
    });
    expect(summarizeStep(s)).toBe("@ 6:30-6:45/mi");
  });

  it("falls back to the raw numeric rendering for a pace target with an unrecognized unit", () => {
    const s = step({ targetType: "pace", targetMin: 400, targetMax: null, targetUnit: "min/mi (legacy)" });
    expect(summarizeStep(s)).toBe("@ 400 min/mi (legacy)");
  });

  it("summarizes a duration-based step with a heart-rate range", () => {
    const s = step({
      stepType: "main",
      durationS: 1200,
      targetType: "heart_rate",
      targetMin: 140,
      targetMax: 150,
      targetUnit: "bpm",
    });
    expect(summarizeStep(s)).toBe("20min @ 140-150 bpm");
  });

  it("summarizes a distance range (e.g. a 1-2mi cooldown)", () => {
    const s = step({ stepType: "cooldown", distanceM: 1609.344, distanceMaxM: 3218.688 });
    expect(summarizeStep(s)).toBe("1-2mi");
  });

  it("summarizes a duration range (e.g. a 15-20min warmup)", () => {
    const s = step({ stepType: "warmup", durationS: 900, durationMaxS: 1200 });
    expect(summarizeStep(s)).toBe("15-20min");
  });

  it("shows a single figure when no max is set, even though the field exists", () => {
    const s = step({ stepType: "cooldown", distanceM: 1609.344, distanceMaxM: null });
    expect(summarizeStep(s)).toBe("1mi");
  });

  describe("with a pace reference", () => {
    it("shows the bare label when resolvedPaceReference is omitted (a template's own athlete-agnostic list)", () => {
      const s = step({ targetType: "pace", targetPaceReference: "tempo" });
      expect(summarizeStep(s)).toBe("@ Tempo Pace");
    });

    it("shows the resolved pace + label when a resolution is passed", () => {
      const s = step({ targetType: "pace", targetPaceReference: "tempo" });
      expect(summarizeStep(s, { minSPerMi: 390, maxSPerMi: 405, sourceLabel: "10K · Jul 4, 2026" })).toBe(
        "@ 6:30–6:45/mi (Tempo Pace)",
      );
    });

    it("shows the no-race-on-file state when resolution was attempted and explicitly came back null", () => {
      const s = step({ targetType: "pace", targetPaceReference: "tempo" });
      expect(summarizeStep(s, null)).toBe("@ Tempo Pace — no race on file yet");
    });

    it("ignores targetMin/targetMax entirely once a reference is set", () => {
      // Mutually exclusive at the DB/Zod layer, but summarizeStep itself
      // should never fall back to stale literal numbers even if a caller
      // handed it both.
      const s = step({ targetType: "pace", targetPaceReference: "tempo", targetMin: 999, targetMax: 999 });
      expect(summarizeStep(s)).toBe("@ Tempo Pace");
    });
  });

  describe("with a pace-percent target (Programs only)", () => {
    // Regression coverage: this branch previously didn't exist at all --
    // a Programs-only percent-of-a-reference-pace step (e.g. Canyon's own
    // "7 x 3min at 90% 5k") fell through every branch and rendered as the
    // bare step-type label ("Main"), silently dropping the pace target.
    it("shows the bare percent label when resolution is omitted (a template-style athlete-agnostic view)", () => {
      const s = step({ targetType: "pace", targetPacePercentBasis: "5k", targetPacePercentMin: 90, targetPacePercentMax: 90 });
      expect(summarizeStep(s)).toBe("@ 90% 5K Pace");
    });

    it("shows a percent range, not a degenerate min-max, when min !== max", () => {
      const s = step({ targetType: "pace", targetPacePercentBasis: "marathon", targetPacePercentMin: 90, targetPacePercentMax: 92 });
      expect(summarizeStep(s)).toBe("@ 90–92% Marathon Pace");
    });

    it("shows the resolved pace + percent label when a resolution is passed", () => {
      const s = step({ targetType: "pace", targetPacePercentBasis: "5k", targetPacePercentMin: 90, targetPacePercentMax: 90 });
      expect(summarizeStep(s, { minSPerMi: 405, maxSPerMi: 405, sourceLabel: "90% 5K Pace (est. 16:00, updated Jan 1, 2026)" })).toBe(
        "@ 6:45/mi (90% 5K Pace)",
      );
    });

    it("shows the no-estimate-on-file state when resolution was attempted and came back null", () => {
      const s = step({ targetType: "pace", targetPacePercentBasis: "5k", targetPacePercentMin: 90, targetPacePercentMax: 90 });
      expect(summarizeStep(s, null)).toBe("@ 90% 5K Pace — no race on file yet");
    });

    it("takes priority over a targetPaceReference if both are somehow set", () => {
      const s = step({
        targetType: "pace",
        targetPaceReference: "tempo",
        targetPacePercentBasis: "5k",
        targetPacePercentMin: 90,
        targetPacePercentMax: 90,
      });
      expect(summarizeStep(s)).toBe("@ 90% 5K Pace");
    });
  });

  describe("with a repetitions or rest range", () => {
    it("summarizes a rep-count range (e.g. Canyon's own '6-7 x 3min')", () => {
      const s = step({ stepType: "interval", repetitions: 6, repetitionsMax: 7, durationS: 180 });
      expect(summarizeStep(s)).toBe("6-7x 3min");
    });

    it("summarizes a rest range (e.g. '30-45 sec walk')", () => {
      const s = step({ stepType: "recovery", restS: 30, restMaxS: 45 });
      expect(summarizeStep(s)).toBe("30-45s rest");
    });
  });
});

describe("validateStepRanges", () => {
  it("accepts steps with no ranges set at all", () => {
    expect(validateStepRanges([step()])).toEqual({ valid: true });
  });

  it("accepts a valid distance range", () => {
    expect(validateStepRanges([step({ distanceM: 1000, distanceMaxM: 2000 })])).toEqual({ valid: true });
  });

  it("rejects a max distance without a min", () => {
    const result = validateStepRanges([step({ distanceMaxM: 2000 })]);
    expect(result.valid).toBe(false);
  });

  it("rejects a max duration below the min", () => {
    const result = validateStepRanges([step({ durationS: 1200, durationMaxS: 600 })]);
    expect(result.valid).toBe(false);
  });

  it("rejects a max target below the min for a non-open target type", () => {
    const result = validateStepRanges([step({ targetType: "pace", targetMin: 400, targetMax: 300 })]);
    expect(result.valid).toBe(false);
  });

  it("ignores a target min/max mismatch when targetType is open", () => {
    // "open" means no specific target -- targetMin/targetMax shouldn't
    // even be set in that case, but if a stale value is present it's not
    // this function's job to police it.
    expect(validateStepRanges([step({ targetType: "open", targetMin: 400, targetMax: 300 })])).toEqual({ valid: true });
  });

  it("checks every step in the list, not just the first", () => {
    const result = validateStepRanges([step(), step({ distanceM: 2000, distanceMaxM: 1000 })]);
    expect(result.valid).toBe(false);
  });

  it("accepts a valid repetitions range", () => {
    expect(validateStepRanges([step({ repetitions: 6, repetitionsMax: 7 })])).toEqual({ valid: true });
  });

  it("rejects a max repetitions below the min", () => {
    const result = validateStepRanges([step({ repetitions: 7, repetitionsMax: 6 })]);
    expect(result.valid).toBe(false);
  });

  it("rejects a max rest without a min", () => {
    const result = validateStepRanges([step({ restMaxS: 45 })]);
    expect(result.valid).toBe(false);
  });
});

describe("resolveAthleteVariables", () => {
  it("substitutes a known metric with a formatted pace", () => {
    const result = resolveAthleteVariables("Run at @athlete.threshold_pace effort", {
      threshold_pace: { value: 375, unit: "sec_per_mile" },
    });
    expect(result).toBe("Run at 6:15/mi effort");
  });

  it("substitutes a plain-unit metric without special pace formatting", () => {
    const result = resolveAthleteVariables("Target @athlete.max_hr bpm", {
      max_hr: { value: 190, unit: "bpm" },
    });
    expect(result).toBe("Target 190 bpm bpm");
  });

  it("leaves an unresolvable placeholder untouched", () => {
    const result = resolveAthleteVariables("Run at @athlete.5k_pace", {});
    expect(result).toBe("Run at @athlete.5k_pace");
  });

  it("resolves multiple distinct variables in one string", () => {
    const result = resolveAthleteVariables("@athlete.easy_pace then @athlete.tempo_pace", {
      easy_pace: { value: 480, unit: "sec_per_mile" },
      tempo_pace: { value: 390, unit: "sec_per_mile" },
    });
    expect(result).toBe("8:00/mi then 6:30/mi");
  });
});

describe("summarizeDayPace", () => {
  // Regression coverage for the blank day-level pace headline: a
  // pace_percent_basis workout previously had no branch at all in the
  // page's own paceText and fell through to a blank line, even though
  // resolution itself was already computed correctly for both modes.
  it("formats a resolved race-reference pace as 'label · pace'", () => {
    const result = summarizeDayPace(
      { kind: "race", key: "tempo" },
      { minSPerMi: 390, maxSPerMi: 405 },
      null,
      null,
    );
    expect(result).toEqual({ text: "Tempo Pace · 6:30–6:45/mi", nudge: null, nudgeHref: null });
  });

  it("formats a resolved percent-of-estimate pace as 'percent label · pace', not blank", () => {
    const result = summarizeDayPace(
      { kind: "percent", basis: "5k", min: 100, max: 100 },
      { minSPerMi: 332, maxSPerMi: 332 },
      null,
      null,
    );
    expect(result).toEqual({ text: "100% 5K Pace · 5:32/mi", nudge: null, nudgeHref: null });
  });

  it("shows a percent range, not a degenerate point value, when min !== max", () => {
    const result = summarizeDayPace(
      { kind: "percent", basis: "marathon", min: 90, max: 92 },
      { minSPerMi: 420, maxSPerMi: 430 },
      null,
      null,
    );
    expect(result.text).toBe("90–92% Marathon Pace · 7:00–7:10/mi");
  });

  it("falls back to the bare race-reference label plus a race-result nudge when no race is on file", () => {
    const result = summarizeDayPace({ kind: "race", key: "tempo" }, null, null, null);
    expect(result).toEqual({
      text: "Tempo Pace",
      nudge: "Add a recent race result in Settings to see your target paces.",
      nudgeHref: "/settings#race-results",
    });
  });

  it("falls back to the bare percent label plus a 5K-estimate nudge when no estimate is on file", () => {
    const result = summarizeDayPace({ kind: "percent", basis: "5k", min: 100, max: 100 }, null, null, null);
    expect(result).toEqual({
      text: "100% 5K Pace",
      nudge: "Add a 5K estimate in Settings to see your target paces.",
      nudgeHref: "/settings#fitness-estimates",
    });
  });

  it("falls back to a marathon-estimate nudge when the basis is marathon", () => {
    const result = summarizeDayPace({ kind: "percent", basis: "marathon", min: 90, max: 90 }, null, null, null);
    expect(result.nudge).toBe("Add a Marathon estimate in Settings to see your target paces.");
  });

  it("treats a 0% basis as a real, set percent rather than missing (zero-reference edge)", () => {
    const result = summarizeDayPace(
      { kind: "percent", basis: "5k", min: 0, max: 0 },
      { minSPerMi: 0, maxSPerMi: 0 },
      null,
      null,
    );
    expect(result.text).toBe("0% 5K Pace · 0:00/mi");
  });

  it("falls back to the fixed literal pace range when neither reference mode is set", () => {
    const result = summarizeDayPace(null, null, 480, 480);
    expect(result).toEqual({ text: "8:00/mi", nudge: null, nudgeHref: null });
  });

  it("returns a null text when nothing at all is set", () => {
    expect(summarizeDayPace(null, null, null, null)).toEqual({ text: null, nudge: null, nudgeHref: null });
  });
});

describe("referencedVariableKeys", () => {
  it("returns an empty array when no variables are present", () => {
    expect(referencedVariableKeys("Just run easy")).toEqual([]);
  });

  it("returns each distinct key once", () => {
    expect(referencedVariableKeys("@athlete.5k_pace warmup, then @athlete.5k_pace again")).toEqual(["5k_pace"]);
  });

  it("returns multiple distinct keys in first-seen order", () => {
    expect(referencedVariableKeys("@athlete.easy_pace to @athlete.threshold_pace")).toEqual([
      "easy_pace",
      "threshold_pace",
    ]);
  });
});
