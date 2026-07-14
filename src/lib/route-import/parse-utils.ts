// Small helpers shared by parse-gpx.ts and parse-tcx.ts -- both are XML
// formats read with the browser's native DOMParser, and both need the same
// "turn an ISO 8601 timestamp into seconds-since-the-first-point" logic.

export function parseFloatOrNull(text: string | null | undefined): number | null {
  if (text === null || text === undefined || text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function parseXml(xmlText: string, formatLabel: string): Document {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error(`This file doesn't look like a valid ${formatLabel} file.`);
  }
  return doc;
}

/**
 * Tracks the first-seen timestamp across a sequence of points, converting
 * each into elapsed seconds since it. Accepts a Date too, not just a
 * string -- fit-file-parser's own type declarations say `timestamp` is a
 * string, but defending against it actually being a Date at runtime costs
 * nothing and avoids a fragile implicit-coercion dependency.
 */
export class ElapsedTimeTracker {
  private firstTimeMs: number | null = null;

  elapsedSecondsFor(time: string | Date | null | undefined): number | null {
    if (!time) return null;
    const timeMs = time instanceof Date ? time.getTime() : Date.parse(time);
    if (!Number.isFinite(timeMs)) return null;
    if (this.firstTimeMs === null) this.firstTimeMs = timeMs;
    return (timeMs - this.firstTimeMs) / 1000;
  }

  /** The first absolute timestamp seen, as ISO 8601 -- the activity's real start time. */
  get startTimeIso(): string | null {
    return this.firstTimeMs === null ? null : new Date(this.firstTimeMs).toISOString();
  }
}
