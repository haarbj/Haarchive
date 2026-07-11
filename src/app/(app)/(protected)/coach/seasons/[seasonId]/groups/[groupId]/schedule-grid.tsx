"use client";

import { useState } from "react";

import { addDays } from "@/lib/coaching-engine";
import { formatDate } from "@/lib/format";
import { WorkoutLengthLine, WorkoutMetaLine } from "@/components/workout-summary-line";
import type { GroupDayEntries } from "./all-groups-day-view";
import type { WeekRange, Workout } from "./schedule-builder";

// Rows = groups, columns = one week's days -- the actual mental model a
// coach uses ("what's everyone doing this week"), as a fast bulk-entry
// surface alongside (not replacing) the per-group week list and full
// WorkoutEntryForm, which stay the place for anything beyond a
// description. Real <table> markup for free screen-reader table semantics,
// wrapped in its own horizontal scroll container so a season with several
// groups doesn't force the whole page to scroll sideways on a phone.
function GridCell({ entries }: { entries: Workout[] }) {
  if (entries.length === 0) {
    return <p className="px-1 py-1 text-xs text-zinc-400 dark:text-zinc-600">—</p>;
  }
  return (
    <div className="space-y-2">
      {entries.map((w) => (
        <div key={w.id} className="rounded-lg bg-black/[0.02] p-2 dark:bg-white/[0.03]">
          <div className="flex items-start justify-between gap-1">
            <WorkoutMetaLine
              workout={w}
              includeDuration
              className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
            />
            {!w.published_at && (
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500"
                title="Not published"
              />
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-900 dark:text-white">{w.description}</p>
          <WorkoutLengthLine workout={w} />
        </div>
      ))}
    </div>
  );
}

export function ScheduleGrid({
  weekRanges,
  allGroupsDayData,
}: {
  weekRanges: WeekRange[];
  allGroupsDayData: { dates: string[]; groups: GroupDayEntries[] };
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultIndex = Math.max(
    0,
    weekRanges.findIndex((w) => todayStr >= w.startDate && todayStr <= w.endDate),
  );
  const [weekIndex, setWeekIndex] = useState(defaultIndex);
  const week = weekRanges[weekIndex];

  if (!week) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-300">No weeks set up for this season yet.</p>;
  }

  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(week.startDate, i));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={weekIndex === 0}
          onClick={() => setWeekIndex((i) => i - 1)}
          className="min-h-12 rounded-full border border-black/10 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          ◀ Previous week
        </button>
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Week {week.weekIndex + 1} · {formatDate(week.startDate)} – {formatDate(week.endDate)}
        </p>
        <button
          type="button"
          disabled={weekIndex === weekRanges.length - 1}
          onClick={() => setWeekIndex((i) => i + 1)}
          className="min-h-12 rounded-full border border-black/10 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          Next week ▶
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th scope="col" className="p-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Group
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="p-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
                >
                  {formatDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allGroupsDayData.groups.map((g) => (
              <tr key={g.groupId} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                <th scope="row" className="p-3 align-top text-sm font-semibold text-zinc-900 dark:text-white">
                  {g.groupName}
                </th>
                {days.map((d) => (
                  <td key={d} className="min-w-[160px] max-w-[220px] p-2 align-top">
                    <GridCell entries={g.workoutsByDate[d] ?? []} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
