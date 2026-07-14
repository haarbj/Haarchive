// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { parseTcx } from "@/lib/route-import/parse-tcx";

const SAMPLE_TCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Lap StartTime="2026-07-13T12:00:00Z">
        <Track>
          <Trackpoint>
            <Time>2026-07-13T12:00:00Z</Time>
            <Position>
              <LatitudeDegrees>44.9419</LatitudeDegrees>
              <LongitudeDegrees>-93.3397</LongitudeDegrees>
            </Position>
            <AltitudeMeters>269.0</AltitudeMeters>
            <DistanceMeters>0</DistanceMeters>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-07-13T12:00:30Z</Time>
            <Position>
              <LatitudeDegrees>44.9420</LatitudeDegrees>
              <LongitudeDegrees>-93.3390</LongitudeDegrees>
            </Position>
            <AltitudeMeters>270.5</AltitudeMeters>
            <DistanceMeters>63.5</DistanceMeters>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

describe("parseTcx", () => {
  it("extracts lat/lon/elevation/elapsed time from track points", () => {
    const route = parseTcx(SAMPLE_TCX);
    expect(route.source).toBe("tcx");
    expect(route.points).toHaveLength(2);
    expect(route.points[0]).toEqual({ lat: 44.9419, lon: -93.3397, elevationM: 269.0, elapsedSeconds: 0 });
    expect(route.points[1].elapsedSeconds).toBe(30);
    expect(route.points[1].elevationM).toBe(270.5);
  });

  it("throws a descriptive error for a file with no track points", () => {
    const emptyTcx = `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities></Activities></TrainingCenterDatabase>`;
    expect(() => parseTcx(emptyTcx)).toThrow(/no track points/i);
  });

  it("throws a descriptive error for malformed XML", () => {
    expect(() => parseTcx("<TrainingCenterDatabase not closed")).toThrow(/valid TCX/i);
  });
});
