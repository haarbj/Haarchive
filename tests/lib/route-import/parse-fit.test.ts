import { describe, expect, it, vi } from "vitest";

// Mocks fit-file-parser itself rather than depending on a real binary .FIT
// fixture -- the actual binary decoding is that library's own, separately
// maintained and tested responsibility; what parse-fit.ts needs verified
// here is its own wrapper logic (record -> RoutePoint mapping, the
// enhanced_altitude/altitude fallback, and error handling for an empty or
// unparseable file). Manually verified once against a real device-recorded
// FIT file while building this (1296 points, ~9.3mi / 82min, sane
// elevation gain/loss) -- not committed as a fixture since it was a real
// personal GPS trace.
const parseAsyncMock = vi.fn();
vi.mock("fit-file-parser", () => ({
  default: class {
    parseAsync = parseAsyncMock;
  },
}));

const { parseFit } = await import("@/lib/route-import/parse-fit");

describe("parseFit", () => {
  it("maps FIT records to RoutePoints, preferring enhanced_altitude over altitude", () => {
    parseAsyncMock.mockResolvedValueOnce({
      records: [
        { position_lat: 44.94, position_long: -93.34, enhanced_altitude: 269.2, altitude: 269, timestamp: new Date("2026-07-13T12:00:00Z") },
        { position_lat: 44.941, position_long: -93.339, altitude: 271, timestamp: new Date("2026-07-13T12:00:04Z") },
      ],
    });

    return parseFit(new ArrayBuffer(0)).then((route) => {
      expect(route.source).toBe("fit");
      expect(route.points).toHaveLength(2);
      expect(route.points[0]).toEqual({ lat: 44.94, lon: -93.34, elevationM: 269.2, elapsedSeconds: 0 });
      expect(route.points[1]).toEqual({ lat: 44.941, lon: -93.339, elevationM: 271, elapsedSeconds: 4 });
    });
  });

  it("throws a descriptive error when the file has no records", () => {
    parseAsyncMock.mockResolvedValueOnce({ records: [] });
    return expect(parseFit(new ArrayBuffer(0))).rejects.toThrow(/no track points/i);
  });

  it("throws a descriptive error when the underlying parser rejects", () => {
    parseAsyncMock.mockRejectedValueOnce(new Error("garbage in"));
    return expect(parseFit(new ArrayBuffer(0))).rejects.toThrow(/valid FIT/i);
  });
});
