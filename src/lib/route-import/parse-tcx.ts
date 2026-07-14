// TCX (Garmin Training Center XML) -- also simple XML, parsed the same
// way as GPX. Standard structure: <TrainingCenterDatabase><Activities>
// <Activity><Lap><Track><Trackpoint><Position><LatitudeDegrees/>
// <LongitudeDegrees/></Position><AltitudeMeters/><Time/></Trackpoint>...

import { ElapsedTimeTracker, parseFloatOrNull, parseXml } from "@/lib/route-import/parse-utils";
import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";

export function parseTcx(xmlText: string): ParsedRoute {
  const doc = parseXml(xmlText, "TCX");
  const trackPointElements = Array.from(doc.getElementsByTagName("Trackpoint"));
  if (trackPointElements.length === 0) {
    throw new Error("No track points found in this TCX file.");
  }

  const elapsed = new ElapsedTimeTracker();
  const points: RoutePoint[] = trackPointElements.map((trackpoint) => {
    const latText = trackpoint.getElementsByTagName("LatitudeDegrees")[0]?.textContent;
    const lonText = trackpoint.getElementsByTagName("LongitudeDegrees")[0]?.textContent;
    const elevationText = trackpoint.getElementsByTagName("AltitudeMeters")[0]?.textContent;
    const timeText = trackpoint.getElementsByTagName("Time")[0]?.textContent;
    return {
      lat: parseFloatOrNull(latText),
      lon: parseFloatOrNull(lonText),
      elevationM: parseFloatOrNull(elevationText),
      elapsedSeconds: elapsed.elapsedSecondsFor(timeText),
    };
  });

  return { points, source: "tcx", startTimeIso: elapsed.startTimeIso };
}
