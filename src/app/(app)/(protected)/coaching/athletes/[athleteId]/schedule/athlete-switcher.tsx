"use client";

import { useRouter } from "next/navigation";

import { fieldClass } from "@/lib/form-styles";

export type RosterOption = { athleteId: string; displayName: string };

// A coach with more than one athlete needs to jump between their calendars
// without going back through /coaching/roster each time -- preserves the
// current view and its date/week/month (whichever the active view uses)
// so switching athletes doesn't also reset which view or date you're
// looking at.
export function AthleteSwitcher({
  currentAthleteId,
  queryString,
  roster,
}: {
  currentAthleteId: string;
  queryString: string;
  roster: RosterOption[];
}) {
  const router = useRouter();

  if (roster.length <= 1) return null;

  return (
    <select
      value={currentAthleteId}
      onChange={(e) => router.push(`/coaching/athletes/${e.target.value}/schedule?${queryString}`)}
      className={`${fieldClass} max-w-xs`}
      aria-label="Switch athlete"
    >
      {roster.map((r) => (
        <option key={r.athleteId} value={r.athleteId}>
          {r.displayName}
        </option>
      ))}
    </select>
  );
}
