// A bare "yyyy-mm-dd" string parses as UTC midnight in `new Date(...)`,
// which can render as the previous calendar day in negative-UTC-offset
// timezones. Every date in this engine is a plain "yyyy-mm-dd" string, and
// all arithmetic below anchors to local midnight instead, matching the same
// fix already in lib/format.ts's formatDate.
function toLocalMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const date = toLocalMidnight(dateStr);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function diffDays(fromDateStr: string, toDateStr: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const from = toLocalMidnight(fromDateStr);
  const to = toLocalMidnight(toDateStr);
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

// 0 = Sunday, matching Date#getDay().
export function dayOfWeek(dateStr: string): number {
  return toLocalMidnight(dateStr).getDay();
}
