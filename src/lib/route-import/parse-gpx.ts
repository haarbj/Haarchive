// GPX is simple, well-structured XML -- parsed with the browser's native
// DOMParser rather than adding a dependency for it. Standard structure:
// <gpx><trk><trkseg><trkpt lat="..." lon="..."><ele/><time/></trkpt>...

import { ElapsedTimeTracker, parseFloatOrNull, parseXml } from "@/lib/route-import/parse-utils";
import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";

export function parseGpx(xmlText: string): ParsedRoute {
  const doc = parseXml(xmlText, "GPX");
  const trackPointElements = Array.from(doc.getElementsByTagName("trkpt"));
  if (trackPointElements.length === 0) {
    throw new Error("No track points found in this GPX file.");
  }

  const elapsed = new ElapsedTimeTracker();
  const points: RoutePoint[] = trackPointElements.map((trkpt) => {
    const elevationText = trkpt.getElementsByTagName("ele")[0]?.textContent;
    const timeText = trkpt.getElementsByTagName("time")[0]?.textContent;
    return {
      lat: parseFloatOrNull(trkpt.getAttribute("lat")),
      lon: parseFloatOrNull(trkpt.getAttribute("lon")),
      elevationM: parseFloatOrNull(elevationText),
      elapsedSeconds: elapsed.elapsedSecondsFor(timeText),
    };
  });

  return { points, source: "gpx", startTimeIso: elapsed.startTimeIso };
}
