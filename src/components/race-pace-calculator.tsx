"use client";

import { useEffect, useId } from "react";
import Link from "next/link";

import { SaveCalculationButton } from "@/components/save-calculation-button";
import { LabeledInput } from "@/components/ui/labeled-input";
import { fieldClass, labelClass } from "@/lib/form-styles";
import {
  PACE_UNIT_LABEL,
  PACE_UNIT_METERS,
  type PaceUnit,
} from "@/lib/pace-percent-math";
import {
  type RaceCategory,
  RACE_DISTANCES,
  raceDistanceMap,
} from "@/lib/race-distances";
import {
  type CustomDistanceUnit,
  customDistanceToMeters,
  speedMSFromDistanceAndTime,
  timeSecondsFromDistanceAndSpeed,
} from "@/lib/race-pace-math";
import { formatClock, formatTrackTime, parseTimeToSeconds, parseTrackTime } from "@/lib/running-format";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import {
  heroCardClass,
  sectionLabelClass,
  segmentedButtonClass,
  statCardClass,
  statLabelClass,
} from "@/lib/tool-styles";

type Mode = "time-to-pace" | "pace-to-time";
type SplitUnit = PaceUnit | "custom";
type CategoryFilter = RaceCategory | "all";

const SPLIT_UNITS: PaceUnit[] = ["mi", "km", "400m", "200m"];
const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "track", label: "Track" },
  { key: "xc", label: "XC" },
  { key: "road", label: "Road" },
];
const CUSTOM_RACE_UNITS: Exclude<CustomDistanceUnit, "yd">[] = ["m", "km", "mi"];
const CUSTOM_SPLIT_UNITS: CustomDistanceUnit[] = ["m", "yd", "km", "mi"];
const STORAGE_KEY = "haarchive-race-pace-calculator-state";

type PersistedState = {
  mode: Mode;
  category: CategoryFilter;
  distanceKey: string;
  customRaceInput: string;
  customRaceUnit: Exclude<CustomDistanceUnit, "yd">;
  raceTimeInput: string;
  splitUnit: SplitUnit;
  customSplitInput: string;
  customSplitUnit: CustomDistanceUnit;
  paceInput: string;
};

// A custom split is almost always a short, track-repeat-scale distance
// (the original tool's own defaults are 500m / 440yd) -- so like /400m and
// /200m, it gets track-time formatting (bare decimal seconds under a
// minute) rather than mm:ss. A custom RACE distance is still a whole race,
// so it always gets mm:ss / h:mm:ss regardless of how short it is.
function isShortSplitUnit(unit: SplitUnit): boolean {
  return unit === "400m" || unit === "200m" || unit === "custom";
}

function parseSplitPace(input: string, unit: SplitUnit): number | null {
  return isShortSplitUnit(unit) ? parseTrackTime(input) : parseTimeToSeconds(input);
}

function formatSplitPace(seconds: number, unit: SplitUnit): string {
  return isShortSplitUnit(unit) ? formatTrackTime(seconds) : formatClock(seconds);
}

// Race pace <-> finish time converter -- adapted from John Davis's
// race-pace calculator (github.com/johnjdavisiv/race-pace, MIT licensed).
// Unlike this project's other pace tools, there's no model or percentage
// convention here: pure distance/speed/time algebra (see
// lib/race-pace-math.ts), the one thing every other pace tool assumes you
// can already do.
export function RacePaceCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [mode, setMode] = usePersistedField<Mode>(persisted?.mode, "time-to-pace");
  const [category, setCategory] = usePersistedField<CategoryFilter>(persisted?.category, "all");
  const [distanceKey, setDistanceKey] = usePersistedField(persisted?.distanceKey, "5k");
  const [customRaceInput, setCustomRaceInput] = usePersistedField(persisted?.customRaceInput, "5000");
  const [customRaceUnit, setCustomRaceUnit] = usePersistedField<Exclude<CustomDistanceUnit, "yd">>(persisted?.customRaceUnit, "m");
  const [raceTimeInput, setRaceTimeInput] = usePersistedField(persisted?.raceTimeInput, "21:45");
  const [splitUnit, setSplitUnit] = usePersistedField<SplitUnit>(persisted?.splitUnit, "mi");
  const [customSplitInput, setCustomSplitInput] = usePersistedField(persisted?.customSplitInput, "500");
  const [customSplitUnit, setCustomSplitUnit] = usePersistedField<CustomDistanceUnit>(persisted?.customSplitUnit, "m");
  const [paceInput, setPaceInput] = usePersistedField(persisted?.paceInput, "7:00");

  useEffect(() => {
    try {
      const state: PersistedState = {
        mode,
        category,
        distanceKey,
        customRaceInput,
        customRaceUnit,
        raceTimeInput,
        splitUnit,
        customSplitInput,
        customSplitUnit,
        paceInput,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [mode, category, distanceKey, customRaceInput, customRaceUnit, raceTimeInput, splitUnit, customSplitInput, customSplitUnit, paceInput]);

  const visibleDistances =
    category === "all" ? RACE_DISTANCES : RACE_DISTANCES.filter((d) => d.categories.includes(category));

  function handleCategoryChange(next: CategoryFilter) {
    setCategory(next);
    if (next !== "all" && distanceKey !== "custom") {
      const stillVisible = RACE_DISTANCES.find((d) => d.key === distanceKey)?.categories.includes(next);
      if (!stillVisible) {
        const firstMatch = RACE_DISTANCES.find((d) => d.categories.includes(next));
        if (firstMatch) setDistanceKey(firstMatch.key);
      }
    }
  }

  const customRaceMeters = customDistanceToMeters(Number(customRaceInput), customRaceUnit);
  const customRaceValid = customRaceInput.trim() !== "" && Number.isFinite(customRaceMeters) && customRaceMeters > 0;
  const distanceMeters =
    distanceKey === "custom" ? (customRaceValid ? customRaceMeters : null) : (raceDistanceMap.get(distanceKey)?.meters ?? null);
  const distanceLabel = distanceKey === "custom" ? `${customRaceInput}${customRaceUnit}` : (raceDistanceMap.get(distanceKey)?.label ?? "");

  const customSplitMeters = customDistanceToMeters(Number(customSplitInput), customSplitUnit);
  const customSplitValid = customSplitInput.trim() !== "" && Number.isFinite(customSplitMeters) && customSplitMeters > 0;
  const splitMeters = splitUnit === "custom" ? (customSplitValid ? customSplitMeters : null) : PACE_UNIT_METERS[splitUnit];
  const splitLabel = splitUnit === "custom" ? `/${customSplitInput}${customSplitUnit}` : PACE_UNIT_LABEL[splitUnit];

  const raceTimeSeconds = parseTimeToSeconds(raceTimeInput);
  const paceSeconds = parseSplitPace(paceInput, splitUnit);

  const resultSeconds =
    mode === "time-to-pace"
      ? distanceMeters !== null && raceTimeSeconds !== null && splitMeters !== null
        ? timeSecondsFromDistanceAndSpeed(splitMeters, speedMSFromDistanceAndTime(distanceMeters, raceTimeSeconds))
        : null
      : distanceMeters !== null && paceSeconds !== null && splitMeters !== null
        ? timeSecondsFromDistanceAndSpeed(distanceMeters, speedMSFromDistanceAndTime(splitMeters, paceSeconds))
        : null;
  const resultValid = resultSeconds !== null && Number.isFinite(resultSeconds) && resultSeconds > 0;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>What do you know?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("time-to-pace")}
            aria-pressed={mode === "time-to-pace"}
            className={segmentedButtonClass(mode === "time-to-pace")}
          >
            My goal race time
          </button>
          <button
            type="button"
            onClick={() => setMode("pace-to-time")}
            aria-pressed={mode === "pace-to-time"}
            className={segmentedButtonClass(mode === "pace-to-time")}
          >
            My goal pace
          </button>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Race distance</p>
        <div className={`${statCardClass} space-y-4`}>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => handleCategoryChange(f.key)}
                aria-pressed={category === f.key}
                className={segmentedButtonClass(category === f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleDistances.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDistanceKey(d.key)}
                aria-pressed={distanceKey === d.key}
                className={segmentedButtonClass(distanceKey === d.key)}
              >
                {d.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDistanceKey("custom")}
              aria-pressed={distanceKey === "custom"}
              className={segmentedButtonClass(distanceKey === "custom")}
            >
              Custom
            </button>
          </div>
          {distanceKey === "custom" && (
            <div>
              <label htmlFor={`${baseId}-custom-race`} className={labelClass}>
                Custom race distance
              </label>
              <div className="flex gap-2">
                <input
                  id={`${baseId}-custom-race`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={customRaceInput}
                  onChange={(event) => setCustomRaceInput(event.target.value)}
                  className={`w-28 ${fieldClass}`}
                />
                <select
                  aria-label="Custom race distance unit"
                  value={customRaceUnit}
                  onChange={(event) => setCustomRaceUnit(event.target.value as Exclude<CustomDistanceUnit, "yd">)}
                  className={fieldClass}
                >
                  {CUSTOM_RACE_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit === "m" ? "meters" : unit === "km" ? "kilometers" : "miles"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {mode === "time-to-pace" ? (
        <div>
          <p className={sectionLabelClass}>Goal race time</p>
          <div className={statCardClass}>
            <LabeledInput
              id={`${baseId}-race-time`}
              label={`Finish time for ${distanceLabel}`}
              type="text"
              value={raceTimeInput}
              onChange={(event) => setRaceTimeInput(event.target.value)}
              placeholder="mm:ss or h:mm:ss"
              autoComplete="off"
              className="w-32"
            />
            {raceTimeSeconds === null && (
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">Enter as mm:ss or h:mm:ss.</p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className={sectionLabelClass}>Goal pace</p>
          <div className={`${statCardClass} space-y-3`}>
            <LabeledInput
              id={`${baseId}-pace`}
              label="Pace"
              type="text"
              value={paceInput}
              onChange={(event) => setPaceInput(event.target.value)}
              placeholder={isShortSplitUnit(splitUnit) ? "seconds or mm:ss" : "mm:ss"}
              autoComplete="off"
              className="w-32"
            />
            <div className="flex flex-wrap gap-2">
              {SPLIT_UNITS.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setSplitUnit(unit)}
                  aria-pressed={splitUnit === unit}
                  className={segmentedButtonClass(splitUnit === unit)}
                >
                  {PACE_UNIT_LABEL[unit]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSplitUnit("custom")}
                aria-pressed={splitUnit === "custom"}
                className={segmentedButtonClass(splitUnit === "custom")}
              >
                Custom
              </button>
            </div>
            {splitUnit === "custom" && (
              <div>
                <label htmlFor={`${baseId}-custom-split`} className={labelClass}>
                  Custom split distance
                </label>
                <div className="flex gap-2">
                  <input
                    id={`${baseId}-custom-split`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={customSplitInput}
                    onChange={(event) => setCustomSplitInput(event.target.value)}
                    className={`w-24 ${fieldClass}`}
                  />
                  <select
                    aria-label="Custom split distance unit"
                    value={customSplitUnit}
                    onChange={(event) => setCustomSplitUnit(event.target.value as CustomDistanceUnit)}
                    className={fieldClass}
                  >
                    {CUSTOM_SPLIT_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit === "m" ? "meters" : unit === "yd" ? "yards" : unit === "km" ? "kilometers" : "miles"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <p className={sectionLabelClass}>Result</p>
        <div className={heroCardClass}>
          {resultValid ? (
            <>
              <p className={statLabelClass}>
                {mode === "time-to-pace" ? `Pace required, per ${splitLabel.replace(/^\//, "")}` : `Finish time for ${distanceLabel}`}
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                {mode === "time-to-pace" ? (
                  <>
                    {formatSplitPace(resultSeconds, splitUnit)}
                    {splitLabel}
                  </>
                ) : (
                  formatClock(resultSeconds)
                )}
              </p>
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                {mode === "time-to-pace"
                  ? `To run ${formatClock(raceTimeSeconds!)} for ${distanceLabel}, hold ${formatSplitPace(resultSeconds, splitUnit)}${splitLabel}.`
                  : `Holding ${formatSplitPace(paceSeconds!, splitUnit)}${splitLabel} for the whole race gets you ${formatClock(resultSeconds)} at ${distanceLabel}.`}
              </p>

              <SaveCalculationButton
                calculatorType="race-pace-calculator"
                input={{ mode, distanceKey, customRaceInput, customRaceUnit, raceTimeInput, splitUnit, customSplitInput, customSplitUnit, paceInput }}
                output={{
                  result:
                    mode === "time-to-pace" ? `${formatSplitPace(resultSeconds, splitUnit)}${splitLabel}` : formatClock(resultSeconds),
                }}
                label={`${distanceLabel}: ${mode === "time-to-pace" ? formatClock(raceTimeSeconds!) : `${formatSplitPace(paceSeconds!, splitUnit)}${splitLabel}`}`}
              />
            </>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              Enter a valid {mode === "time-to-pace" ? "race time" : "pace"} and distance to see a result.
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Want to know what that pace means physiologically, or turn it into a percentage-based workout? The{" "}
        <Link
          href="/cv-threshold-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Threshold, CV &amp; VO2max Calculator
        </Link>{" "}
        and{" "}
        <Link
          href="/pace-percent-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Pace Percent Calculator
        </Link>{" "}
        both build on a race pace like this one. For training paces and heart-rate zones predicted from a recent
        race, see the{" "}
        <Link
          href="/pace-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Pace &amp; Heart Rate Calculator
        </Link>
        . For a performance rating and every training zone at once from a single race, see the{" "}
        <Link
          href="/tinman-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Tinman Running Calculator
        </Link>
        .
      </p>
    </div>
  );
}
