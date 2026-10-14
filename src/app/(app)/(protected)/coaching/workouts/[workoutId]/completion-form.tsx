"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { completeScheduledWorkout, deleteWorkoutCompletion } from "./completion-actions";
import { SUGGESTED_XT_TYPES } from "@/lib/private-coaching/day-type-visuals";
import { EFFORT_LEVELS, RPE_ANCHOR_TEXT } from "@/lib/private-coaching/effort-levels";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ConfirmButton } from "@/components/ui/confirm-button";

export type CompletionFormInitial = {
  actualDistanceInput: string;
  actualDurationInput: string;
  avgHeartRateInput: string;
  rpeInput: string;
  effortLevelInput: string;
  conditionsNotesInput: string;
  activityTypeInput: string;
  athleteNotesInput: string;
  painReported: boolean;
  painNotesInput: string;
};

export function CompletionForm({
  scheduledWorkoutId,
  hasExisting,
  initial,
  stravaSourced,
  // Only true when the coach scheduled a bare cross-training day with no
  // modality of their own already picked -- see isBareXt in
  // day-type-visuals.ts. A coach who did pick one doesn't need the
  // athlete to repeat it.
  promptActivityType,
}: {
  scheduledWorkoutId: string;
  hasExisting: boolean;
  initial?: CompletionFormInitial;
  stravaSourced?: boolean;
  promptActivityType?: boolean;
}) {
  const router = useRouter();
  const [actualDistanceInput, setActualDistanceInput] = useState(initial?.actualDistanceInput ?? "");
  const [actualDurationInput, setActualDurationInput] = useState(initial?.actualDurationInput ?? "");
  const [avgHeartRateInput, setAvgHeartRateInput] = useState(initial?.avgHeartRateInput ?? "");
  const [rpeInput, setRpeInput] = useState(initial?.rpeInput ?? "");
  const [effortLevelInput, setEffortLevelInput] = useState(initial?.effortLevelInput ?? "");
  const [conditionsNotesInput, setConditionsNotesInput] = useState(initial?.conditionsNotesInput ?? "");
  const [activityTypeInput, setActivityTypeInput] = useState(initial?.activityTypeInput ?? "");
  const [athleteNotesInput, setAthleteNotesInput] = useState(initial?.athleteNotesInput ?? "");
  const [painReported, setPainReported] = useState(initial?.painReported ?? false);
  const [painNotesInput, setPainNotesInput] = useState(initial?.painNotesInput ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsPending(true);
    const result = await completeScheduledWorkout({
      scheduledWorkoutId,
      actualDistanceInput,
      actualDurationInput,
      avgHeartRateInput,
      rpeInput,
      effortLevelInput,
      conditionsNotesInput,
      activityTypeInput,
      athleteNotesInput,
      painReported,
      painNotesInput,
    });
    setIsPending(false);
    if (result.error) return setError(result.error);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-control border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{hasExisting ? "Edit this workout" : "Log this workout"}</p>
        {hasExisting ? (
          <ConfirmButton
            action={() => deleteWorkoutCompletion(scheduledWorkoutId).then(() => router.refresh())}
            confirmMessage="Undo this completion? You can log it again afterward."
            label="Undo completion"
            pendingLabel="Undoing…"
            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          />
        ) : null}
      </div>
      {stravaSourced ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Distance, time, and heart rate were imported from Strava -- edit anything below if it&rsquo;s not quite right.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className={labelClass}>Distance (mi)</span>
          <input value={actualDistanceInput} onChange={(e) => setActualDistanceInput(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Duration</span>
          <input
            value={actualDurationInput}
            onChange={(e) => setActualDurationInput(e.target.value)}
            placeholder="42:15"
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Avg HR</span>
          <input value={avgHeartRateInput} onChange={(e) => setAvgHeartRateInput(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>RPE (1-10)</span>
          <input value={rpeInput} onChange={(e) => setRpeInput(e.target.value)} className={fieldClass} />
        </label>
      </div>

      {/* An unanchored 1-10 scale drifts between athletes and over time,
          and the coach is reading these across a whole roster. The anchors
          and the effort field below are what make an RPE comparable to the
          pace that produced it. */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{RPE_ANCHOR_TEXT}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Effort level (optional)</span>
          <select value={effortLevelInput} onChange={(e) => setEffortLevelInput(e.target.value)} className={fieldClass}>
            <option value="">Not sure</option>
            {EFFORT_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Conditions (optional)</span>
          <input
            value={conditionsNotesInput}
            onChange={(e) => setConditionsNotesInput(e.target.value)}
            placeholder="Heat, wind, hills, tired legs…"
            className={fieldClass}
          />
        </label>
      </div>

      {promptActivityType ? (
        <label className="block max-w-xs">
          <span className={labelClass}>What did you do?</span>
          <input
            list="completion-xt-type-suggestions"
            value={activityTypeInput}
            onChange={(e) => setActivityTypeInput(e.target.value)}
            placeholder="Pool, Bike, Elliptical…"
            className={fieldClass}
          />
          <datalist id="completion-xt-type-suggestions">
            {SUGGESTED_XT_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>
      ) : null}

      <label className="block">
        <span className={labelClass}>How did it feel?</span>
        <textarea
          value={athleteNotesInput}
          onChange={(e) => setAthleteNotesInput(e.target.value)}
          rows={2}
          className={fieldClass}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={painReported} onChange={(e) => setPainReported(e.target.checked)} />
        Something hurt during or after this
      </label>
      {painReported ? (
        <label className="block">
          <span className={labelClass}>What, and where?</span>
          <textarea value={painNotesInput} onChange={(e) => setPainNotesInput(e.target.value)} rows={2} className={fieldClass} />
        </label>
      ) : null}

      {error && <FormError>{error}</FormError>}

      <Button type="button" disabled={isPending} onClick={handleSubmit}>
        {isPending ? "Saving…" : hasExisting ? "Update" : "Mark complete"}
      </Button>
    </div>
  );
}
