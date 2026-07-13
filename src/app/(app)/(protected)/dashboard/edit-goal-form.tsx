"use client";

import { useActionState, useEffect, useId } from "react";

import { updateGoal } from "./actions";
import { GOAL_DISTANCES, dateFieldClass, fieldClass, labelClass } from "./form-constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Goal = {
  id: string;
  race_name: string;
  distance_m: number;
  goal_time_s: number | null;
  goal_date: string | null;
};

type EditGoalFormProps = {
  goal: Goal;
  onCancel: () => void;
  onSaved: () => void;
};

function secondsToInput(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function EditGoalForm({ goal, onCancel, onSaved }: EditGoalFormProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateGoal, {});
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <Card padding="md">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Edit goal</h2>

      <form action={formAction} className="mt-4 space-y-5">
        <input type="hidden" name="goalId" value={goal.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${baseId}-race-name`} className={labelClass}>
              Goal race
            </label>
            <input
              id={`${baseId}-race-name`}
              name="goalRaceName"
              type="text"
              defaultValue={goal.race_name}
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-distance`} className={labelClass}>
              Distance
            </label>
            <select
              id={`${baseId}-distance`}
              name="goalDistanceM"
              defaultValue={goal.distance_m}
              required
              className={fieldClass}
            >
              {GOAL_DISTANCES.map((d) => (
                <option key={d.label} value={d.meters}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${baseId}-time`} className={labelClass}>
              Goal time (optional)
            </label>
            <input
              id={`${baseId}-time`}
              name="goalTimeInput"
              type="text"
              defaultValue={secondsToInput(goal.goal_time_s)}
              placeholder="mm:ss or h:mm:ss"
              autoComplete="off"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-date`} className={labelClass}>
              Race date (optional)
            </label>
            <input
              id={`${baseId}-date`}
              name="goalDate"
              type="date"
              defaultValue={goal.goal_date ?? ""}
              min={today}
              className={dateFieldClass}
            />
          </div>
        </div>

        {state.error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
