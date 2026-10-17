import { MILE_METERS } from "@/lib/race-distances";

export function formatDistance(meters: number): string {
  if (meters >= 42195) return "Marathon";
  if (meters >= 21097 && meters < 21200) return "Half Marathon";
  if (meters % 1609 === 0 || meters === 1609) return `${Math.round(meters / 1609)} Mile`;
  if (meters % 1000 === 0) return `${meters / 1000}K`;
  return `${meters}m`;
}

// For logged/actual distances (a GPS run is essentially never a round
// number of meters), as opposed to formatDistance's canonical-race-distance
// labels above -- e.g. "6.2 mi" for a Strava activity or a manually logged
// completion.
export function formatMiles(meters: number): string {
  return `${(meters / MILE_METERS).toFixed(1)} mi`;
}

// "Mon"/"Tue" column headers for the coaching calendar's week grid -- no
// existing formatter covers weekday-only.
export function formatWeekday(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

export function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Same output as formatDate, but defensive on both ends: accepts a plain
// date ("2026-10-15") OR a full timestamptz ("2026-10-15T14:23:01+00:00")
// by always taking just the first 10 characters -- formatDate itself
// assumes a plain date and silently produces "Invalid Date" if handed a
// full timestamp (the "T00:00:00" it appends collides with the timestamp's
// own time/offset). Also returns null instead of rendering "Invalid Date"
// for a null/empty/genuinely malformed input, so a caller can omit the
// whole sentence fragment that would otherwise read it (see
// resolvePacePercent's own "updated ..." clause for the motivating case).
export function formatDateSafe(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Tags are stored lowercase (see parseTags in validation/articles.ts and
// questions' own parseTags) for consistent matching/filtering -- this is
// purely a display transform, so "heart rate" reads as "Heart Rate"
// wherever a tag is actually shown to a reader.
export function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

// "2 hours ago"-style relative time for a full timestamp (as opposed to
// formatDate's plain "yyyy-mm-dd" handling above), used for things logged
// with a precise moment rather than just a calendar date.
export function formatRelativeTime(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  const diffSeconds = Math.round((Date.now() - then) / 1000);

  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return formatDate(isoTimestamp.slice(0, 10));
}
