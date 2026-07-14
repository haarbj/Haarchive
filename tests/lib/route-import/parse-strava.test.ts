import { describe, expect, it } from "vitest";

import { stravaStreamsToRoute } from "@/lib/route-import/parse-strava";

describe("stravaStreamsToRoute", () => {
  it("zips latlng/altitude/time streams into RoutePoints", () => {
    const route = stravaStreamsToRoute({
      latlng: [
        [44.94, -93.34],
        [44.941, -93.339],
      ],
      altitude: [269, 271],
      time: [0, 4],
    });
    expect(route.source).toBe("strava");
    expect(route.points).toEqual([
      { lat: 44.94, lon: -93.34, elevationM: 269, elapsedSeconds: 0 },
      { lat: 44.941, lon: -93.339, elevationM: 271, elapsedSeconds: 4 },
    ]);
  });

  it("handles a stream missing GPS (e.g. an indoor/treadmill activity with only altitude/time)", () => {
    const route = stravaStreamsToRoute({ altitude: [100, 100], time: [0, 60] });
    expect(route.points).toEqual([
      { lat: null, lon: null, elevationM: 100, elapsedSeconds: 0 },
      { lat: null, lon: null, elevationM: 100, elapsedSeconds: 60 },
    ]);
  });

  it("throws a descriptive error when every stream is empty", () => {
    expect(() => stravaStreamsToRoute({})).toThrow(/gps or elevation data/i);
  });
});
