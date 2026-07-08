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
