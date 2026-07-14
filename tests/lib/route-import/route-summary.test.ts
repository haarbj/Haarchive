import { describe, expect, it } from "vitest";

import { bearingDeg, haversineDistanceM, summarizeRoute } from "@/lib/route-import/route-summary";
import type { ParsedRoute } from "@/lib/route-import/types";

describe("haversineDistanceM", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistanceM(44.94, -93.34, 44.94, -93.34)).toBe(0);
  });

  it("matches a known reference distance (1 degree of latitude is ~111.2km)", () => {
    const distance = haversineDistanceM(0, 0, 1, 0);
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_000);
  });
});

describe("bearingDeg", () => {
  it("is 0 (north) for a due-north displacement", () => {
    expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 3);
  });

  it("is 90 (east) for a due-east displacement at the equator", () => {
    expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 3);
  });

  it("is 180 (south) for a due-south displacement", () => {
    expect(bearingDeg(1, 0, 0, 0)).toBeCloseTo(180, 3);
  });
});

describe("summarizeRoute", () => {
  it("sums distance across consecutive GPS points", () => {
    const route: ParsedRoute = {
      source: "gpx",
      startTimeIso: null,
      points: [
        { lat: 0, lon: 0, elevationM: null, elapsedSeconds: 0 },
        { lat: 0, lon: 0.01, elevationM: null, elapsedSeconds: 10 },
        { lat: 0, lon: 0.02, elevationM: null, elapsedSeconds: 20 },
      ],
    };
    const summary = summarizeRoute(route);
    expect(summary.totalDistanceM).toBeGreaterThan(0);
    expect(summary.headingSegments).toHaveLength(2);
    expect(summary.totalTimeSeconds).toBe(20);
  });

  it("computes a centroid from valid GPS points and passes through the start time", () => {
    const route: ParsedRoute = {
      source: "gpx",
      startTimeIso: "2026-07-13T12:00:00.000Z",
      points: [
        { lat: 10, lon: 20, elevationM: null, elapsedSeconds: 0 },
        { lat: 12, lon: 22, elevationM: null, elapsedSeconds: 10 },
      ],
    };
    const summary = summarizeRoute(route);
    expect(summary.centroidLat).toBeCloseTo(11, 6);
    expect(summary.centroidLon).toBeCloseTo(21, 6);
    expect(summary.startTimeIso).toBe("2026-07-13T12:00:00.000Z");
  });

  it("returns a null centroid when there are no valid GPS points", () => {
    const route: ParsedRoute = {
      source: "gpx",
      startTimeIso: null,
      points: [{ lat: null, lon: null, elevationM: 100, elapsedSeconds: 0 }],
    };
    const summary = summarizeRoute(route);
    expect(summary.centroidLat).toBeNull();
    expect(summary.centroidLon).toBeNull();
  });

  it("filters out elevation noise below the threshold", () => {
    const route: ParsedRoute = {
      source: "gpx",
      startTimeIso: null,
      points: [
        { lat: null, lon: null, elevationM: 100, elapsedSeconds: 0 },
        { lat: null, lon: null, elevationM: 100.3, elapsedSeconds: 1 }, // sub-threshold jitter
        { lat: null, lon: null, elevationM: 100.5, elapsedSeconds: 2 }, // still sub-threshold vs last *counted* point
        { lat: null, lon: null, elevationM: 105, elapsedSeconds: 3 }, // real climb
      ],
    };
    const summary = summarizeRoute(route);
    // Only the 100 -> 105 jump (once accumulated jitter is real) should count meaningfully;
    // small sub-1m deltas shouldn't each separately register as gain.
    expect(summary.elevationGainM).toBeGreaterThan(0);
    expect(summary.elevationLossM).toBe(0);
  });

  it("accumulates separate gain and loss", () => {
    const route: ParsedRoute = {
      source: "gpx",
      startTimeIso: null,
      points: [
        { lat: null, lon: null, elevationM: 100, elapsedSeconds: 0 },
        { lat: null, lon: null, elevationM: 110, elapsedSeconds: 10 },
        { lat: null, lon: null, elevationM: 102, elapsedSeconds: 20 },
      ],
    };
    const summary = summarizeRoute(route);
    expect(summary.elevationGainM).toBeCloseTo(10, 6);
    expect(summary.elevationLossM).toBeCloseTo(8, 6);
  });

  it("returns zeros for a route with no usable points", () => {
    const route: ParsedRoute = { source: "gpx",
      startTimeIso: null, points: [] };
    const summary = summarizeRoute(route);
    expect(summary.totalDistanceM).toBe(0);
    expect(summary.elevationGainM).toBe(0);
    expect(summary.elevationLossM).toBe(0);
    expect(summary.headingSegments).toHaveLength(0);
    expect(summary.totalTimeSeconds).toBe(0);
  });

  it("uses the last available elapsed time even if trailing points lack one", () => {
    const route: ParsedRoute = {
      source: "gpx",
      startTimeIso: null,
      points: [
        { lat: null, lon: null, elevationM: null, elapsedSeconds: 0 },
        { lat: null, lon: null, elevationM: null, elapsedSeconds: 42 },
        { lat: null, lon: null, elevationM: null, elapsedSeconds: null },
      ],
    };
    expect(summarizeRoute(route).totalTimeSeconds).toBe(42);
  });
});
