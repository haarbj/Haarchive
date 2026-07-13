"use client";

import Link from "next/link";

import { formatDate } from "@/lib/format";
import { WorkoutMetaLine } from "@/components/workout-summary-line";
import type { Workout } from "./schedule-builder";
import { Card } from "@/components/ui/card";

export type GroupDayEntries = {
  groupId: string;
  groupName: string;
  workoutsByDate: Record<string, Workout[]>;
};

// Cross-group view -- authoring still happens from within a specific
// group's own week view (this is for "what's everyone doing today," not a
// second place to write entries), but each group's block links straight
// there instead of making the coach go find the right group themselves.
// Same underlying data the per-group builder already fetches, just
// re-grouped by date first, then by group.
export function AllGroupsDayView({
  seasonId,
  dates,
  groups,
}: {
  seasonId: string;
  dates: string[];
  groups: GroupDayEntries[];
}) {
  if (dates.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing scheduled yet.</p>;
  }

  return (
    <div className="space-y-6">
      {dates.map((date) => {
        const groupsWithEntries = groups.filter((g) => (g.workoutsByDate[date] ?? []).length > 0);
        if (groupsWithEntries.length === 0) return null;
        return (
          <Card key={date} padding="md">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatDate(date)}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {groupsWithEntries.map((g) => (
                <div key={g.groupId} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                      {g.groupName}
                    </p>
                    <Link
                      href={`/coach/seasons/${seasonId}/groups/${g.groupId}?date=${date}`}
                      className="min-h-12 min-w-12 -m-2 flex items-center justify-center p-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
                    >
                      Edit
                    </Link>
                  </div>
                  <div className="mt-1.5 space-y-2">
                    {g.workoutsByDate[date].map((w) => (
                      <div key={w.id}>
                        <WorkoutMetaLine
                          workout={w}
                          includeDuration
                          className="text-xs text-zinc-500 dark:text-zinc-400"
                        />
                        <p className="text-sm text-zinc-900 dark:text-white">{w.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
