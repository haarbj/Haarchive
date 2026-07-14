// FIT (Garmin's binary activity format) -- unlike GPX/TCX, this needs a
// real parser rather than a browser-native one. Uses fit-file-parser
// (MIT licensed, pure JS, no native dependencies), which auto-converts
// FIT's semicircle-encoded lat/lon into standard decimal degrees, so
// position_lat/position_long come out ready to use directly.

import FitParser from "fit-file-parser";

import { ElapsedTimeTracker } from "@/lib/route-import/parse-utils";
import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";

export async function parseFit(buffer: ArrayBuffer): Promise<ParsedRoute> {
  const parser = new FitParser({
    mode: "list",
    lengthUnit: "m",
    speedUnit: "m/s",
    force: true,
  });

  let data;
  try {
    data = await parser.parseAsync(buffer);
  } catch {
    throw new Error("This file doesn't look like a valid FIT file.");
  }

  const records = data.records ?? [];
  if (records.length === 0) {
    throw new Error("No track points found in this FIT file.");
  }

  // Derived from each record's own timestamp the same way GPX/TCX are,
  // rather than the library's `elapsed_time` option -- keeps all three
  // formats going through identical elapsed-time logic.
  const elapsed = new ElapsedTimeTracker();
  const points: RoutePoint[] = records.map((record) => ({
    lat: record.position_lat ?? null,
    lon: record.position_long ?? null,
    elevationM: record.enhanced_altitude ?? record.altitude ?? null,
    elapsedSeconds: elapsed.elapsedSecondsFor(record.timestamp),
  }));

  return { points, source: "fit", startTimeIso: elapsed.startTimeIso };
}
