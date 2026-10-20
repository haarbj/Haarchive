"use client";

import { useActionState, useId, useTransition } from "react";

import { completeWorkout, deleteWorkoutCompletion } from "@/app/(app)/(protected)/plan/actions";
import { fieldClass, labelClass } from "@/app/(app)/(protected)/dashboard/form-constants";
import {
  coreDistanceOf,
  estimatedDurationRangeMin,
  workoutPrescriptionSchema,
  type DistanceBucket,
  type MesocyclePhase,
  type WorkoutType,
} from "@/lib/coaching-engine";
import { formatDate } from "@/lib/format";
import { compareCompletionToPlan, formatDistanceDelta, formatDurationDelta } from "@/lib/private-coaching/completion-comparison";
import { AdaptWorkoutPanel } from "./adapt-workout-panel";
import { CompletionSummary, type CompletionDetail } from "./completion-detail";
import { ExplainWorkoutButton } from "./explain-workout-button";
import { describePrescription, workoutTypeLabel } from "./format-workout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// Mirrors UndoGroupCompletionButton (group-workout-complete-form.tsx)
// exactly, for an individually-generated plan's workout instead of a
// coach-authored group one.
function UndoWorkoutCompletionButton({ workoutId }: { workoutId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await deleteWorkoutCompletion(workoutId);
        })
      }
      className="-ml-2 inline-flex min-h-12 items-center rounded-lg px-2 text-xs font-semibold text-zinc-500 underline decoration-black/10 underline-offset-2 hover:decoration-black disabled:opacity-60 dark:text-zinc-400 dark:decoration-white/10 dark:hover:decoration-white"
    >
      {isPending ? "Saving…" : "Undo"}
    </button>
  );
}

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
  /** Today's date (viewer-local, YYYY-MM-DD) -- optional only for an existing call site that hasn't threaded it through yet; a workout never shows the Missed treatment without it, same as if it were still Scheduled. */
  today?: string;
};

export function WorkoutCard({ workout, phase, distanceBucket, completion, today }: WorkoutCardProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(completeWorkout, {});

  const parsed = workoutPrescriptionSchema.safeParse(workout.prescription);
  const durationRange = parsed.success ? estimatedDurationRangeMin(parsed.data) : null;
  const isMissed = !completion && today != null && workout.scheduled_date < today;

  // Planned-vs-completed (completion-comparison.ts), same rule every
  // other tile surface follows: on-plan keeps CompletionSummary's own
  // single actual-only line (planned shown on hover via the wrapping
  // title below); off-plan adds the delta line ahead of it.
  const comparison = completion
    ? compareCompletionToPlan({
        plannedDistanceM: parsed.success ? coreDistanceOf(parsed.data) : null,
        plannedDistanceMaxM: null,
        plannedDurationS: durationRange ? durationRange[0] * 60 : null,
        plannedDurationMaxS: durationRange ? durationRange[1] * 60 : null,
        actualDistanceM: completion.actual_distance_m,
        actualDurationS: completion.actual_time_s,
      })
    : null;
  const plannedHoverTitle =
    comparison?.onPlan
      ? `Planned: ${[parsed.success ? describePrescription(parsed.data) : null, durationRange ? `${durationRange[0]}–${durationRange[1]} min` : null]
          .filter(Boolean)
          .join(" · ")}`
      : undefined;

  return (
    <Card padding="sm" className={isMissed ? "opacity-60" : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {formatDate(workout.scheduled_date)} · {workoutTypeLabel(workout.workout_type)}
            {durationRange && ` · ${durationRange[0]}–${durationRange[1]} min`}
          </p>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">
            {parsed.success ? describePrescription(parsed.data) : "Details unavailable"}
          </p>
          {/* Off-plan: the delta, ahead of CompletionSummary's own fuller
              detail (pace/HR/RPE/notes), so the gap from plan is the first
              thing read. On-plan: CompletionSummary's single actual-only
              line is already the "one clean line" this state calls for --
              planned stays available on hover via the wrapping title. */}
          {completion && comparison && !comparison.onPlan && (comparison.distanceDelta || comparison.durationDelta) ? (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {[
                comparison.distanceDelta ? formatDistanceDelta(comparison.distanceDelta, "full") : null,
                comparison.durationDelta ? formatDurationDelta(comparison.durationDelta) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {completion && (
            <div title={plannedHoverTitle}>
              <CompletionSummary completion={completion} />
            </div>
          )}
          {isMissed && !completion ? <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Not logged</p> : null}
        </div>
        {completion && (
          <Badge tone="success" className="shrink-0">
            Completed
          </Badge>
        )}
        {isMissed && !completion && (
          <Badge tone="neutral" className="shrink-0">
            Missed
          </Badge>
        )}
      </div>
      {completion && (
        <div className="mt-2">
          <UndoWorkoutCompletionButton workoutId={workout.id} />
        </div>
      )}

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
        <FormError className="mt-2">{state.error}</FormError>
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
