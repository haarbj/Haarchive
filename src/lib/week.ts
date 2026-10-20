// Monday of the week containing `date`, in UTC so this can't drift a day
// depending on the server's local timezone. Shared between the weekly
// check-in Server Action (which needs it to write this week's row) and
// the dashboard page (which needs the identical value to look that row
// back up) -- can't live in a "use server" actions file since Next.js
// requires every export from one to be an async Server Action.
export function mostRecentMonday(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

// The Monday of the most recently COMPLETED week (last week, not the one
// currently in progress) -- private coaching's weekly check-in reports on
// a week only once it's actually over, not mid-week (an athlete shouldn't
// be able to check in about training they haven't finished yet). Shared
// between checkin/page.tsx (which week to display/prefill) and
// checkin/actions.ts (which row to write) so they can't drift apart.
// Deliberately a new function, not a change to mostRecentMonday itself --
// that one is shared with the self-serve/team dashboard's own check-in
// card, which intentionally still means "the week so far."
export function mostRecentCompletedMonday(date: Date): string {
  const monday = new Date(`${mostRecentMonday(date)}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - 7);
  return monday.toISOString().slice(0, 10);
}

// The 7 ISO dates (Mon-Sun) for the week starting at mondayIso. Used by
// the coaching calendar to fetch/group a week's scheduled_workouts and to
// render the 7 day columns -- mondayIso is trusted to already be a Monday
// (as returned by mostRecentMonday/shiftWeek), not re-validated here.
export function weekDates(mondayIso: string): string[] {
  const monday = new Date(`${mondayIso}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i * 1);
    return d.toISOString().slice(0, 10);
  });
}

// Moves a week's Monday forward/back by deltaWeeks (negative for
// "previous") -- powers the calendar's prev/next navigation, which is
// URL-driven (?week=...) rather than client state, so this needs to be a
// plain function callable from a Server Component, not a client hook.
export function shiftWeek(mondayIso: string, deltaWeeks: number): string {
  const monday = new Date(`${mondayIso}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + deltaWeeks * 7);
  return monday.toISOString().slice(0, 10);
}

// The general-purpose version of shiftWeek's own arithmetic -- adds (or,
// for a negative count, subtracts) a number of days to an ISO date.
// copyWeek (schedule/actions.ts) uses this to shift each individual
// scheduled_workouts row from a source week onto a target week, which
// isn't necessarily exactly 7 days away.
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Whole days between two ISO dates (b - a) -- copyWeek computes this once
// between the source and target week starts, then applies it to every
// workout's own date via addDays.
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  const b = new Date(`${bIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

// The full set of dates for a 7-column, Monday-start month grid,
// including leading/trailing adjacent-month days -- e.g. if the 1st of
// the month is a Thursday, the grid's first row starts on the Monday of
// that same week (3 days from the prior month), and the last row ends on
// the Sunday of the week containing the month's last day. Pure, and the
// one place Month View's own date range comes from.
export function monthGridDates(monthIso: string): string[] {
  const firstOfMonth = `${monthIso}-01`;
  const gridStart = mostRecentMonday(new Date(`${firstOfMonth}T00:00:00Z`));

  const [year, month] = monthIso.split("-").map(Number);
  const nextMonthFirst = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastOfMonth = addDays(nextMonthFirst, -1);
  const lastWeekMonday = mostRecentMonday(new Date(`${lastOfMonth}T00:00:00Z`));
  const gridEnd = addDays(lastWeekMonday, 6);

  const dates: string[] = [];
  let current = gridStart;
  while (current <= gridEnd) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

// Moves a "YYYY-MM" month forward/back by deltaMonths -- the month-level
// equivalent of shiftWeek, handling year boundaries in both directions.
export function shiftMonth(monthIso: string, deltaMonths: number): string {
  const [year, month] = monthIso.split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) + deltaMonths;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

// "What day is it right now" in a given IANA timeZone -- the one place
// the calendar/schedule surfaces should answer that question, since
// `new Date().toISOString().slice(0, 10)` (seen all over this codebase
// before this function existed) resolves in UTC, which mislabels "Today"
// for anyone whose local evening has already crossed into UTC's next
// calendar day (most of the Americas, most of the day). en-CA's
// YYYY-MM-DD formatting is the standard trick for getting a sortable,
// already-zero-padded ISO date string straight out of Intl. Falls back
// to the UTC date for an invalid/unrecognized zone (the same value every
// caller already used before this fix), so a bad zone is never worse
// than the pre-fix behavior, only a missed improvement.
export function todayInTimeZone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Validates a candidate IANA zone (e.g. a cookie value a visitor's
// browser could in principle send tampered or stale) and falls back to
// UTC for anything missing or unrecognized -- UTC being the exact value
// every "today" call site already used before viewer-timezone.ts
// existed, so this fallback is never a regression. Pure on purpose (no
// `cookies()`/`next/headers` here) so it's testable without the
// "server-only" guard that src/lib/viewer-timezone.ts's own async
// wrapper carries -- that wrapper is the only thing that should ever
// call this with an actual cookie value.
export function resolveViewerTimeZone(candidate: string | undefined | null): string {
  if (!candidate) return "UTC";
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}
