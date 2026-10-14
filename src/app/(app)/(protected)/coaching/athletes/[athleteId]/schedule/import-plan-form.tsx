"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { importTrainingPlanTrack, type ImportPlanResult } from "./import-plan-actions";
import { TRAINING_PLANS, trainingPlanMap } from "@/lib/training-plans/data";
import type { TrackKey, DurationWeeks } from "@/lib/training-plans/types";
import type { AthleteMostRecentRace } from "@/lib/private-coaching/pace-reference";
import { RACE_DISTANCES, raceDistanceMap } from "@/lib/race-distances";
import { parseTimeToSeconds } from "@/lib/running-format";
import { mostRecentMonday, addDays } from "@/lib/week";
import { formatDate } from "@/lib/format";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// The closest RACE_DISTANCES entry to a given meters figure -- used to
// seed the distance dropdown from an existing race_results row (stored as
// raw meters, not a distance key), same reasoning as the settings race-
// results form's own identical closest-match lookup.
function closestDistanceKey(meters: number): string {
  return RACE_DISTANCES.reduce((closest, d) => (Math.abs(d.meters - meters) < Math.abs(closest.meters - meters) ? d : closest)).key;
}

// h:mm:ss when there's a real hour component (a marathon finish time),
// m:ss otherwise -- formatClock is mm:ss-only and would silently overflow
// past 59 minutes, so this mirrors settings/race-results-section.tsx's own
// identical secondsToInput helper (not exported anywhere shared) rather
// than reusing the wrong formatter for a value that can exceed an hour.
function secondsToTimeInput(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Derived from TRAINING_PLANS itself (not a separately hand-maintained
// list) so this can never drift out of sync with the tracks that actually
// exist -- track order matches TRAINING_PLANS' own lowest-to-highest
// mileage ordering.
const TRACKS = [...new Map(TRAINING_PLANS.map((p) => [p.track, p.trackLabel])).entries()] as [TrackKey, string][];
const DURATIONS: DurationWeeks[] = [12, 18];

// "Auto-select a pre-made plan, then edit the fields as needed" -- picks
// one of the self-serve training-plan tracks (src/lib/training-plans/)
// and generates real scheduled_workouts/training_week_plans/a
// training_phases entry for this athlete via importTrainingPlanTrack, see
// import-plan-actions.ts for the actual write logic and plan-import.ts for
// the pure scaling/classification/date-mapping this all rests on. Mirrors
// PhaseForm's own inline create-form shape (mounted as an alternative to
// it in phase-view.tsx), not a modal -- this is a phase-level action, the
// same conceptual "add a training block" the existing "+ Add phase" button
// already offers, just pre-populated from a real published plan instead of
// starting blank.
export function ImportPlanForm({
  athleteId,
  initialRace,
  onDone,
  onCancel,
}: {
  athleteId: string;
  // Pre-fills the reference-race fields below from the athlete's real
  // most recent race_results row (the same live-reference source the rest
  // of the coaching platform's pace-reference system already uses) --
  // null when nothing's on file yet, in which case the fields just start
  // blank rather than blocking the import on a value that doesn't exist.
  initialRace: AthleteMostRecentRace | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [track, setTrack] = useState<TrackKey>(TRACKS[0][0]);
  const [durationWeeks, setDurationWeeks] = useState<DurationWeeks>(18);
  const plan = trainingPlanMap.get(`${track}-${durationWeeks}`)!;
  const [targetPeak, setTargetPeak] = useState(String(plan.referencePeakWeeklyMiles));
  const [startDate, setStartDate] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [raceDistanceKey, setRaceDistanceKey] = useState(initialRace ? closestDistanceKey(initialRace.distanceM) : "5k");
  const [raceTimeInput, setRaceTimeInput] = useState(initialRace ? secondsToTimeInput(initialRace.finishTimeS) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<ImportPlanResult | null>(null);

  function updateTrack(nextTrack: TrackKey) {
    setTrack(nextTrack);
    const nextPlan = trainingPlanMap.get(`${nextTrack}-${durationWeeks}`)!;
    setTargetPeak(String(nextPlan.referencePeakWeeklyMiles));
  }
  function updateDuration(nextDuration: DurationWeeks) {
    setDurationWeeks(nextDuration);
    const nextPlan = trainingPlanMap.get(`${track}-${nextDuration}`)!;
    setTargetPeak(String(nextPlan.referencePeakWeeklyMiles));
  }

  // A date picked off-Monday is silently corrected to that week's Monday
  // rather than rejected -- this project's own Monday-aligned week grid
  // has no other meaning for "start date" than "which week's Monday," so
  // snapping is more forgiving than a hard validation error for the same
  // outcome.
  function updateStartDate(value: string) {
    if (!value) return setStartDate("");
    setStartDate(mostRecentMonday(new Date(`${value}T00:00:00Z`)));
  }

  async function handleSubmit() {
    setError(null);
    if (!startDate) return setError("Pick a start date.");
    const peak = Number(targetPeak);
    if (!Number.isFinite(peak) || peak <= 0) return setError("Enter a target peak weekly mileage greater than 0.");

    // Every one of these is optional -- an empty field just means the
    // days that would have used it keep their prose-only prescription
    // (see plan-import.ts's own AthleteReferenceInputs comment), never a
    // blocked import and never a fabricated number.
    const parsedRestingHr = restingHr.trim() ? Number(restingHr) : null;
    if (restingHr.trim() && (parsedRestingHr === null || !Number.isFinite(parsedRestingHr) || parsedRestingHr <= 0)) {
      return setError("Enter resting heart rate as a number.");
    }
    const parsedMaxHr = maxHr.trim() ? Number(maxHr) : null;
    if (maxHr.trim() && (parsedMaxHr === null || !Number.isFinite(parsedMaxHr) || parsedMaxHr <= 0)) {
      return setError("Enter max heart rate as a number.");
    }

    let referenceRace: { distanceM: number; finishTimeS: number } | null = null;
    if (raceTimeInput.trim()) {
      const finishTimeS = parseTimeToSeconds(raceTimeInput);
      if (finishTimeS === null) return setError("Enter the reference race time as mm:ss or h:mm:ss.");
      const distance = raceDistanceMap.get(raceDistanceKey);
      if (!distance) return setError("Pick a valid reference race distance.");
      referenceRace = { distanceM: Math.round(distance.meters), finishTimeS };
    }

    setIsPending(true);
    const res = await importTrainingPlanTrack({
      athleteId,
      trackKey: track,
      durationWeeks,
      targetPeakWeeklyMiles: peak,
      startDate,
      restingHr: parsedRestingHr,
      maxHr: parsedMaxHr,
      referenceRace,
    });
    setIsPending(false);
    if (res.error) return setError(res.error);
    setResult(res);
  }

  if (result) {
    return (
      <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">
          Imported {result.importedCount ?? 0} workouts across {result.weeksCreated ?? 0} weeks.
        </p>
        {result.skippedDates && result.skippedDates.length > 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {result.skippedDates.length} {result.skippedDates.length === 1 ? "day" : "days"} already had a workout and{" "}
            {result.skippedDates.length === 1 ? "was" : "were"} left as-is.
          </p>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onDone();
            router.refresh();
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Plan track</span>
          <select value={track} onChange={(e) => updateTrack(e.target.value as TrackKey)} className={fieldClass}>
            {TRACKS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Length</span>
          <select value={durationWeeks} onChange={(e) => updateDuration(Number(e.target.value) as DurationWeeks)} className={fieldClass}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} weeks
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Target peak weekly mileage</span>
          <input value={targetPeak} onChange={(e) => setTargetPeak(e.target.value)} className={fieldClass} />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {plan.trackLabel} {durationWeeks}-week peaks at {plan.referencePeakWeeklyMiles}mi as authored -- every day scales
            proportionally to hit whatever peak you set here.
          </p>
        </label>
        <label className="block">
          <span className={labelClass}>Start date</span>
          <input type="date" value={startDate} onChange={(e) => updateStartDate(e.target.value)} className={fieldClass} />
          {startDate ? (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Week of {formatDate(startDate)} (snapped to Monday). Plan ends{" "}
              {formatDate(addDays(startDate, durationWeeks * 7 - 1))} -- set the athlete&rsquo;s goal race for that date.
            </p>
          ) : null}
        </label>
      </div>

      <div className="border-t border-black/10 pt-3 dark:border-white/10">
        <p className={labelClass}>Real pace &amp; heart-rate targets (optional)</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          This plan prescribes quality days as a percent of race pace (&ldquo;96–102% 5K&rdquo;) and easy days by heart-rate
          reserve ceiling. Fill these in to turn that into real numbers on each day; leave any of them blank to keep
          those days as prose-only prescriptions instead.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-3 xs:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Resting heart rate (bpm)</span>
            <input value={restingHr} onChange={(e) => setRestingHr(e.target.value)} className={fieldClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Max heart rate (bpm)</span>
            <input value={maxHr} onChange={(e) => setMaxHr(e.target.value)} className={fieldClass} />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 xs:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Reference race distance</span>
            <select value={raceDistanceKey} onChange={(e) => setRaceDistanceKey(e.target.value)} className={fieldClass}>
              {RACE_DISTANCES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Reference race time</span>
            <input
              value={raceTimeInput}
              onChange={(e) => setRaceTimeInput(e.target.value)}
              placeholder="mm:ss or h:mm:ss"
              className={fieldClass}
            />
            {initialRace && !raceTimeInput ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">No race on file yet -- enter one to compute pace targets.</p>
            ) : initialRace ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Pre-filled from their most recent race on file -- edit to use a different one.</p>
            ) : null}
          </label>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Every generated workout lands as an unpublished draft -- review the whole block before publishing any of it.
      </p>

      {error && <FormError>{error}</FormError>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Generating…" : "Generate plan"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
