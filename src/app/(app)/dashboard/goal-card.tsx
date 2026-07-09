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

export type FitnessEstimate = {
  predictedSeconds: number;
  sourceRaceName: string;
};

function formatGap(gapSeconds: number): string {
  if (gapSeconds <= 0) return "Already on pace";
  const minutes = Math.round(gapSeconds / 60);
  if (minutes === 0) return "Under a minute";
  return `≈${minutes} minute${minutes === 1 ? "" : "s"}`;
}

type GoalCardProps = {
  goal: Goal;
  estimate: FitnessEstimate | null;
};

export function GoalCard({ goal, estimate }: GoalCardProps) {
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
            Upcoming goal race
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

      {goal.goal_time_s && (
        <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
          {estimate ? (
            <>
              <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                Estimated {formatDistance(goal.distance_m)} fitness
              </p>
              <div className="mt-1 flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {formatClock(estimate.predictedSeconds)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">from {estimate.sourceRaceName}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {formatClock(goal.goal_time_s)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Goal</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {formatGap(estimate.predictedSeconds - goal.goal_time_s)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Gap</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Log a recent race result to see your estimated fitness toward this goal.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
