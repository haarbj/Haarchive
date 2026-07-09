// Deliberately parallel to the time helpers in pace-calculator.tsx rather
// than imported from it -- that component is mid-edit elsewhere, so this
// avoids touching it. Worth unifying into one shared module whenever that
// component's math moves into /lib/coaching-engine.

export function parseTimeToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((part) => Number(part.trim()));
  if (nums.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (nums.length === 2) {
    const [m, s] = nums;
    return m * 60 + s;
  }
  const [h, m, s] = nums;
  return h * 3600 + m * 60 + s;
}

export function formatClock(totalSeconds: number): string {
  const rounded = Math.round(Math.max(0, totalSeconds));
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

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
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
