// Shared by any tool that needs to read or display a running pace/time --
// extracted from pace-calculator.tsx so wind-calculator.tsx (and any future
// tool) doesn't grow a third copy of the same parsing/formatting logic.

// Accepts "mm:ss" or "h:mm:ss". Returns null for anything that doesn't
// parse cleanly rather than guessing.
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

// Track times commonly get typed as bare seconds (e.g. "62.4" for a
// sub-minute rep) as well as mm:ss.d -- parseTimeToSeconds only accepts
// the latter, so this tries a bare-seconds read first.
export function parseTrackTime(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) return parseTimeToSeconds(trimmed);
  const seconds = Number(trimmed);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function formatTrackTime(totalSeconds: number): string {
  if (totalSeconds < 60) return totalSeconds.toFixed(1);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}
