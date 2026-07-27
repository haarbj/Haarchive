"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";

import { formatClock, formatDate, formatDistance } from "@/lib/format";
import { RACE_DISTANCES } from "@/lib/race-distances";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { COURSE_TYPES } from "@/app/(app)/(protected)/dashboard/form-constants";
import { addRaceResult, deleteRaceResult, updateRaceResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const fieldClass = `w-full ${baseFieldClass}`;
const dateFieldClass = `${fieldClass} [&::-webkit-calendar-picker-indicator]:dark:invert`;

export type RaceResultRow = {
  id: string;
  race_name: string;
  race_date: string;
  distance_m: number;
  finish_time_s: number;
  course_type: string;
};

function secondsToInput(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function EditRaceResultForm({
  result,
  onCancel,
  onSaved,
}: {
  result: RaceResultRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateRaceResult, {});
  const today = new Date().toISOString().slice(0, 10);
  const defaultDistanceKey =
    RACE_DISTANCES.find((d) => Math.round(d.meters) === result.distance_m)?.key ?? RACE_DISTANCES[0].key;

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <Card padding="sm" shadow={false}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="raceResultId" value={result.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${baseId}-race-name`} className={labelClass}>
              Race name
            </label>
            <input
              id={`${baseId}-race-name`}
              name="raceName"
              type="text"
              defaultValue={result.race_name}
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-race-date`} className={labelClass}>
              Race date
            </label>
            <input
              id={`${baseId}-race-date`}
              name="raceDate"
              type="date"
              defaultValue={result.race_date}
              max={today}
              required
              className={dateFieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-distance`} className={labelClass}>
              Distance
            </label>
            <select
              id={`${baseId}-distance`}
              name="distanceKey"
              defaultValue={defaultDistanceKey}
              required
              className={fieldClass}
            >
              {RACE_DISTANCES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${baseId}-time`} className={labelClass}>
              Finish time
            </label>
            <input
              id={`${baseId}-time`}
              name="finishTimeInput"
              type="text"
              defaultValue={secondsToInput(result.finish_time_s)}
              placeholder="mm:ss or h:mm:ss"
              autoComplete="off"
              required
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${baseId}-course`} className={labelClass}>
              Course
            </label>
            <select id={`${baseId}-course`} name="courseType" defaultValue={result.course_type} className={fieldClass}>
              {COURSE_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state.error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isPending}>
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

function RaceResultCard({ result }: { result: RaceResultRow }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return <EditRaceResultForm result={result} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />;
  }

  return (
    <Card padding="sm" shadow={false} className="flex items-center justify-between gap-3 text-sm">
      <div>
        <span className="font-medium text-zinc-900 dark:text-white">{result.race_name}</span>{" "}
        <span className="text-zinc-600 dark:text-zinc-300">
          {formatDistance(result.distance_m)} in {formatClock(result.finish_time_s)} · {formatDate(result.race_date)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deleteRaceResult(result.id))}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          {isPending ? "Removing…" : "Remove"}
        </button>
      </div>
    </Card>
  );
}

export function RaceResultsSection({ results }: { results: RaceResultRow[] }) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(addRaceResult, {});
  const today = new Date().toISOString().slice(0, 10);
  const [showForm, setShowForm] = useState(results.length === 0);

  return (
    <div className="space-y-5">
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result) => (
            <RaceResultCard key={result.id} result={result} />
          ))}
        </div>
      )}

      {showForm ? (
        <form action={formAction} className="space-y-4 rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${baseId}-race-name`} className={labelClass}>
                Race name
              </label>
              <input id={`${baseId}-race-name`} name="raceName" type="text" required className={fieldClass} />
            </div>
            <div>
              <label htmlFor={`${baseId}-race-date`} className={labelClass}>
                Race date
              </label>
              <input id={`${baseId}-race-date`} name="raceDate" type="date" max={today} required className={dateFieldClass} />
            </div>
            <div>
              <label htmlFor={`${baseId}-distance`} className={labelClass}>
                Distance
              </label>
              <select id={`${baseId}-distance`} name="distanceKey" defaultValue="5k" required className={fieldClass}>
                {RACE_DISTANCES.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${baseId}-time`} className={labelClass}>
                Finish time
              </label>
              <input
                id={`${baseId}-time`}
                name="finishTimeInput"
                type="text"
                placeholder="mm:ss or h:mm:ss"
                autoComplete="off"
                required
                className={fieldClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${baseId}-course`} className={labelClass}>
                Course
              </label>
              <select id={`${baseId}-course`} name="courseType" defaultValue="road" className={fieldClass}>
                {COURSE_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {state.error && (
            <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding…" : "Add race result"}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-sm font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white"
        >
          + Add a race result
        </button>
      )}

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Your best time at each distance shows as a PR on your public profile -- the rest (race name, date) stays
        private to you and your dashboard.
      </p>
    </div>
  );
}
