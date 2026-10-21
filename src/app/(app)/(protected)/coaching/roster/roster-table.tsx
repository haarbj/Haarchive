"use client";

import { useState } from "react";
import Link from "next/link";

import { sortRosterRows, type RosterRow, type RosterSortKey } from "@/lib/private-coaching/roster-row";
import { formatWeeksAwayLabel, weeksUntilGoalRace } from "@/lib/private-coaching/goal-race";
import { formatDate, formatMiles, formatRelativeTime } from "@/lib/format";
import { mostRecentMonday, todayInTimeZone } from "@/lib/week";
import { RemoveAthleteButton } from "./remove-athlete-button";
import { ViewAsButton } from "@/components/private-coaching/view-as-button";
import { Badge } from "@/components/ui/badge";

const SORT_OPTIONS: { key: RosterSortKey; label: string }[] = [
  { key: "attention", label: "Attention" },
  { key: "name", label: "Name" },
  { key: "race", label: "Next race" },
];

// The scanning table itself -- sorts client-side over the roster this
// page already loaded in one batched pass (roster-data.ts); switching
// the sort never re-fetches anything. See roster-row.ts's own comment
// on why this reuses sortRosterRows rather than a page-local sort.
export function RosterTable({ rows, coachUserId }: { rows: RosterRow[]; coachUserId: string }) {
  const [sortKey, setSortKey] = useState<RosterSortKey>("attention");
  const sorted = sortRosterRows(rows, sortKey);

  return (
    <div>
      <div className="flex items-center gap-1 rounded-control border border-black/10 p-0.5 text-xs dark:border-white/10" role="group" aria-label="Sort roster">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setSortKey(option.key)}
            aria-pressed={sortKey === option.key}
            className={`rounded-control px-2.5 py-1 font-semibold ${
              sortKey === option.key
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {sorted.map((row) => (
          <RosterTableRow key={row.athleteId} row={row} isSelf={row.athleteId === coachUserId} />
        ))}
      </div>
    </div>
  );
}

function RosterTableRow({ row, isSelf }: { row: RosterRow; isSelf: boolean }) {
  return (
    <div className="rounded-control border border-black/10 bg-white px-4 py-3 text-sm transition hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link href={`/coaching/athletes/${row.athleteId}/schedule`} className="group flex min-w-0 items-center gap-3">
          {row.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL, same pattern as coaching/page.tsx's own coach avatar
            <img src={row.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-black/10 object-cover dark:border-white/10" />
          ) : (
            <div className="h-9 w-9 shrink-0 rounded-full bg-black/5 dark:bg-white/10" />
          )}
          <span className="min-w-0">
            <span className="block truncate font-medium text-zinc-900 group-hover:underline dark:text-white">{row.displayName}</span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {row.program.kind === "active"
                ? [row.program.programName, row.program.phaseLabel, row.program.weekLabel].filter(Boolean).join(" · ")
                : "No active program"}
            </span>
          </span>
        </Link>

        {row.attentionBadges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.attentionBadges.map((badge) => (
              <Badge key={badge.reason} tone="neutral">
                {badge.detail}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-zinc-600 sm:grid-cols-3 dark:text-zinc-300">
        <RosterStat label="This week">
          {row.thisWeek
            ? `${row.thisWeek.completedCount} of ${row.thisWeek.plannedCount} done · ${formatMilesShort(row.thisWeek.completedDistanceM)} / ${formatMilesShort(row.thisWeek.plannedDistanceM)} mi`
            : "—"}
        </RosterStat>
        <RosterStat label="Recency">
          {row.lastActivityAt ? formatRelativeTime(row.lastActivityAt) : "—"}
          {" · check-in "}
          {row.lastCheckinWeekStart ? formatDate(row.lastCheckinWeekStart) : "—"}
        </RosterStat>
        <RosterStat label="Next race">{row.nextRace ? formatNextRace(row.nextRace) : "—"}</RosterStat>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        {/* Never shown for the coach's own self-coach row -- "view as
            yourself" is meaningless, and enterViewAsAthlete itself
            refuses it too. */}
        {!isSelf ? <ViewAsButton athleteId={row.athleteId} athleteFirstName={row.displayName.split(" ")[0]} /> : null}
        <RemoveAthleteButton coachAthleteId={row.coachAthleteId} athleteName={row.displayName} />
      </div>
    </div>
  );
}

function RosterStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="text-zinc-400 dark:text-zinc-500">{label}: </span>
      <span className="font-medium text-zinc-700 dark:text-zinc-200">{children}</span>
    </p>
  );
}

// formatMiles always carries the "mi" suffix (e.g. "28.4 mi") -- this row
// combines two figures into one "completed / planned mi" phrase, so the
// unit only needs to appear once; this strips it back off formatMiles'
// own output rather than hand-rolling a second meters-to-miles formatter.
function formatMilesShort(meters: number): string {
  return formatMiles(meters).replace(" mi", "");
}

function formatNextRace(race: { raceName: string; goalDate: string }): string {
  const todayLocal = todayInTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const weekStart = mostRecentMonday(new Date(`${todayLocal}T00:00:00Z`));
  const awayLabel = formatWeeksAwayLabel(weeksUntilGoalRace(weekStart, race.goalDate));
  return `${race.raceName} · ${formatDate(race.goalDate)}${awayLabel ? ` (${awayLabel})` : ""}`;
}
