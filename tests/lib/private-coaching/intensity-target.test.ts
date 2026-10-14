import { describe, expect, it } from "vitest";

import {
  stepInputToIntensityTargets,
  intensityTargetsToStepFields,
  type IntensityTarget,
  type StepPrescriptionFields,
} from "@/lib/private-coaching/intensity-target";
import { emptyStep } from "@/lib/private-coaching/steps";

// The prescription round-trip invariant named in
// coaching-platform-audit/07-testing-strategy.md §2 as "the highest-
// leverage test in this entire document": every IntensityTarget mode
// survives create -> serialize -> deserialize unchanged. This is a pure-
// function round trip (no DB involved, unlike
// tests/app/private-coaching-step-fields.test.ts's server-action-level
// coverage of the same underlying fields) -- it's what makes the contract
// itself trustworthy, independent of any one writer remembering to call it
// correctly.

function fields(overrides: Partial<StepPrescriptionFields> = {}): StepPrescriptionFields {
  const { distanceM, distanceMaxM, durationS, durationMaxS, targetType, targetMin, targetMax, targetUnit, targetPaceReference } =
    emptyStep();
  return {
    distanceM,
    distanceMaxM,
    durationS,
    durationMaxS,
    targetType,
    targetMin,
    targetMax,
    targetUnit,
    targetPaceReference,
    targetPacePercentBasis: null,
    targetPacePercentMin: null,
    targetPacePercentMax: null,
    ...overrides,
  };
}

describe("stepInputToIntensityTargets / intensityTargetsToStepFields -- round trip", () => {
  it("an all-null step deserializes to a single open target and serializes back to all-null fields", () => {
    const targets = stepInputToIntensityTargets(fields());
    expect(targets).toEqual<IntensityTarget[]>([{ mode: "open" }]);
    expect(intensityTargetsToStepFields(targets)).toEqual(fields());
  });

  it("a point distance round-trips, and a distance range round-trips", () => {
    const point = fields({ distanceM: 1609.344 });
    expect(stepInputToIntensityTargets(point)).toEqual<IntensityTarget[]>([{ mode: "distance", minM: 1609.344, maxM: null }]);
    expect(intensityTargetsToStepFields(stepInputToIntensityTargets(point))).toEqual(point);

    const range = fields({ distanceM: 800, distanceMaxM: 1000 });
    expect(stepInputToIntensityTargets(range)).toEqual<IntensityTarget[]>([{ mode: "distance", minM: 800, maxM: 1000 }]);
    expect(intensityTargetsToStepFields(stepInputToIntensityTargets(range))).toEqual(range);
  });

  it("duration round-trips, and is only read when distance is absent (a step's own volume is one mode, not both)", () => {
    const durationOnly = fields({ durationS: 300, durationMaxS: 360 });
    expect(stepInputToIntensityTargets(durationOnly)).toEqual<IntensityTarget[]>([{ mode: "duration", minS: 300, maxS: 360 }]);
    expect(intensityTargetsToStepFields(stepInputToIntensityTargets(durationOnly))).toEqual(durationOnly);

    // Matches the DB's own reality (a step row can have both columns set,
    // but this contract's volume slot is one mode) and every existing
    // consumer's convention (summarizeStep, resolveStepsForAthlete's
    // callers) of treating distance as authoritative when both are present.
    const both = fields({ distanceM: 1000, durationS: 300 });
    expect(stepInputToIntensityTargets(both)).toEqual<IntensityTarget[]>([{ mode: "distance", minM: 1000, maxM: null }]);
  });

  it("a literal pace target round-trips, including its unit and a pace range", () => {
    const point = fields({ targetType: "pace", targetMin: 345, targetUnit: "sec_per_km" });
    expect(stepInputToIntensityTargets(point)).toEqual<IntensityTarget[]>([
      { mode: "pace", minSPerMi: 345, maxSPerMi: null, unit: "sec_per_km" },
    ]);
    expect(intensityTargetsToStepFields(stepInputToIntensityTargets(point))).toEqual(point);

    const range = fields({ targetType: "pace", targetMin: 420, targetMax: 440, targetUnit: "sec_per_mile" });
    expect(intensityTargetsToStepFields(stepInputToIntensityTargets(range))).toEqual(range);
  });

  it("a named pace reference round-trips and does not carry a literal target_min/max", () => {
    const withRef = fields({ targetPaceReference: "5k" });
    expect(stepInputToIntensityTargets(withRef)).toEqual<IntensityTarget[]>([{ mode: "paceReference", reference: "5k" }]);
    const roundTripped = intensityTargetsToStepFields(stepInputToIntensityTargets(withRef));
    expect(roundTripped.targetPaceReference).toBe("5k");
    expect(roundTripped.targetType).toBe("pace");
    expect(roundTripped.targetMin).toBeNull();
    expect(roundTripped.targetMax).toBeNull();
  });

  it("a percent-of-pace target round-trips -- the exact shape D1/D2 found dropped across five writers this session", () => {
    // targetType: "pace" alongside the percent trio matches what
    // steps-editor.tsx's handleTargetPacePercentBasisChange always
    // produces in practice (the percent toggle is only reachable while
    // already in pace mode, so targetType is never touched by it) --
    // required by scheduled_workout_steps_pace_percent_type_valid too.
    const percent = fields({ targetType: "pace", targetPacePercentBasis: "5k", targetPacePercentMin: 90, targetPacePercentMax: 92 });
    expect(stepInputToIntensityTargets(percent)).toEqual<IntensityTarget[]>([
      { mode: "pacePercent", basis: "5k", minPercent: 90, maxPercent: 92 },
    ]);
    const roundTripped = intensityTargetsToStepFields(stepInputToIntensityTargets(percent));
    expect(roundTripped).toEqual(percent);
    expect(roundTripped.targetType).toBe("pace");
  });

  it("percent-of-pace wins priority over a simultaneously-set reference or literal pace, matching the DB's own exclusivity constraints", () => {
    // A malformed input (all three set at once, which the DB itself
    // rejects via scheduled_workout_steps_pace_percent_exclusive) still
    // produces exactly one target, never a mix -- the same priority order
    // every hand-written exclusivity check this session touched already
    // used (percent > reference > literal).
    const malformed = fields({
      targetType: "pace",
      targetMin: 400,
      targetPaceReference: "5k",
      targetPacePercentBasis: "10k",
      targetPacePercentMin: 90,
      targetPacePercentMax: 92,
    });
    expect(stepInputToIntensityTargets(malformed)).toEqual<IntensityTarget[]>([
      { mode: "pacePercent", basis: "10k", minPercent: 90, maxPercent: 92 },
    ]);
  });

  it("a heart-rate target round-trips", () => {
    const hr = fields({ targetType: "heart_rate", targetMin: 140, targetMax: 155 });
    expect(stepInputToIntensityTargets(hr)).toEqual<IntensityTarget[]>([{ mode: "heartRate", minBpm: 140, maxBpm: 155 }]);
    expect(intensityTargetsToStepFields(stepInputToIntensityTargets(hr))).toEqual(hr);
  });

  it("an RPE target round-trips", () => {
    const rpe = fields({ targetType: "rpe", targetMin: 6, targetMax: 7 });
    expect(stepInputToIntensityTargets(rpe)).toEqual<IntensityTarget[]>([{ mode: "rpe", min: 6, max: 7 }]);
    expect(intensityTargetsToStepFields(stepInputToIntensityTargets(rpe))).toEqual(rpe);
  });

  it("a real interval step carries both a volume signal and an intensity signal simultaneously, as a two-element array", () => {
    // "6-7 x 500m @ 90-92% 5K pace" -- the exact shape hand-authored for
    // Canyon during this engagement, and the reason IntensityTarget is an
    // array, not a single value (05-target-architecture.md §1.1).
    const interval = fields({
      distanceM: 500,
      targetType: "pace",
      targetPacePercentBasis: "5k",
      targetPacePercentMin: 90,
      targetPacePercentMax: 92,
    });
    expect(stepInputToIntensityTargets(interval)).toEqual<IntensityTarget[]>([
      { mode: "distance", minM: 500, maxM: null },
      { mode: "pacePercent", basis: "5k", minPercent: 90, maxPercent: 92 },
    ]);
    expect(intensityTargetsToStepFields(stepInputToIntensityTargets(interval))).toEqual(interval);
  });

  it("normalizes targetType to 'pace' when re-serializing a percent-of-pace target, even if the source row's targetType was stale or wrong", () => {
    // A genuinely valuable property discovered while writing this suite,
    // not merely designed in: a step whose targetPacePercentBasis is set
    // is unambiguously a pace-percent step regardless of what its own
    // targetType column says, so the contract treats the percent trio as
    // the stronger signal and corrects targetType on the way back out --
    // rather than faithfully reproducing a malformed combination
    // scheduled_workout_steps_pace_percent_type_valid would reject anyway.
    const malformed = fields({ targetType: "open", targetPacePercentBasis: "5k", targetPacePercentMin: 90, targetPacePercentMax: 92 });
    const roundTripped = intensityTargetsToStepFields(stepInputToIntensityTargets(malformed));
    expect(roundTripped.targetType).toBe("pace");
    expect(roundTripped.targetPacePercentBasis).toBe("5k");
  });

  it("serializing volumePercent at the step level throws rather than silently dropping it", () => {
    // volumePercent is day-level-only (scheduled_workouts/program_days/
    // workout_templates' planned_volume_percent); a step has no matching
    // column. A thrown error here is the point -- swallowing this would
    // be exactly the class of silent data loss this contract exists to
    // prevent, just moved into the contract itself instead of a writer.
    expect(() => intensityTargetsToStepFields([{ mode: "volumePercent", percent: 20 }])).toThrow(/day-level/);
  });
});
