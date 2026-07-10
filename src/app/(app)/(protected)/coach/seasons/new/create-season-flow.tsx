"use client";

import { useId, useState } from "react";

import {
  createSeason,
  previewSeasonBlueprint,
  type CreateSeasonInput,
  type SeasonRaceInput,
} from "@/app/(app)/(protected)/coach/actions";
import { dateFieldClass, fieldClass, labelClass, GOAL_DISTANCES } from "@/app/(app)/(protected)/dashboard/form-constants";
import { addDays, diffDays, type SeasonPhaseDraft } from "@/lib/coaching-engine";
import { formatDate } from "@/lib/format";

type Step = "setup" | "preview";

const DOWN_WEEK_INTERVAL_OPTIONS = [3, 4, 5, 6];

export function CreateSeasonFlow() {
  const baseId = useId();
  const [step, setStep] = useState<Step>("setup");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup fields, carried into the preview step and finally into createSeason.
  const [name, setName] = useState("");
  const [seasonStartDate, setSeasonStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [goalRaceName, setGoalRaceName] = useState("");
  const [goalRaceDate, setGoalRaceDate] = useState("");
  const [goalDistanceM, setGoalDistanceM] = useState(5000);
  const [downWeeksEnabled, setDownWeeksEnabled] = useState(true);
  const [downWeeksInterval, setDownWeeksInterval] = useState(4);
  const [scheduleText, setScheduleText] = useState("");

  // Preview state -- populated once previewSeasonBlueprint returns, then
  // freely edited client-side before createSeason ever gets called.
  const [phases, setPhases] = useState<SeasonPhaseDraft[]>([]);
  const [races, setRaces] = useState<SeasonRaceInput[]>([]);
  const [raceWarnings, setRaceWarnings] = useState<string[]>([]);

  async function handlePreview() {
    setError(null);
    if (!name.trim()) return setError("Enter a season name.");
    setIsPending(true);
    const result = await previewSeasonBlueprint({
      seasonStartDate,
      goalRaceName,
      goalRaceDate,
      goalDistanceM,
      downWeeksEnabled,
      downWeeksIntervalWeeks: downWeeksInterval,
      scheduleText,
    });
    setIsPending(false);
    if (!result.ok) return setError(result.error);

    setPhases(result.phases);

    const goalRaceAlreadyInList = result.parsedRaces.some((r) => r.date === goalRaceDate);
    const raceRows: SeasonRaceInput[] = result.parsedRaces.map((r) => ({ ...r, isGoalRace: r.date === goalRaceDate }));
    if (!goalRaceAlreadyInList) {
      raceRows.push({ name: goalRaceName, date: goalRaceDate, isGoalRace: true });
    }
    raceRows.sort((a, b) => a.date.localeCompare(b.date));
    setRaces(raceRows);
    setRaceWarnings(result.raceWarnings);
    setStep("preview");
  }

  function updatePhaseEndDate(index: number, newEndDate: string) {
    setPhases((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], endDate: newEndDate };
      // Cascade: each subsequent phase keeps its own original duration,
      // just shifted to start right after the one before it now ends.
      for (let i = index + 1; i < next.length; i++) {
        const duration = diffDays(next[i].startDate, next[i].endDate);
        const newStart = addDays(next[i - 1].endDate, 1);
        next[i] = { ...next[i], startDate: newStart, endDate: addDays(newStart, duration) };
      }
      return next;
    });
  }

  function updatePhaseField(index: number, field: "displayName" | "primaryGoal", value: string) {
    setPhases((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function updateRaceField(index: number, field: "name" | "date", value: string) {
    setRaces((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function removeRace(index: number) {
    setRaces((prev) => prev.filter((_, i) => i !== index));
  }

  function addBlankRace() {
    setRaces((prev) => [...prev, { name: "", date: goalRaceDate, isGoalRace: false }]);
  }

  async function handleCreate() {
    setError(null);
    const cleanedRaces = races.filter((r) => r.name.trim() && r.date);
    const input: CreateSeasonInput = { name, goalRaceName, goalRaceDate, goalDistanceM, phases, races: cleanedRaces };
    setIsPending(true);
    const result = await createSeason(input);
    setIsPending(false);
    if (result?.error) setError(result.error);
    // On success createSeason redirects server-side; nothing else to do here.
  }

  const lastPhaseEndDate = phases.at(-1)?.endDate;
  const endDateDriftsFromGoal = lastPhaseEndDate && lastPhaseEndDate !== goalRaceDate;

  if (step === "setup") {
    return (
      <div className="space-y-5 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div>
          <label htmlFor={`${baseId}-name`} className={labelClass}>
            Season name
          </label>
          <input
            id={`${baseId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            placeholder="e.g. Fall 2026 XC"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-start-date`} className={labelClass}>
            Season starts
          </label>
          <input
            id={`${baseId}-start-date`}
            value={seasonStartDate}
            onChange={(e) => setSeasonStartDate(e.target.value)}
            type="date"
            className={dateFieldClass}
          />
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            When training actually begins -- not necessarily today.
          </p>
        </div>

        <div>
          <label htmlFor={`${baseId}-race-name`} className={labelClass}>
            Goal race
          </label>
          <input
            id={`${baseId}-race-name`}
            value={goalRaceName}
            onChange={(e) => setGoalRaceName(e.target.value)}
            type="text"
            placeholder="e.g. State Meet"
            className={fieldClass}
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <label htmlFor={`${baseId}-race-date`} className={labelClass}>
              Goal race date
            </label>
            <input
              id={`${baseId}-race-date`}
              value={goalRaceDate}
              onChange={(e) => setGoalRaceDate(e.target.value)}
              type="date"
              className={dateFieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-distance`} className={labelClass}>
              Distance
            </label>
            <select
              id={`${baseId}-distance`}
              value={goalDistanceM}
              onChange={(e) => setGoalDistanceM(Number(e.target.value))}
              className={fieldClass}
            >
              {GOAL_DISTANCES.map((d) => (
                <option key={d.meters} value={d.meters}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={`${baseId}-schedule`} className={labelClass}>
            Race schedule (optional)
          </label>
          <textarea
            id={`${baseId}-schedule`}
            value={scheduleText}
            onChange={(e) => setScheduleText(e.target.value)}
            rows={6}
            placeholder={"Paste the season's schedule, one race per line -- e.g.\nMarch 7 - Aztec Invitational\nMarch 14 - Devon Allen AMDG Invitational"}
            className={`${fieldClass} font-mono text-xs`}
          />
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Copy this straight off your athletic.net team schedule. We&rsquo;ll do our best to read it --
            you&rsquo;ll review and can fix anything on the next screen.
          </p>
        </div>

        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white">
            <input type="checkbox" checked={downWeeksEnabled} onChange={(e) => setDownWeeksEnabled(e.target.checked)} />
            Include down/cutback weeks
          </label>
          {downWeeksEnabled && (
            <div className="mt-3">
              <label htmlFor={`${baseId}-down-interval`} className={labelClass}>
                Every how many weeks?
              </label>
              <select
                id={`${baseId}-down-interval`}
                value={downWeeksInterval}
                onChange={(e) => setDownWeeksInterval(Number(e.target.value))}
                className={`${fieldClass} max-w-40`}
              >
                {DOWN_WEEK_INTERVAL_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} weeks
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handlePreview}
          disabled={isPending}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Building preview…" : "Preview season"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Phases</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          This is what will actually be created. Adjust an end date if it doesn&rsquo;t look right --
          later phases shift automatically to stay contiguous.
        </p>
        <div className="mt-4 space-y-3">
          {phases.map((phase, i) => (
            <div key={i} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={phase.displayName}
                  onChange={(e) => updatePhaseField(i, "displayName", e.target.value)}
                  className={`${fieldClass} w-auto flex-1 min-w-40 font-medium`}
                />
                <span className="text-xs text-zinc-500 capitalize dark:text-zinc-400">({phase.phase})</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <span>{formatDate(phase.startDate)}</span>
                <span>–</span>
                <input
                  type="date"
                  value={phase.endDate}
                  onChange={(e) => updatePhaseEndDate(i, e.target.value)}
                  className={`${dateFieldClass} w-auto py-1`}
                />
              </div>
              <input
                value={phase.primaryGoal}
                onChange={(e) => updatePhaseField(i, "primaryGoal", e.target.value)}
                className={`${fieldClass} mt-2 text-xs`}
                placeholder="Primary goal for this phase"
              />
            </div>
          ))}
        </div>
        {endDateDriftsFromGoal && (
          <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">
            Heads up: the last phase now ends {formatDate(lastPhaseEndDate!)}, not your goal race date of{" "}
            {formatDate(goalRaceDate)}. Adjust a phase above if that&rsquo;s not intentional.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Race schedule</p>
        {raceWarnings.length > 0 && (
          <div className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <p className="font-semibold">Couldn&rsquo;t read {raceWarnings.length} line(s) from the pasted schedule:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {raceWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {races.map((race, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={race.date}
                disabled={race.isGoalRace}
                onChange={(e) => updateRaceField(i, "date", e.target.value)}
                className={`${dateFieldClass} w-auto disabled:opacity-60`}
              />
              <input
                value={race.name}
                disabled={race.isGoalRace}
                onChange={(e) => updateRaceField(i, "name", e.target.value)}
                className={`${fieldClass} flex-1 min-w-40 disabled:opacity-60`}
                placeholder="Race name"
              />
              {race.isGoalRace ? (
                <span className="shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
                  Goal race
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => removeRace(i)}
                  className="shrink-0 text-xs font-semibold text-red-700 dark:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addBlankRace}
          className="mt-3 text-sm font-semibold text-zinc-700 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/20 dark:hover:decoration-white"
        >
          + Add a race
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setStep("setup")}
          className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Creating…" : "Create season"}
        </button>
      </div>
    </div>
  );
}
