"use client";

import { useState } from "react";

import { EditGoalForm } from "./edit-goal-form";
import { formatClock, formatDate, formatDistance } from "@/lib/format";

type Goal = {
  id: string;
  race_name: string;
  distance_m: number;
  goal_time_s: number | null;
  goal_date: string | null;
};

export function GoalCard({ goal }: { goal: Goal }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EditGoalForm
        goal={goal}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Current goal
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
            {goal.race_name}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {formatDistance(goal.distance_m)}
            {goal.goal_time_s && ` · Goal: ${formatClock(goal.goal_time_s)}`}
            {goal.goal_date && ` · ${formatDate(goal.goal_date)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
