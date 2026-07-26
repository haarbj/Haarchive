"use client";

import { useId, useState } from "react";

import {
  createRepeatingWorkout,
  createWorkoutForGroups,
  generateWorkoutExplanation,
  upsertGroupPlanWorkout,
  type WorkoutInput,
} from "@/app/(app)/(protected)/coach/group-plans-actions";
import { workoutTypeLabel } from "@/app/(app)/(protected)/plan/format-workout";
import { fieldClass, labelClass } from "@/app/(app)/(protected)/dashboard/form-constants";
import { MILE_METERS } from "@/lib/race-distances";
import type { WorkoutType } from "@/lib/coaching-engine";
import type { Workout } from "./schedule-builder";

const WORKOUT_TYPES: WorkoutType[] = ["easy", "recovery", "long", "tempo", "vo2", "race", "strength"];

// Pace is entered and stored per mile, matching how a US HS coach actually
// talks about it ("7:15/mi") -- this table is a standalone structure with
// no other code reading these columns, so there's no reason to convert
// through km the way the self-serve engine's WorkoutPrescription does.
function paceToMinSecPerMile(secPerMile: number | null): string {
  if (secPerMile === null) return "";
  const min = Math.floor(secPerMile / 60);
  const sec = secPerMile % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function minSecPerMileToSecPerMile(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

type WorkoutEntryFormProps = {
  groupPlanId: string;
  seasonId: string;
  scheduledDate: string;
  seasonPhaseId: string | null;
  existing?: Workout;
  otherGroups: { id: string; name: string }[];
  repeatCandidateDates?: string[];
  onDone: () => void;
  onCancel: () => void;
};

export function WorkoutEntryForm({
  groupPlanId,
  seasonId,
  scheduledDate,
  seasonPhaseId,
  existing,
  otherGroups,
  repeatCandidateDates = [],
  onDone,
  onCancel,
}: WorkoutEntryFormProps) {
  const baseId = useId();
  const [timeOfDay, setTimeOfDay] = useState(existing?.time_of_day ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [durationMin, setDurationMin] = useState(existing?.duration_min ? String(existing.duration_min) : "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [secondaryActivity, setSecondaryActivity] = useState(existing?.secondary_activity ?? "");
  const [workoutType, setWorkoutType] = useState<WorkoutType | "">(existing?.workout_type ?? "");
  const [isRace, setIsRace] = useState(existing?.is_race ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [explanation, setExplanation] = useState(existing?.explanation ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [showDistancePace, setShowDistancePace] = useState(
    !!(existing?.distance_m || existing?.pace_fast_sec_per_mile),
  );
  const [distanceM, setDistanceM] = useState(existing?.distance_m ? (existing.distance_m / MILE_METERS).toFixed(1) : "");
  const [paceFast, setPaceFast] = useState(paceToMinSecPerMile(existing?.pace_fast_sec_per_mile ?? null));
  const [paceSlow, setPaceSlow] = useState(paceToMinSecPerMile(existing?.pace_slow_sec_per_mile ?? null));

  // Create-only: "also add to these groups" -- one submission creates an
  // independent row in each selected group, matching copyWorkoutToGroups'
  // shape but without a create-then-copy round trip. Collapsed/empty by
  // default, so the ordinary case (one group) is completely unaffected.
  const [alsoAddToGroups, setAlsoAddToGroups] = useState<Set<string>>(new Set());

  // Create-only: repeats this same entry on the same weekday for the rest
  // of the current phase, in this group only -- the actual point of
  // friction a coach hits every week otherwise. Mutually exclusive with
  // "also add to other groups" for this first version, to avoid a silent
  // (dates x groups) combination neither checkbox's copy describes.
  const [repeatWeekly, setRepeatWeekly] = useState(false);

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAlsoAddTo(groupId: string) {
    setAlsoAddToGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  async function handleGenerateExplanation() {
    setGenerateError(null);
    if (!description.trim()) return setGenerateError("Add a description first.");
    setIsGenerating(true);
    const result = await generateWorkoutExplanation(description, workoutType || null, seasonPhaseId);
    setIsGenerating(false);
    if (result.error) return setGenerateError(result.error);
    setExplanation(result.explanation ?? "");
  }

  async function handleSubmit() {
    setError(null);
    if (!description.trim()) return setError("Enter a description for this session.");

    const input: WorkoutInput = {
      id: existing?.id,
      groupPlanId,
      seasonPhaseId,
      scheduledDate,
      timeOfDay: timeOfDay.trim() || null,
      location: location.trim() || null,
      description,
      secondaryActivity: secondaryActivity.trim() || null,
      workoutType: workoutType || null,
      durationMin: durationMin.trim() ? Math.round(Number(durationMin)) : null,
      distanceM: showDistancePace && distanceM ? Math.round(Number(distanceM) * MILE_METERS) : null,
      paceFastSecPerMile: showDistancePace ? minSecPerMileToSecPerMile(paceFast) : null,
      paceSlowSecPerMile: showDistancePace ? minSecPerMileToSecPerMile(paceSlow) : null,
      isRace,
      notes: notes.trim() || null,
      explanation: explanation.trim() || null,
    };

    setIsPending(true);
    const result =
      !existing && repeatWeekly && repeatCandidateDates.length > 0
        ? await createRepeatingWorkout(input, repeatCandidateDates)
        : !existing && alsoAddToGroups.size > 0
          ? await createWorkoutForGroups(input, seasonId, Array.from(alsoAddToGroups))
          : await upsertGroupPlanWorkout(input);
    setIsPending(false);
    if (result.error) return setError(result.error);
    onDone();
  }

  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor={`${baseId}-time`} className={labelClass}>
            Time of practice
          </label>
          <input
            id={`${baseId}-time`}
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
            placeholder="e.g. 6:00am (blank if OYO)"
            className={`${fieldClass} w-40`}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-duration`} className={labelClass}>
            Duration (min)
          </label>
          <input
            id={`${baseId}-duration`}
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 45"
            className={`${fieldClass} w-24`}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-location`} className={labelClass}>
            Location
          </label>
          <input
            id={`${baseId}-location`}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Loyola Basement, OYO"
            className={`${fieldClass} w-56`}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-type`} className={labelClass}>
            Type
          </label>
          <select
            id={`${baseId}-type`}
            value={workoutType}
            onChange={(e) => setWorkoutType(e.target.value as WorkoutType | "")}
            className={`${fieldClass} w-40`}
          >
            <option value="">(unclassified)</option>
            {WORKOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {workoutTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`${baseId}-description`} className={labelClass}>
          Description
        </label>
        <input
          id={`${baseId}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Quality WU + Tempo Tune-up + Long Strides + CD"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${baseId}-secondary`} className={labelClass}>
          Secondary activity
        </label>
        <input
          id={`${baseId}-secondary`}
          value={secondaryActivity}
          onChange={(e) => setSecondaryActivity(e.target.value)}
          placeholder="e.g. Core exercises, Self-care"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${baseId}-notes`} className={labelClass}>
          Notes
        </label>
        <input
          id={`${baseId}-notes`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Bring spikes"
          className={fieldClass}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={`${baseId}-explanation`} className={labelClass}>
            Point of the day
          </label>
          <button
            type="button"
            onClick={handleGenerateExplanation}
            disabled={isGenerating}
            className="text-xs font-semibold text-zinc-700 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-60 dark:text-zinc-200 dark:decoration-white/20 dark:hover:decoration-white"
          >
            {isGenerating ? "Generating…" : "Generate"}
          </button>
        </div>
        <textarea
          id={`${baseId}-explanation`}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={3}
          placeholder="Why this session, what to expect -- generate a starting point, then edit or clear it. Shown to athletes as-is if you keep it."
          className={fieldClass}
        />
        {generateError && <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">{generateError}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        <input type="checkbox" checked={isRace} onChange={(e) => setIsRace(e.target.checked)} />
        This is a race
      </label>

      {!existing && repeatCandidateDates.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input type="checkbox" checked={repeatWeekly} onChange={(e) => setRepeatWeekly(e.target.checked)} />
          Repeat this session weekly for the rest of this phase ({repeatCandidateDates.length} more week
          {repeatCandidateDates.length === 1 ? "" : "s"}, this group only)
        </label>
      )}

      {!showDistancePace ? (
        <button
          type="button"
          onClick={() => setShowDistancePace(true)}
          className="text-sm font-semibold text-zinc-700 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Add a distance or pace for this session?
        </button>
      ) : (
        <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
          <div className="flex items-center justify-between">
            <p className={labelClass}>Distance / pace (optional -- shown to athletes only if set)</p>
            <button
              type="button"
              onClick={() => {
                setShowDistancePace(false);
                setDistanceM("");
                setPaceFast("");
                setPaceSlow("");
              }}
              className="text-xs text-zinc-500 dark:text-zinc-400"
            >
              Remove
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <div>
              <label htmlFor={`${baseId}-distance`} className={labelClass}>
                Distance (mi)
              </label>
              <input
                id={`${baseId}-distance`}
                value={distanceM}
                onChange={(e) => setDistanceM(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 6"
                className={`${fieldClass} w-24`}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-pace-fast`} className={labelClass}>
                Pace fast (min:sec/mi)
              </label>
              <input
                id={`${baseId}-pace-fast`}
                value={paceFast}
                onChange={(e) => setPaceFast(e.target.value)}
                placeholder="7:15"
                className={`${fieldClass} w-28`}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-pace-slow`} className={labelClass}>
                Pace slow (min:sec/mi)
              </label>
              <input
                id={`${baseId}-pace-slow`}
                value={paceSlow}
                onChange={(e) => setPaceSlow(e.target.value)}
                placeholder="7:45"
                className={`${fieldClass} w-28`}
              />
            </div>
          </div>
        </div>
      )}

      {!existing && !repeatWeekly && otherGroups.length > 0 && (
        <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
          <p className={labelClass}>Also add to other groups</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Separate by default -- check a group to give it this same session as its own entry (like an
            &ldquo;All&rdquo; row), editable independently afterward.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {otherGroups.map((g) => (
              <label key={g.id} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={alsoAddToGroups.has(g.id)}
                  onChange={() => toggleAlsoAddTo(g.id)}
                />
                {g.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
