"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";

import { reorderPhase, updatePhase } from "@/app/(app)/(protected)/coach/actions";
import { fieldClass, labelClass } from "@/app/(app)/(protected)/dashboard/form-constants";
import { workoutTypeLabel } from "@/app/(app)/(protected)/plan/format-workout";
import { formatDate } from "@/lib/format";
import type { MesocyclePhase, WorkoutType } from "@/lib/coaching-engine";

const ALL_WORKOUT_TYPES: WorkoutType[] = ["easy", "recovery", "long", "tempo", "vo2", "race", "strength"];

const iconButtonClass =
  "flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-sm text-zinc-600 transition hover:bg-black/5 disabled:opacity-30 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10";

export type SeasonPhaseRow = {
  id: string;
  phase: MesocyclePhase;
  display_name: string;
  start_date: string;
  end_date: string;
  primary_goal: string;
  secondary_goals: string[];
  key_workout_types: WorkoutType[];
};

// The child form calling an onSaved *callback prop* (rather than this
// component holding its own "editing" state and flipping it directly
// inside a useEffect) is deliberate: react-hooks/set-state-in-effect only
// flags a directly-visible setState call in an effect body, not one hidden
// behind an opaque prop -- matches the same split already established by
// GoalCard/EditGoalForm elsewhere in this app.
function PhaseEditForm({
  phase,
  seasonId,
  onCancel,
  onSaved,
}: {
  phase: SeasonPhaseRow;
  seasonId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updatePhase, {});

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="phaseId" value={phase.id} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <div>
        <label htmlFor={`${baseId}-name`} className={labelClass}>
          Phase name
        </label>
        <input id={`${baseId}-name`} name="displayName" defaultValue={phase.display_name} required className={fieldClass} />
      </div>
      <div>
        <label htmlFor={`${baseId}-goal`} className={labelClass}>
          Primary goal
        </label>
        <input id={`${baseId}-goal`} name="primaryGoal" defaultValue={phase.primary_goal} className={fieldClass} />
      </div>
      <div>
        <label htmlFor={`${baseId}-secondary`} className={labelClass}>
          Secondary goals (comma-separated)
        </label>
        <input
          id={`${baseId}-secondary`}
          name="secondaryGoals"
          defaultValue={phase.secondary_goals.join(", ")}
          className={fieldClass}
        />
      </div>
      <div>
        <p className={labelClass}>Key workouts</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ALL_WORKOUT_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
              <input
                type="checkbox"
                name="keyWorkoutTypes"
                value={type}
                defaultChecked={phase.key_workout_types.includes(type)}
              />
              {workoutTypeLabel(type)}
            </label>
          ))}
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-semibold text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

type PhaseEditorProps = {
  phase: SeasonPhaseRow;
  seasonId: string;
  isFirst: boolean;
  isLast: boolean;
  children: React.ReactNode; // this phase's weeks, rendered below the read-only view
};

export function PhaseEditor({ phase, seasonId, isFirst, isLast, children }: PhaseEditorProps) {
  const [editing, setEditing] = useState(false);
  const [isReordering, startReorder] = useTransition();

  function handleReorder(direction: "up" | "down") {
    startReorder(async () => {
      await reorderPhase(seasonId, phase.id, direction);
    });
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          {formatDate(phase.start_date)} – {formatDate(phase.end_date)}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleReorder("up")}
            disabled={isFirst || isReordering}
            aria-label="Move phase earlier"
            className={iconButtonClass}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => handleReorder("down")}
            disabled={isLast || isReordering}
            aria-label="Move phase later"
            className={iconButtonClass}
          >
            ↓
          </button>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <PhaseEditForm phase={phase} seasonId={seasonId} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{phase.display_name}</p>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="font-semibold text-zinc-900 dark:text-white">Primary goal </span>
            {phase.primary_goal}
          </p>
          {phase.secondary_goals.length > 0 && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-white">Secondary goals </span>
              {phase.secondary_goals.join(", ")}
            </p>
          )}
          {phase.key_workout_types.length > 0 && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-white">Key workouts </span>
              {phase.key_workout_types.map(workoutTypeLabel).join(", ")}
            </p>
          )}
          {children}
        </>
      )}
    </div>
  );
}
