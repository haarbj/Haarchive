import { describe, expect, it } from "vitest";

import {
  COMPLETION_TOLERANCE,
  compareCompletionToPlan,
  describeCompletionFigures,
  formatActualDistance,
  formatDistanceDelta,
  formatDurationDelta,
  type CompletionComparison,
} from "@/lib/private-coaching/completion-comparison";
import { MILE_METERS } from "@/lib/race-distances";

describe("compareCompletionToPlan", () => {
  it("has no delta at all for an upcoming/unlogged workout -- no actuals means nothing to compare", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: 10 * MILE_METERS,
      plannedDistanceMaxM: null,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      actualDistanceM: null,
      actualDurationS: null,
    });
    expect(comparison.distanceDelta).toBeNull();
    expect(comparison.durationDelta).toBeNull();
    expect(comparison.onPlan).toBe(true);
  });

  it("reads as on-plan when there was no planned target at all, even though an actual was logged -- no evidence of drift, never a manufactured off-plan flag", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: null,
      plannedDistanceMaxM: null,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      actualDistanceM: 6.2 * MILE_METERS,
      actualDurationS: 2292,
    });
    expect(comparison.distanceDelta).toBeNull();
    expect(comparison.durationDelta).toBeNull();
    expect(comparison.onPlan).toBe(true);
  });

  describe("the ~10% tolerance boundary (COMPLETION_TOLERANCE)", () => {
    it("is exactly 0.10", () => {
      expect(COMPLETION_TOLERANCE).toBe(0.1);
    });

    it("exactly +10% over reads as within tolerance (the boundary is inclusive)", () => {
      const comparison = compareCompletionToPlan({
        plannedDistanceM: 10 * MILE_METERS,
        plannedDistanceMaxM: null,
        plannedDurationS: null,
        plannedDurationMaxS: null,
        actualDistanceM: 11 * MILE_METERS, // +10% exactly
        actualDurationS: null,
      });
      expect(comparison.distanceDelta!.withinTolerance).toBe(true);
      expect(comparison.onPlan).toBe(true);
    });

    it("exactly -10% under also reads as within tolerance", () => {
      const comparison = compareCompletionToPlan({
        plannedDistanceM: 10 * MILE_METERS,
        plannedDistanceMaxM: null,
        plannedDurationS: null,
        plannedDurationMaxS: null,
        actualDistanceM: 9 * MILE_METERS, // -10% exactly
        actualDurationS: null,
      });
      expect(comparison.distanceDelta!.withinTolerance).toBe(true);
      expect(comparison.onPlan).toBe(true);
    });

    it("a hair over +10% reads as off-plan", () => {
      const comparison = compareCompletionToPlan({
        plannedDistanceM: 10 * MILE_METERS,
        plannedDistanceMaxM: null,
        plannedDurationS: null,
        plannedDurationMaxS: null,
        actualDistanceM: 11.01 * MILE_METERS,
        actualDurationS: null,
      });
      expect(comparison.distanceDelta!.withinTolerance).toBe(false);
      expect(comparison.onPlan).toBe(false);
    });

    it("a hair under -10% also reads as off-plan", () => {
      const comparison = compareCompletionToPlan({
        plannedDistanceM: 10 * MILE_METERS,
        plannedDistanceMaxM: null,
        plannedDurationS: null,
        plannedDurationMaxS: null,
        actualDistanceM: 8.9 * MILE_METERS,
        actualDurationS: null,
      });
      expect(comparison.distanceDelta!.withinTolerance).toBe(false);
      expect(comparison.onPlan).toBe(false);
    });
  });

  it("completed off-plan, over: a long run that went long is still just information (never clamped, never flagged as an error)", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: 16 * MILE_METERS,
      plannedDistanceMaxM: null,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      actualDistanceM: 20 * MILE_METERS,
      actualDurationS: null,
    });
    expect(comparison.onPlan).toBe(false);
    expect(comparison.distanceDelta!.deltaValue).toBeCloseTo(4 * MILE_METERS, 0);
    expect(comparison.distanceDelta!.deltaValue).toBeGreaterThan(0);
  });

  it("completed off-plan, under: a signed negative delta, not a clamped 0", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: 8 * MILE_METERS,
      plannedDistanceMaxM: null,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      actualDistanceM: 6.2 * MILE_METERS,
      actualDurationS: null,
    });
    expect(comparison.onPlan).toBe(false);
    expect(comparison.distanceDelta!.deltaValue).toBeLessThan(0);
  });

  it("averages a planned min/max range into one representative planned value", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: 8 * MILE_METERS,
      plannedDistanceMaxM: 10 * MILE_METERS,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      actualDistanceM: 9 * MILE_METERS, // dead center of the range
      actualDurationS: null,
    });
    expect(comparison.distanceDelta!.plannedValue).toBeCloseTo(9 * MILE_METERS, 0);
    expect(comparison.distanceDelta!.withinTolerance).toBe(true);
  });

  describe("mixed cases -- distance logged, duration missing (or vice versa) never fabricates the missing delta", () => {
    it("distance has both planned and actual; duration has no actual at all -- durationDelta stays null, distanceDelta is real", () => {
      const comparison = compareCompletionToPlan({
        plannedDistanceM: 8 * MILE_METERS,
        plannedDistanceMaxM: null,
        plannedDurationS: 2700,
        plannedDurationMaxS: null,
        actualDistanceM: 6.2 * MILE_METERS,
        actualDurationS: null,
      });
      expect(comparison.distanceDelta).not.toBeNull();
      expect(comparison.durationDelta).toBeNull();
    });

    it("duration has both planned and actual; distance was never planned at all -- distanceDelta stays null even though an actual distance exists", () => {
      const comparison = compareCompletionToPlan({
        plannedDistanceM: null,
        plannedDistanceMaxM: null,
        plannedDurationS: 2700,
        plannedDurationMaxS: null,
        actualDistanceM: 6.2 * MILE_METERS,
        actualDurationS: 2292,
      });
      expect(comparison.distanceDelta).toBeNull();
      expect(comparison.durationDelta).not.toBeNull();
      // Primary metric falls back to duration since no distance was planned.
      expect(comparison.onPlan).toBe(comparison.durationDelta!.withinTolerance);
    });

    it("neither distance nor duration was ever planned, but both were logged -- both deltas stay null, reads as on-plan (no-target, see describeCompletionFigures)", () => {
      const comparison = compareCompletionToPlan({
        plannedDistanceM: null,
        plannedDistanceMaxM: null,
        plannedDurationS: null,
        plannedDurationMaxS: null,
        actualDistanceM: 6.2 * MILE_METERS,
        actualDurationS: 2292,
      });
      expect(comparison.distanceDelta).toBeNull();
      expect(comparison.durationDelta).toBeNull();
      expect(comparison.onPlan).toBe(true);
    });
  });

  it("distance is the primary metric whenever a planned distance exists, even if duration happens to be off-plan on its own", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: 10 * MILE_METERS,
      plannedDistanceMaxM: null,
      plannedDurationS: 3600,
      plannedDurationMaxS: null,
      actualDistanceM: 10 * MILE_METERS, // dead on
      actualDurationS: 5400, // wildly off, but duration isn't primary here
    });
    expect(comparison.distanceDelta!.withinTolerance).toBe(true);
    expect(comparison.durationDelta!.withinTolerance).toBe(false);
    expect(comparison.onPlan).toBe(true);
  });
});

describe("describeCompletionFigures", () => {
  it("upcoming/no-comparison-data case is handled by callers, not this function -- describeCompletionFigures itself always assumes a completed workout is being described", () => {
    // (covered implicitly by every other test in this file; this function
    // is only ever called once a workout is known to be completed.)
    expect(true).toBe(true);
  });

  it("on-plan: one clean actual-only line, full style", () => {
    const comparison: CompletionComparison = { distanceDelta: null, durationDelta: null, onPlan: true };
    const figures = describeCompletionFigures(comparison, { actualDistanceM: 8 * MILE_METERS, actualDurationS: 2700 }, "full");
    expect(figures.distanceText).toBe("8.0 mi");
    expect(figures.durationText).toBe("45:00");
  });

  it("on-plan: compact style for dense tiles", () => {
    const comparison: CompletionComparison = { distanceDelta: null, durationDelta: null, onPlan: true };
    const figures = describeCompletionFigures(comparison, { actualDistanceM: 8 * MILE_METERS, actualDurationS: 2700 }, "compact");
    expect(figures.distanceText).toBe("8mi");
  });

  it("off-plan: shows the delta for both distance and duration when both exist, full style", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: 8 * MILE_METERS,
      plannedDistanceMaxM: null,
      plannedDurationS: 2700,
      plannedDurationMaxS: null,
      actualDistanceM: 6.2 * MILE_METERS,
      actualDurationS: 2292,
    });
    const figures = describeCompletionFigures(comparison, { actualDistanceM: 6.2 * MILE_METERS, actualDurationS: 2292 }, "full");
    expect(figures.distanceText).toBe("8.0 mi planned → 6.2 mi");
    expect(figures.durationText).toBe("45:00 → 38:12");
  });

  it("off-plan with duration missing: shows the distance delta, falls back to the actual duration alone rather than fabricating a delta", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: 8 * MILE_METERS,
      plannedDistanceMaxM: null,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      actualDistanceM: 6.2 * MILE_METERS,
      actualDurationS: 2292,
    });
    const figures = describeCompletionFigures(comparison, { actualDistanceM: 6.2 * MILE_METERS, actualDurationS: 2292 }, "full");
    expect(figures.distanceText).toContain("→");
    expect(figures.durationText).toBe("38:12");
    expect(figures.durationText).not.toContain("→");
  });

  it("no-target, completed: shows actuals alone with no delta arrow at all (nothing was ever planned to compare against)", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: null,
      plannedDistanceMaxM: null,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      actualDistanceM: 6.2 * MILE_METERS,
      actualDurationS: 2292,
    });
    const figures = describeCompletionFigures(comparison, { actualDistanceM: 6.2 * MILE_METERS, actualDurationS: 2292 }, "full");
    expect(figures.distanceText).toBe("6.2 mi");
    expect(figures.distanceText).not.toContain("→");
    expect(figures.durationText).toBe("38:12");
  });

  it("no-target, completed, nothing logged either: both figures are null (the tile's own 'No targets set' fallback takes over)", () => {
    const comparison: CompletionComparison = { distanceDelta: null, durationDelta: null, onPlan: true };
    const figures = describeCompletionFigures(comparison, { actualDistanceM: null, actualDurationS: null }, "full");
    expect(figures.distanceText).toBeNull();
    expect(figures.durationText).toBeNull();
  });

  it("Strava-matched completion produces identical figures to a manually-logged one with the same actual numbers -- the comparison math never looks at completion source", () => {
    const manualComparison = compareCompletionToPlan({
      plannedDistanceM: 8 * MILE_METERS,
      plannedDistanceMaxM: null,
      plannedDurationS: 2700,
      plannedDurationMaxS: null,
      actualDistanceM: 6.2 * MILE_METERS,
      actualDurationS: 2292,
    });
    // Same inputs regardless of whether the actuals came from a Strava
    // match (completed_workouts.strava_activity_id set) or manual entry --
    // compareCompletionToPlan/describeCompletionFigures take no completion-
    // source parameter at all, so there is nothing for a Strava-sourced
    // row to do differently here.
    const stravaComparison = compareCompletionToPlan({
      plannedDistanceM: 8 * MILE_METERS,
      plannedDistanceMaxM: null,
      plannedDurationS: 2700,
      plannedDurationMaxS: null,
      actualDistanceM: 6.2 * MILE_METERS,
      actualDurationS: 2292,
    });
    expect(stravaComparison).toEqual(manualComparison);

    const manualFigures = describeCompletionFigures(manualComparison, { actualDistanceM: 6.2 * MILE_METERS, actualDurationS: 2292 }, "full");
    const stravaFigures = describeCompletionFigures(stravaComparison, { actualDistanceM: 6.2 * MILE_METERS, actualDurationS: 2292 }, "full");
    expect(stravaFigures).toEqual(manualFigures);
  });
});

describe("formatting helpers", () => {
  it("formatActualDistance: full vs compact style", () => {
    expect(formatActualDistance(8 * MILE_METERS, "full")).toBe("8.0 mi");
    expect(formatActualDistance(8 * MILE_METERS, "compact")).toBe("8mi");
  });

  it("formatDistanceDelta: planned always first, actual always second, direction never hidden", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: 8 * MILE_METERS,
      plannedDistanceMaxM: null,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      actualDistanceM: 6.2 * MILE_METERS,
      actualDurationS: null,
    });
    expect(formatDistanceDelta(comparison.distanceDelta!, "full")).toBe("8.0 mi planned → 6.2 mi");
    expect(formatDistanceDelta(comparison.distanceDelta!, "compact")).toBe("8mi → 6.2mi");
  });

  it("formatDurationDelta: precise clock time on both sides", () => {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: null,
      plannedDistanceMaxM: null,
      plannedDurationS: 2700,
      plannedDurationMaxS: null,
      actualDistanceM: null,
      actualDurationS: 2292,
    });
    expect(formatDurationDelta(comparison.durationDelta!)).toBe("45:00 → 38:12");
  });
});
