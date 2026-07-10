"use client";

import { useActionState, useEffect, useId, useState } from "react";

import { updateWeek } from "@/app/(app)/(protected)/coach/actions";
import { fieldClass, labelClass } from "@/app/(app)/(protected)/dashboard/form-constants";
import { workoutTypeLabel } from "@/app/(app)/(protected)/plan/format-workout";
import type { WorkoutType } from "@/lib/coaching-engine";

const ALL_WORKOUT_TYPES: WorkoutType[] = ["easy", "recovery", "long", "tempo", "vo2", "race", "strength"];

export type SeasonWeekRow = {
  id: string;
  week_index: number;
  theme: string;
  mileage_level: "low" | "moderate" | "high";
  workout_slots: { label: string; workoutType: WorkoutType }[];
};

// Same reasoning as PhaseEditForm/PhaseEditor: onSaved is a callback prop,
// not a directly-visible setState call, so the parent's effect-driven close
// doesn't trip react-hooks/set-state-in-effect.
function WeekEditForm({
  week,
  seasonId,
  onCancel,
  onSaved,
}: {
  week: SeasonWeekRow;
  seasonId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateWeek, {});

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-black/[0.03] p-3 text-sm dark:bg-white/[0.05]">
      <input type="hidden" name="weekId" value={week.id} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <p className="font-medium text-zinc-900 dark:text-white">Week {week.week_index + 1}</p>

      <div>
        <label htmlFor={`${baseId}-theme`} className={labelClass}>
          Focus
        </label>
        <input id={`${baseId}-theme`} name="theme" defaultValue={week.theme} required className={fieldClass} />
      </div>

      <div>
        <label htmlFor={`${baseId}-mileage`} className={labelClass}>
          Mileage
        </label>
        <select id={`${baseId}-mileage`} name="mileageLevel" defaultValue={week.mileage_level} className={fieldClass}>
          <option value="low">Low</option>
          <option value="moderate">Moderate</option>
          <option value="high">High</option>
        </select>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>Workouts</p>
        {week.workout_slots.map((slot, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              type="text"
              name={`slot-label-${i}`}
              defaultValue={slot.label}
              aria-label={`Slot ${i + 1} label`}
              className={`${fieldClass} w-32`}
            />
            <select
              name={`slot-type-${i}`}
              defaultValue={slot.workoutType}
              aria-label={`Slot ${i + 1} workout type`}
              className={fieldClass}
            >
              {ALL_WORKOUT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {workoutTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-300 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

type WeekEditorProps = {
  week: SeasonWeekRow;
  seasonId: string;
};

export function WeekEditor({ week, seasonId }: WeekEditorProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <WeekEditForm week={week} seasonId={seasonId} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
    );
  }

  return (
    <div className="rounded-xl bg-black/[0.03] p-3 text-sm dark:bg-white/[0.05]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-zinc-900 dark:text-white">Week {week.week_index + 1}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {week.mileage_level} mileage
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            Edit
          </button>
        </div>
      </div>
      <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">{week.theme}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {week.workout_slots.map((slot) => `${slot.label}: ${workoutTypeLabel(slot.workoutType)}`).join(" · ")}
      </p>
    </div>
  );
}
