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
