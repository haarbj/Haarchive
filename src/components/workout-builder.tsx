"use client";

import { useId } from "react";

import { LabeledInput } from "@/components/ui/labeled-input";
import { fieldClass, labelClass } from "@/lib/form-styles";
import {
  formatPaceOutput,
  parsePaceInput,
  PACE_UNIT_LABEL,
  PACE_UNIT_METERS,
  type PaceUnit,
} from "@/lib/pace-percent-math";
import { COMPARISON_ZONES, type ComparisonZone } from "@/lib/pace-model-comparison-math";
import { formatClock, parseTimeToSeconds } from "@/lib/running-format";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import {
  detailsBodyClass,
  detailsClass,
  heroCardClass,
  sectionLabelClass,
  segmentedButtonClass,
  statCardClass,
  statLabelClass,
  summaryClass,
} from "@/lib/tool-styles";
import {
  buildGarminProgram,
  buildWorkoutPlan,
  formatDistanceInUnit,
  formatMetersAuto,
  formatPaceRange,
  RECOVERY_TYPE_LABEL,
  type MainSetMode,
  type RecoveryMode,
  type RecoveryType,
  type WorkoutInputs,
} from "@/lib/workout-builder-math";

const STORAGE_KEY = "haarchive-workout-builder-state";

const ZONE_OPTIONS: { value: ComparisonZone | ""; label: string }[] = [
  { value: "", label: "Custom / no zone" },
  ...COMPARISON_ZONES.map((zone) => ({ value: zone, label: zone })),
];

const RECOVERY_TYPES: RecoveryType[] = ["jog", "walk", "stand"];
const PACE_UNITS: PaceUnit[] = ["mi", "km"];

type PersistedState = {
  zone: ComparisonZone | "";
  paceUnit: PaceUnit;
  referencePaceInput: string;
  easyPaceInput: string;
  warmupInput: string;
  cooldownInput: string;
  reps: number;
  mainSetMode: MainSetMode;
  mainSetDistanceInput: string;
  mainSetMinutesInput: string;
  recoveryMode: RecoveryMode;
  recoveryDistanceInput: string;
  recoveryTimeInput: string;
  recoveryType: RecoveryType;
};

function formatTotalTime(seconds: number): string {
  return formatClock(seconds);
}

export function WorkoutBuilder() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [zone, setZone] = usePersistedField<ComparisonZone | "">(persisted?.zone, "");
  const [paceUnit, setPaceUnit] = usePersistedField<PaceUnit>(persisted?.paceUnit, "mi");
  const [referencePaceInput, setReferencePaceInput] = usePersistedField(persisted?.referencePaceInput, "7:00");
  const [easyPaceInput, setEasyPaceInput] = usePersistedField(persisted?.easyPaceInput, "8:30");
  const [warmupInput, setWarmupInput] = usePersistedField(persisted?.warmupInput, "1.5");
  const [cooldownInput, setCooldownInput] = usePersistedField(persisted?.cooldownInput, "1.5");
  const [reps, setReps] = usePersistedField(persisted?.reps, 6);
  const [mainSetMode, setMainSetMode] = usePersistedField<MainSetMode>(persisted?.mainSetMode, "distance");
  const [mainSetDistanceInput, setMainSetDistanceInput] = usePersistedField(persisted?.mainSetDistanceInput, "800");
  const [mainSetMinutesInput, setMainSetMinutesInput] = usePersistedField(persisted?.mainSetMinutesInput, "3");
  const [recoveryMode, setRecoveryMode] = usePersistedField<RecoveryMode>(persisted?.recoveryMode, "distance");
  const [recoveryDistanceInput, setRecoveryDistanceInput] = usePersistedField(persisted?.recoveryDistanceInput, "400");
  const [recoveryTimeInput, setRecoveryTimeInput] = usePersistedField(persisted?.recoveryTimeInput, "1:30");
  const [recoveryType, setRecoveryType] = usePersistedField<RecoveryType>(persisted?.recoveryType, "jog");

  function persistState(patch: Partial<PersistedState> = {}) {
    try {
      const state: PersistedState = {
        zone,
        paceUnit,
        referencePaceInput,
        easyPaceInput,
        warmupInput,
        cooldownInput,
        reps,
        mainSetMode,
        mainSetDistanceInput,
        mainSetMinutesInput,
        recoveryMode,
        recoveryDistanceInput,
        recoveryTimeInput,
        recoveryType,
        ...patch,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }

  const unitMeters = PACE_UNIT_METERS[paceUnit];

  const referencePaceSeconds = parsePaceInput(referencePaceInput, paceUnit);
  const referencePaceValid = referencePaceSeconds !== null && referencePaceSeconds > 0;
  const easyPaceSeconds = parsePaceInput(easyPaceInput, paceUnit);
  const easyPaceValid = easyPaceSeconds !== null && easyPaceSeconds > 0;

  const warmupRaw = Number(warmupInput);
  const warmupValid = warmupInput.trim() !== "" && Number.isFinite(warmupRaw) && warmupRaw >= 0;
  const cooldownRaw = Number(cooldownInput);
  const cooldownValid = cooldownInput.trim() !== "" && Number.isFinite(cooldownRaw) && cooldownRaw >= 0;

  const repsValid = Number.isFinite(reps) && reps >= 1 && reps <= 20;

  const mainSetDistanceRaw = Number(mainSetDistanceInput);
  const mainSetDistanceValid = Number.isFinite(mainSetDistanceRaw) && mainSetDistanceRaw > 0;
  const mainSetMinutesRaw = Number(mainSetMinutesInput);
  const mainSetMinutesValid = Number.isFinite(mainSetMinutesRaw) && mainSetMinutesRaw > 0;

  const recoveryDistanceRaw = Number(recoveryDistanceInput);
  const recoveryDistanceValid = Number.isFinite(recoveryDistanceRaw) && recoveryDistanceRaw >= 0;
  const recoveryTimeSeconds = parseTimeToSeconds(recoveryTimeInput);
  const recoveryTimeValid = recoveryTimeSeconds !== null && recoveryTimeSeconds >= 0;

  const canCompute =
    referencePaceValid &&
    easyPaceValid &&
    warmupValid &&
    cooldownValid &&
    repsValid &&
    (mainSetMode === "distance" ? mainSetDistanceValid : mainSetMinutesValid) &&
    (recoveryMode === "distance" ? recoveryDistanceValid : recoveryTimeValid);

  const inputs: WorkoutInputs | null = canCompute
    ? {
        referencePaceSecPerMeter: referencePaceSeconds! / unitMeters,
        easyPaceSecPerMeter: easyPaceSeconds! / unitMeters,
        warmupMeters: warmupRaw * unitMeters,
        cooldownMeters: cooldownRaw * unitMeters,
        reps,
        mainSetMode,
        mainSetDistanceMeters: mainSetDistanceRaw,
        mainSetDurationSeconds: mainSetMinutesRaw * 60,
        recoveryMode,
        recoveryDistanceMeters: recoveryDistanceRaw,
        recoveryDurationSeconds: recoveryTimeSeconds ?? 0,
        recoveryType,
      }
    : null;

  const plan = inputs ? buildWorkoutPlan(inputs) : null;
  const garminLines = plan && inputs ? buildGarminProgram(plan, inputs, paceUnit) : null;

  const title = zone ? `${zone} Workout` : "Workout";

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Reference pace</p>
        <div className={`${statCardClass} space-y-4`}>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            Bring a pace from any of this site&rsquo;s calculators -- Easy, Marathon, Tempo/Threshold, CV, or
            VO2max -- or just type one in. The zone below only labels the workout; it never changes the math, since
            the pace itself is already the real target.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor={`${baseId}-zone`} className={labelClass}>
                Zone (label only)
              </label>
              <select
                id={`${baseId}-zone`}
                value={zone}
                onChange={(event) => {
                  const next = event.target.value as ComparisonZone | "";
                  setZone(next);
                  persistState({ zone: next });
                }}
                className={fieldClass}
              >
                {ZONE_OPTIONS.map((option) => (
                  <option key={option.value || "custom"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <LabeledInput
              id={`${baseId}-reference-pace`}
              label="Reference pace"
              type="text"
              value={referencePaceInput}
              onChange={(event) => {
                setReferencePaceInput(event.target.value);
                persistState({ referencePaceInput: event.target.value });
              }}
              placeholder="m:ss"
              autoComplete="off"
              className="w-24"
            />
            <div className="flex gap-2">
              {PACE_UNITS.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => {
                    setPaceUnit(unit);
                    persistState({ paceUnit: unit });
                  }}
                  aria-pressed={paceUnit === unit}
                  className={segmentedButtonClass(paceUnit === unit)}
                >
                  {PACE_UNIT_LABEL[unit]}
                </button>
              ))}
            </div>
            <LabeledInput
              id={`${baseId}-easy-pace`}
              label="Easy pace (warmup/cooldown)"
              type="text"
              value={easyPaceInput}
              onChange={(event) => {
                setEasyPaceInput(event.target.value);
                persistState({ easyPaceInput: event.target.value });
              }}
              placeholder="m:ss"
              autoComplete="off"
              className="w-24"
            />
          </div>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Warmup &amp; cooldown</p>
        <div className={`${statCardClass} flex flex-wrap gap-4`}>
          <LabeledInput
            id={`${baseId}-warmup`}
            label={`Warmup (${paceUnit})`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={warmupInput}
            onChange={(event) => {
              setWarmupInput(event.target.value);
              persistState({ warmupInput: event.target.value });
            }}
            className="w-24"
          />
          <LabeledInput
            id={`${baseId}-cooldown`}
            label={`Cooldown (${paceUnit})`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={cooldownInput}
            onChange={(event) => {
              setCooldownInput(event.target.value);
              persistState({ cooldownInput: event.target.value });
            }}
            className="w-24"
          />
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Main set</p>
        <div className={`${statCardClass} space-y-4`}>
          <div className="flex flex-wrap items-end gap-4">
            <LabeledInput
              id={`${baseId}-reps`}
              label="Reps (1-20)"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={reps}
              onChange={(event) => {
                const next = Math.round(Number(event.target.value));
                setReps(next);
                persistState({ reps: next });
              }}
              className="w-20"
            />
            <div className="flex gap-2">
              {(["distance", "time"] as MainSetMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setMainSetMode(mode);
                    persistState({ mainSetMode: mode });
                  }}
                  aria-pressed={mainSetMode === mode}
                  className={segmentedButtonClass(mainSetMode === mode)}
                >
                  {mode === "distance" ? "By distance" : "By time"}
                </button>
              ))}
            </div>
            {mainSetMode === "distance" ? (
              <LabeledInput
                id={`${baseId}-main-distance`}
                label="Interval distance (m, 200-5000)"
                type="number"
                inputMode="decimal"
                min={200}
                max={5000}
                value={mainSetDistanceInput}
                onChange={(event) => {
                  setMainSetDistanceInput(event.target.value);
                  persistState({ mainSetDistanceInput: event.target.value });
                }}
                className="w-28"
              />
            ) : (
              <LabeledInput
                id={`${baseId}-main-minutes`}
                label="Interval length (min, 1-10)"
                type="number"
                inputMode="decimal"
                min={1}
                max={10}
                value={mainSetMinutesInput}
                onChange={(event) => {
                  setMainSetMinutesInput(event.target.value);
                  persistState({ mainSetMinutesInput: event.target.value });
                }}
                className="w-24"
              />
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex gap-2">
              {(["distance", "time"] as RecoveryMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    // "Stand" (no ground covered) is only well-defined as a
                    // duration -- switching to distance recovery while
                    // "stand" is selected falls back to "jog" rather than
                    // leaving a contradictory combination selected.
                    const nextType = mode === "distance" && recoveryType === "stand" ? "jog" : recoveryType;
                    setRecoveryMode(mode);
                    if (nextType !== recoveryType) setRecoveryType(nextType);
                    persistState({ recoveryMode: mode, recoveryType: nextType });
                  }}
                  aria-pressed={recoveryMode === mode}
                  className={segmentedButtonClass(recoveryMode === mode)}
                >
                  {mode === "distance" ? "Recovery by distance" : "Recovery by time"}
                </button>
              ))}
            </div>
            {recoveryMode === "distance" ? (
              <LabeledInput
                id={`${baseId}-recovery-distance`}
                label="Recovery distance (m, 100-1000)"
                type="number"
                inputMode="decimal"
                min={100}
                max={1000}
                value={recoveryDistanceInput}
                onChange={(event) => {
                  setRecoveryDistanceInput(event.target.value);
                  persistState({ recoveryDistanceInput: event.target.value });
                }}
                className="w-28"
              />
            ) : (
              <LabeledInput
                id={`${baseId}-recovery-time`}
                label="Recovery (m:ss, 0:30-5:00)"
                type="text"
                value={recoveryTimeInput}
                onChange={(event) => {
                  setRecoveryTimeInput(event.target.value);
                  persistState({ recoveryTimeInput: event.target.value });
                }}
                placeholder="m:ss"
                autoComplete="off"
                className="w-24"
              />
            )}
            <div className="flex gap-2">
              {RECOVERY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={recoveryMode === "distance" && type === "stand"}
                  onClick={() => {
                    setRecoveryType(type);
                    persistState({ recoveryType: type });
                  }}
                  aria-pressed={recoveryType === type}
                  className={`${segmentedButtonClass(recoveryType === type)} disabled:cursor-not-allowed disabled:opacity-40`}
                  title={recoveryMode === "distance" && type === "stand" ? "Standing still has no distance -- switch to time-based recovery" : undefined}
                >
                  {RECOVERY_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!canCompute && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Enter a reference pace, easy pace, warmup/cooldown distance, reps, and main-set/recovery values to build
          the workout.
        </p>
      )}

      {plan && inputs && (
        <>
          <div>
            <p className={sectionLabelClass}>{title}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={heroCardClass}>
                <p className={statLabelClass}>Total distance</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                  {formatDistanceInUnit(plan.totalDistanceMeters, paceUnit)}
                </p>
              </div>
              <div className={heroCardClass}>
                <p className={statLabelClass}>Estimated total time</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                  {formatTotalTime(plan.totalDurationSeconds)}
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Assumes {formatPaceOutput(easyPaceSeconds!, paceUnit)}
                  {PACE_UNIT_LABEL[paceUnit]} for warmup/cooldown and recovery jogs.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className={sectionLabelClass}>Step by step</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left dark:border-white/10">
                    <th className="py-2 pr-4 font-semibold text-zinc-900 dark:text-white">Step</th>
                    <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">Distance</th>
                    <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">Time</th>
                    <th className="py-2 pl-3 text-right font-semibold text-zinc-900 dark:text-white">Target pace</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700 dark:text-zinc-200">
                  {plan.steps.map((step, i) => (
                    <tr key={i} className="border-b border-black/5 dark:border-white/5">
                      <td className="py-1.5 pr-4 font-medium whitespace-nowrap text-zinc-900 dark:text-white">{step.label}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{formatMetersAuto(step.distanceMeters)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{formatClock(step.durationSeconds)}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums whitespace-nowrap">
                        {step.targetPaceSecPerMeter !== null ? formatPaceRange(step.targetPaceSecPerMeter, paceUnit) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {garminLines && (
            <div>
              <p className={sectionLabelClass}>Program this on your watch</p>
              <div className={`${statCardClass} space-y-1.5 text-sm text-zinc-700 dark:text-zinc-200`}>
                {garminLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                Matches the step structure of a real Garmin (or similar) structured workout: a repeat block with a
                pace range, since no GPS watch can hold you to one exact instant.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Where these numbers come from
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  This tool does no pace prediction of its own: the reference pace is a given, the same way the Race
                  Pace Planner takes a goal pace as a given. Every rep&rsquo;s time is distance ÷ pace (or the
                  reverse, for a time-based interval); warmup, cooldown, and a jog recovery use the easy pace above;
                  a walk recovery assumes a fixed ~17:00/mi walking pace, used only to estimate total time, never
                  shown as a target. Every target pace is widened to a ±5 sec/{paceUnit} range, since a GPS watch
                  can&rsquo;t hold you to one exact instant.
                </p>
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
