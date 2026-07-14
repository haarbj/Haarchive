// @vitest-environment happy-dom
// GPX/TCX parsing uses the browser's native DOMParser (the right choice
// for client-side file uploads, and avoids an XML-parsing dependency) --
// which means these specific tests need a DOM, unlike the rest of the
// suite (plain "node" environment, see vitest.config.ts). happy-dom
// provides a real DOMParser without pulling in the heavier jsdom.

import { describe, expect, it } from "vitest";

import { parseGpx } from "@/lib/route-import/parse-gpx";

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Test Run</name>
    <trkseg>
      <trkpt lat="44.9419" lon="-93.3397">
        <ele>269.0</ele>
        <time>2026-07-13T12:00:00Z</time>
      </trkpt>
      <trkpt lat="44.9420" lon="-93.3390">
        <ele>270.5</ele>
        <time>2026-07-13T12:00:30Z</time>
      </trkpt>
      <trkpt lat="44.9425" lon="-93.3380">
        <ele>272.0</ele>
        <time>2026-07-13T12:01:05Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpx", () => {
  it("extracts lat/lon/elevation/elapsed time from track points", () => {
    const route = parseGpx(SAMPLE_GPX);
    expect(route.source).toBe("gpx");
    expect(route.points).toHaveLength(3);
    expect(route.points[0]).toEqual({ lat: 44.9419, lon: -93.3397, elevationM: 269.0, elapsedSeconds: 0 });
    expect(route.points[1].elapsedSeconds).toBe(30);
    expect(route.points[2].elapsedSeconds).toBe(65);
    expect(route.points[2].elevationM).toBe(272.0);
  });

  it("throws a descriptive error for a file with no track points", () => {
    const emptyGpx = `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg></trkseg></trk></gpx>`;
    expect(() => parseGpx(emptyGpx)).toThrow(/no track points/i);
  });

  it("throws a descriptive error for malformed XML", () => {
    expect(() => parseGpx("<gpx><trk not closed")).toThrow(/valid GPX/i);
  });
});
