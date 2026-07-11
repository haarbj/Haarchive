"use client";

import { useState } from "react";

import { AllGroupsDayView, type GroupDayEntries } from "./all-groups-day-view";
import { ScheduleBuilder, type WeekRange, type Workout } from "./schedule-builder";

type View = "group" | "day";

export function ViewToggle({
  seasonId,
  groupPlanId,
  currentGroupId,
  weekRanges,
  workouts,
  otherGroups,
  allGroupsDayData,
}: {
  seasonId: string;
  groupPlanId: string;
  currentGroupId: string;
  weekRanges: WeekRange[];
  workouts: Workout[];
  otherGroups: { id: string; name: string }[];
  allGroupsDayData: { dates: string[]; groups: GroupDayEntries[] };
}) {
  const otherGroupsData = allGroupsDayData.groups.filter((g) => g.groupId !== currentGroupId);
  const [view, setView] = useState<View>("group");

  return (
    <div>
      <div className="mb-6 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setView("group")}
          className={`rounded-full px-4 py-1.5 font-semibold transition ${
            view === "group"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border border-black/10 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
          }`}
        >
          This group
        </button>
        <button
          type="button"
          onClick={() => setView("day")}
          className={`rounded-full px-4 py-1.5 font-semibold transition ${
            view === "day"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border border-black/10 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
          }`}
        >
          All groups, by day
        </button>
      </div>

      {view === "group" ? (
        <ScheduleBuilder
          seasonId={seasonId}
          groupPlanId={groupPlanId}
          weekRanges={weekRanges}
          workouts={workouts}
          otherGroups={otherGroups}
          otherGroupsData={otherGroupsData}
        />
      ) : (
        <AllGroupsDayView seasonId={seasonId} dates={allGroupsDayData.dates} groups={allGroupsDayData.groups} />
      )}
    </div>
  );
}
