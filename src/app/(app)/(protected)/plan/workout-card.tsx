"use client";

import { useActionState, useId } from "react";

import { completeWorkout } from "@/app/(app)/(protected)/plan/actions";
import { fieldClass, labelClass } from "@/app/(app)/(protected)/dashboard/form-constants";
import {
  estimatedDurationRangeMin,
  workoutPrescriptionSchema,
  type DistanceBucket,
  type MesocyclePhase,
  type WorkoutType,
} from "@/lib/coaching-engine";
import { formatDate } from "@/lib/format";
import { AdaptWorkoutPanel } from "./adapt-workout-panel";
import { CompletionSummary, type CompletionDetail } from "./completion-detail";
import { ExplainWorkoutButton } from "./explain-workout-button";
import { describePrescription, workoutTypeLabel } from "./format-workout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type WorkoutCardProps = {
  workout: {
    id: string;
    scheduled_date: string;
    workout_type: WorkoutType;
    prescription: unknown;
    adapted_at: string | null;
    adaptation_reason: string | null;
    adaptation_explanation: string | null;
  };
  phase: MesocyclePhase | null;
  distanceBucket: DistanceBucket;
  completion: CompletionDetail | null;
};

export function WorkoutCard({ workout, phase, distanceBucket, completion }: WorkoutCardProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(completeWorkout, {});

  const parsed = workoutPrescriptionSchema.safeParse(workout.prescription);
  const durationRange = parsed.success ? estimatedDurationRangeMin(parsed.data) : null;

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {formatDate(workout.scheduled_date)} · {workoutTypeLabel(workout.workout_type)}
            {durationRange && ` · ${durationRange[0]}–${durationRange[1]} min`}
          </p>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">
            {parsed.success ? describePrescription(parsed.data) : "Details unavailable"}
          </p>
          {completion && <CompletionSummary completion={completion} />}
        </div>
        {completion && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            Completed
          </span>
        )}
      </div>

      {!completion && (
        <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="workoutId" value={workout.id} />
          <div>
            <label htmlFor={`${baseId}-distance`} className={labelClass}>
              Distance (mi)
            </label>
            <input
              id={`${baseId}-distance`}
              name="actualDistanceInput"
              type="text"
              inputMode="decimal"
              placeholder="optional"
              className={`${fieldClass} w-28`}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-time`} className={labelClass}>
              Time
            </label>
            <input
              id={`${baseId}-time`}
              name="actualTimeInput"
              type="text"
              placeholder="mm:ss"
              autoComplete="off"
              className={`${fieldClass} w-28`}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-hr`} className={labelClass}>
              Avg HR
            </label>
            <input
              id={`${baseId}-hr`}
              name="avgHeartRateInput"
              type="text"
              inputMode="numeric"
              placeholder="optional"
              className={`${fieldClass} w-24`}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-rpe`} className={labelClass}>
              RPE
            </label>
            <select id={`${baseId}-rpe`} name="rpeInput" defaultValue="" className={`${fieldClass} w-20`}>
              <option value="">—</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full">
            <label htmlFor={`${baseId}-notes`} className={labelClass}>
              Notes
            </label>
            <input
              id={`${baseId}-notes`}
              name="notesInput"
              type="text"
              placeholder="How did it feel? Anything worth remembering?"
              className={fieldClass}
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Mark complete"}
          </Button>
        </form>
      )}
      {state.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.feedback && (
        <p className="mt-2 rounded-lg bg-black/[0.03] p-3 text-sm text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-200">
          {state.feedback}
        </p>
      )}

      <ExplainWorkoutButton
        workoutId={workout.id}
        phase={phase}
        workoutKind={parsed.success ? parsed.data.kind : null}
        distanceBucket={distanceBucket}
      />

      {parsed.success && (
        <AdaptWorkoutPanel
          workoutId={workout.id}
          currentPrescription={parsed.data}
          adaptedAt={workout.adapted_at}
          adaptationReason={workout.adaptation_reason}
          adaptationExplanation={workout.adaptation_explanation}
        />
      )}
    </Card>
  );
}
