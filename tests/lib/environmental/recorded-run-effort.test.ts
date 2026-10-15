import { describe, expect, it } from "vitest";

import { computeRecordedRunEffort, medianEffortSpeedMS, aggregateRecordedEffortByMile } from "@/lib/environmental/recorded-run-effort";
import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";

const EARTH_RADIUS_M = 6371000;
const MILE_METERS_FOR_TEST = 1609.344;

/**
 * Builds a synthetic recorded route along the equator (same reasoning as
 * course-analysis.test.ts's buildRoute: exact, easy-to-invert great-
 * circle distance per degree of longitude there), running due east at a
 * constant actual pace, with elevation following a piecewise-linear
 * profile and real elapsed-time stamps -- the one thing
 * course-analysis.test.ts's own route builder deliberately leaves null,
 * since this module needs it and that one doesn't.
 */
function buildRecordedRoute(profile: { distanceM: number; elevationM: number }[], paceSPerM: number, stepM = 10): ParsedRoute {
  const totalDistanceM = profile[profile.length - 1].distanceM;
  const points: RoutePoint[] = [];

  function elevationAt(distanceM: number): number {
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i];
      const b = profile[i + 1];
      if (distanceM >= a.distanceM && distanceM <= b.distanceM) {
        const t = (distanceM - a.distanceM) / (b.distanceM - a.distanceM);
        return a.elevationM + (b.elevationM - a.elevationM) * t;
      }
    }
    return profile[profile.length - 1].elevationM;
  }

  for (let d = 0; d <= totalDistanceM; d += stepM) {
    const lonDeg = (d / EARTH_RADIUS_M) * (180 / Math.PI);
    points.push({ lat: 0, lon: lonDeg, elevationM: elevationAt(d), elapsedSeconds: d * paceSPerM });
  }

  return { points, source: "gpx", startTimeIso: null, movingTimeS: null };
}

const CALM_COOL: WeatherConditions = {
  tempC: 10,
  relativeHumidityPct: 30,
  dewPointC: -5,
  cloudCoverPct: 20,
  pressureHPa: 1013,
  windSpeedMS: 0,
  windFromBearingDeg: 0,
  windGustsMS: 0,
  elevationM: null,
  source: "forecast",
};

function weatherThroughout(conditions: WeatherConditions, durationSeconds: number): { elapsedSeconds: number; conditions: WeatherConditions }[] {
  return [{ elapsedSeconds: 0, conditions }, { elapsedSeconds: durationSeconds, conditions }];
}

describe("computeRecordedRunEffort", () => {
  it("reports an effort speed close to actual speed on a flat course in calm, cool conditions", () => {
    const paceSPerM = 8 * 60 / 1609.344; // 8:00/mi
    const route = buildRecordedRoute(
      [
        { distanceM: 0, elevationM: 0 },
        { distanceM: 3000, elevationM: 0 },
      ],
      paceSPerM,
    );
    const stretches = computeRecordedRunEffort(route, weatherThroughout(CALM_COOL, 3000 * paceSPerM));

    const actualSpeedMS = 1 / paceSPerM;
    for (const s of stretches) {
      expect(s.isStop).toBe(false);
      expect(s.effortSpeedMS).not.toBeNull();
      // Nothing to undo on a flat, calm, cool course -- effort should
      // land within a small tolerance of the real actual speed (not
      // exactly equal, since the heat/humidity grid's optimum isn't
      // perfectly zero-adjustment at exactly this temp/humidity).
      expect(s.effortSpeedMS!).toBeCloseTo(actualSpeedMS, 1);
    }
  });

  it("reports a faster effort speed than actual for an uphill stretch -- grade, not fitness, explains the slower clock time", () => {
    const paceSPerM = 8 * 60 / 1609.344;
    const route = buildRecordedRoute(
      [
        { distanceM: 0, elevationM: 0 },
        { distanceM: 2000, elevationM: 140 }, // a real, sustained ~7% climb
      ],
      paceSPerM,
    );
    const stretches = computeRecordedRunEffort(route, weatherThroughout(CALM_COOL, 2000 * paceSPerM));

    const actualSpeedMS = 1 / paceSPerM;
    for (const s of stretches) {
      // A real margin, not a bare toBeGreaterThan -- a ~7% climb should
      // recover noticeably more than a sliver of a percent back, so a
      // disabled/no-op grade-undo (which would leave effort ≈ actual,
      // differing only by floating-point noise) can't pass this by
      // accident the way a bare ">" comparison would.
      expect(s.effortSpeedMS!).toBeGreaterThan(actualSpeedMS * 1.05);
    }
  });

  it("reports a faster effort speed than actual for a heat-run -- undoing heat recovers the pace cooler conditions would have allowed", () => {
    // A half-marathon-length run, not a short one -- heat-model.ts's own
    // durationScaleFor deliberately scales the marathon-calibrated heat
    // penalty down hard for a short effort (clamped as low as 0.15x), so
    // a too-short test run would make even a real, working heat-undo
    // produce only a sliver of recovery, indistinguishable from a
    // disabled one. A half marathon is long enough to show the effect
    // clearly while still running fast in this test.
    const paceSPerM = 8 * 60 / 1609.344;
    const route = buildRecordedRoute(
      [
        { distanceM: 0, elevationM: 0 },
        { distanceM: 21097, elevationM: 0 },
      ],
      paceSPerM,
      100,
    );
    const hot: WeatherConditions = { ...CALM_COOL, tempC: 32, relativeHumidityPct: 70 };
    const stretches = computeRecordedRunEffort(route, weatherThroughout(hot, 21097 * paceSPerM));

    const actualSpeedMS = 1 / paceSPerM;
    for (const s of stretches) {
      // A real margin (observed ~2.7% at this duration/condition combo),
      // not a bare toBeGreaterThan that floating-point noise from a
      // disabled/no-op heat-undo could pass by accident.
      expect(s.effortSpeedMS!).toBeGreaterThan(actualSpeedMS * 1.02);
    }
  });

  it("flags a near-stationary stretch as a stop and excludes it from the effort view", () => {
    // Fast for the first and third thirds, dead stop (a stoplight) for
    // the middle third -- constructed directly via elapsed-time keyframes
    // rather than the constant-pace helper, since a stop needs elapsed
    // time to diverge from distance.
    const points: RoutePoint[] = [];
    const segments: { distanceM: number; elapsedSeconds: number }[] = [
      { distanceM: 0, elapsedSeconds: 0 },
      { distanceM: 500, elapsedSeconds: 150 }, // brisk: 500m in 150s
      { distanceM: 500, elapsedSeconds: 210 }, // stopped: 60s, zero distance
      { distanceM: 1000, elapsedSeconds: 360 }, // brisk again
    ];
    // Expand into 10m steps with interpolated elapsed time within each
    // keyframe segment (the stop segment stays at the same distance).
    for (let i = 0; i < segments.length - 1; i++) {
      const a = segments[i];
      const b = segments[i + 1];
      const distSpan = b.distanceM - a.distanceM;
      const steps = Math.max(1, Math.round(distSpan / 10));
      for (let s = 0; s <= steps; s++) {
        const d = a.distanceM + (distSpan * s) / steps;
        const t = a.elapsedSeconds + ((b.elapsedSeconds - a.elapsedSeconds) * s) / steps;
        const lonDeg = (d / EARTH_RADIUS_M) * (180 / Math.PI);
        points.push({ lat: 0, lon: lonDeg, elevationM: 0, elapsedSeconds: t });
      }
    }
    const route: ParsedRoute = { points, source: "gpx", startTimeIso: null, movingTimeS: null };
    const stretches = computeRecordedRunEffort(route, weatherThroughout(CALM_COOL, 360), { stretchLengthM: 100 });

    const stopStretches = stretches.filter((s) => s.isStop);
    expect(stopStretches.length).toBeGreaterThan(0);
    for (const s of stopStretches) expect(s.effortSpeedMS).toBeNull();
    // The stop sits in the middle of the course (around 500m) -- confirm
    // it's actually there, not just that some unrelated stretch tripped
    // the threshold.
    expect(stopStretches.some((s) => s.startDistanceM >= 400 && s.startDistanceM <= 600)).toBe(true);
  });

  it("tracks each stretch's real recorded elapsed time through a stop, not a distance-proportional guess", () => {
    // A long stop (5 minutes) partway through a short run -- a distance-
    // proportional estimate of "how far into the run, time-wise" a
    // post-stop stretch sits would be quietly wrong here, since the stop
    // adds real elapsed time without adding distance. This is a direct
    // regression test for that bug: weather (and therefore the undo
    // chain) must be resolved against each stretch's own real recorded
    // elapsed time.
    const points: RoutePoint[] = [];
    const segments: { distanceM: number; elapsedSeconds: number }[] = [
      { distanceM: 0, elapsedSeconds: 0 },
      { distanceM: 500, elapsedSeconds: 150 }, // brisk: 500m in 150s
      { distanceM: 500, elapsedSeconds: 450 }, // a long, 5-minute stop
      { distanceM: 1000, elapsedSeconds: 600 }, // brisk again
    ];
    for (let i = 0; i < segments.length - 1; i++) {
      const a = segments[i];
      const b = segments[i + 1];
      const distSpan = b.distanceM - a.distanceM;
      const steps = Math.max(1, Math.round(distSpan / 10));
      for (let s = 0; s <= steps; s++) {
        const d = a.distanceM + (distSpan * s) / steps;
        const t = a.elapsedSeconds + ((b.elapsedSeconds - a.elapsedSeconds) * s) / steps;
        const lonDeg = (d / EARTH_RADIUS_M) * (180 / Math.PI);
        points.push({ lat: 0, lon: lonDeg, elevationM: 0, elapsedSeconds: t });
      }
    }
    const route: ParsedRoute = { points, source: "gpx", startTimeIso: null, movingTimeS: null };
    const stretches = computeRecordedRunEffort(route, weatherThroughout(CALM_COOL, 600), { stretchLengthM: 100 });

    // Every stretch after the stop (distance > 500m) is further along in
    // real elapsed time than a naive "assume constant pace across the
    // whole course" guess would place it, since the 5-minute stop ate
    // real clock time without covering any ground -- a bare, loose bound
    // (not an exact figure) because exactly where each stretch boundary
    // falls shifts slightly with ordinary floating-point noise in the
    // haversine-derived total distance.
    const postStopStretches = stretches.filter((s) => s.startDistanceM > 500);
    expect(postStopStretches.length).toBeGreaterThan(0);
    for (const s of postStopStretches) {
      const naiveProportionalGuess = (s.startDistanceM / 1000) * 600;
      expect(s.startElapsedSeconds).toBeGreaterThan(naiveProportionalGuess + 20);
    }
  });

  it("throws when the route has no real elapsed-time data", () => {
    const route: ParsedRoute = {
      points: [
        { lat: 0, lon: 0, elevationM: 0, elapsedSeconds: null },
        { lat: 0, lon: 0.01, elevationM: 0, elapsedSeconds: null },
      ],
      source: "gpx",
      startTimeIso: null,
      movingTimeS: null,
    };
    expect(() => computeRecordedRunEffort(route, weatherThroughout(CALM_COOL, 100))).toThrow(/elapsed-time/);
  });

  it("throws when given no weather readings", () => {
    const route = buildRecordedRoute(
      [
        { distanceM: 0, elevationM: 0 },
        { distanceM: 1000, elevationM: 0 },
      ],
      8 * 60 / 1609.344,
    );
    expect(() => computeRecordedRunEffort(route, [])).toThrow(/weather reading/);
  });
});

describe("medianEffortSpeedMS", () => {
  it("excludes stops from the aggregate", () => {
    const stretches = [
      { startDistanceM: 0, endDistanceM: 100, distanceM: 100, startElapsedSeconds: 0, elapsedSeconds: 30, actualSpeedMS: 3.33, gradeDecimal: 0, headingDeg: 90, isStop: false, effortSpeedMS: 3 },
      { startDistanceM: 100, endDistanceM: 200, distanceM: 100, startElapsedSeconds: 30, elapsedSeconds: 30, actualSpeedMS: 3.33, gradeDecimal: 0, headingDeg: 90, isStop: false, effortSpeedMS: 4 },
      { startDistanceM: 200, endDistanceM: 300, distanceM: 0, startElapsedSeconds: 60, elapsedSeconds: 60, actualSpeedMS: 0, gradeDecimal: 0, headingDeg: null, isStop: true, effortSpeedMS: null },
    ];
    expect(medianEffortSpeedMS(stretches)).toBe(3.5);
  });

  it("returns null when every stretch is a stop", () => {
    const stretches = [
      { startDistanceM: 0, endDistanceM: 100, distanceM: 0, startElapsedSeconds: 0, elapsedSeconds: 60, actualSpeedMS: 0, gradeDecimal: 0, headingDeg: null, isStop: true, effortSpeedMS: null },
    ];
    expect(medianEffortSpeedMS(stretches)).toBeNull();
  });
});

describe("aggregateRecordedEffortByMile", () => {
  it("rolls a real recorded run up to one row per full mile, including a trailing partial mile", () => {
    const paceSPerM = (8 * 60) / 1609.344;
    const route = buildRecordedRoute(
      [
        { distanceM: 0, elevationM: 0 },
        { distanceM: 3000, elevationM: 0 }, // 1 full mile + a partial second mile
      ],
      paceSPerM,
      50,
    );
    const stretches = computeRecordedRunEffort(route, weatherThroughout(CALM_COOL, 3000 * paceSPerM));
    const byMile = aggregateRecordedEffortByMile(stretches);

    expect(byMile.length).toBe(2);
    expect(byMile[0].mileIndex).toBe(0);
    expect(byMile[0].startDistanceM).toBeCloseTo(0, 0);
    expect(byMile[1].mileIndex).toBe(1);
    // The trailing mile is genuinely partial -- its own distance span is
    // shorter than a full mile, not padded or dropped.
    expect(byMile[1].endDistanceM - byMile[1].startDistanceM).toBeLessThan(MILE_METERS_FOR_TEST);
    for (const mile of byMile) {
      expect(mile.actualPaceSPerMi).toBeCloseTo(8 * 60, 0);
      expect(mile.hasStop).toBe(false);
    }
  });

  it("marks a mile hasStop when any of its stretches were a stop, and still reports an effort pace from the rest", () => {
    const points: RoutePoint[] = [];
    const segments: { distanceM: number; elapsedSeconds: number }[] = [
      { distanceM: 0, elapsedSeconds: 0 },
      { distanceM: 800, elapsedSeconds: 240 }, // brisk
      { distanceM: 800, elapsedSeconds: 300 }, // a short stop, still within mile 0
      { distanceM: 1609, elapsedSeconds: 540 }, // brisk again, finishing mile 0
    ];
    for (let i = 0; i < segments.length - 1; i++) {
      const a = segments[i];
      const b = segments[i + 1];
      const distSpan = b.distanceM - a.distanceM;
      const steps = Math.max(1, Math.round(distSpan / 10));
      for (let s = 0; s <= steps; s++) {
        const d = a.distanceM + (distSpan * s) / steps;
        const t = a.elapsedSeconds + ((b.elapsedSeconds - a.elapsedSeconds) * s) / steps;
        const lonDeg = (d / EARTH_RADIUS_M) * (180 / Math.PI);
        points.push({ lat: 0, lon: lonDeg, elevationM: 0, elapsedSeconds: t });
      }
    }
    const route: ParsedRoute = { points, source: "gpx", startTimeIso: null, movingTimeS: null };
    const stretches = computeRecordedRunEffort(route, weatherThroughout(CALM_COOL, 540), { stretchLengthM: 100 });
    const byMile = aggregateRecordedEffortByMile(stretches);

    expect(byMile).toHaveLength(1);
    expect(byMile[0].hasStop).toBe(true);
    expect(byMile[0].effortPaceSPerMi).not.toBeNull();
  });
});
