"use client";

import { useEffect, useId } from "react";
import Link from "next/link";

import { SaveCalculationButton } from "@/components/save-calculation-button";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { formatClock, parseTimeToSeconds } from "@/lib/running-format";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import {
  detailsBodyClass,
  detailsClass,
  groupLabelClass,
  heroCardClass,
  learnMoreClass,
  sectionLabelClass,
  statCardClass,
  statLabelClass,
  summaryClass,
  toggleClass,
} from "@/lib/tool-styles";

type DistanceKey =
  | "1500m"
  | "1600m"
  | "mile"
  | "3000m"
  | "3200m"
  | "2mile"
  | "5k"
  | "6k"
  | "8k"
  | "10k"
  | "10mile"
  | "half"
  | "marathon";
type Course = "track" | "xc";
type DistanceGroup = "Track" | "Cross Country & Road";
type DisplayGroup = "Middle Distance" | "Track & Cross Country" | "Road";

type DistanceOption = {
  key: DistanceKey;
  label: string;
  meters: number;
  group: DistanceGroup;
  displayGroup: DisplayGroup;
  core?: boolean;
};

const DISTANCES: DistanceOption[] = [
  {
    key: "1500m",
    label: "1500m",
    meters: 1500,
    group: "Track",
    displayGroup: "Middle Distance",
  },
  {
    key: "1600m",
    label: "1600m",
    meters: 1600,
    group: "Track",
    displayGroup: "Middle Distance",
    core: true,
  },
  {
    key: "mile",
    label: "Mile",
    meters: 1609.34,
    group: "Track",
    displayGroup: "Middle Distance",
  },
  {
    key: "3000m",
    label: "3000m",
    meters: 3000,
    group: "Track",
    displayGroup: "Track & Cross Country",
  },
  {
    key: "3200m",
    label: "3200m",
    meters: 3200,
    group: "Track",
    displayGroup: "Track & Cross Country",
    core: true,
  },
  {
    key: "2mile",
    label: "2 Mile",
    meters: 3218.69,
    group: "Track",
    displayGroup: "Track & Cross Country",
  },
  {
    key: "5k",
    label: "5K",
    meters: 5000,
    group: "Cross Country & Road",
    displayGroup: "Track & Cross Country",
    core: true,
  },
  {
    key: "6k",
    label: "6K",
    meters: 6000,
    group: "Cross Country & Road",
    displayGroup: "Track & Cross Country",
  },
  {
    key: "8k",
    label: "8K",
    meters: 8000,
    group: "Cross Country & Road",
    displayGroup: "Track & Cross Country",
  },
  {
    key: "10k",
    label: "10K",
    meters: 10000,
    group: "Cross Country & Road",
    displayGroup: "Road",
    core: true,
  },
  {
    key: "10mile",
    label: "10 Mile",
    meters: 16093.4,
    group: "Cross Country & Road",
    displayGroup: "Road",
  },
  {
    key: "half",
    label: "Half Marathon",
    meters: 21097.5,
    group: "Cross Country & Road",
    displayGroup: "Road",
    core: true,
  },
  {
    key: "marathon",
    label: "Marathon",
    meters: 42195,
    group: "Cross Country & Road",
    displayGroup: "Road",
    core: true,
  },
];
const DISTANCE_GROUPS: DistanceGroup[] = ["Track", "Cross Country & Road"];
const DISPLAY_GROUPS: DisplayGroup[] = [
  "Middle Distance",
  "Track & Cross Country",
  "Road",
];
const MARATHON_METERS = 42195;

const MILE_METERS = 1609.34;
const SPLIT_METERS = [200, 300, 400, 600, 800, 1000, 1200, 1600];
const STORAGE_KEY = "haarchive-pace-calculator-state";

type PersistedState = {
  distanceKey: DistanceKey;
  timeInput: string;
  course: Course;
  xcDifficultyIndex: number;
  ageInput: string;
  restingHrInput: string;
  knownMaxHrInput: string;
  isFemale: boolean;
  mafIndex: number;
  showAdvanced: boolean;
  showMethodology: boolean;
};

// Common coaching rule of thumb: a cross country time is roughly 5% slower
// than an equivalent flat track/road effort, given average hills and
// footing — but real courses range roughly 3-10% depending on terrain.
// Courses vary enormously, so any single number here is a rough adjustment,
// not a precise conversion — see the explanation copy below.
const XC_ADJUSTMENTS = [
  { label: "Flat, firm, and fast", value: 0.97 },
  { label: "Average hills and footing (typical XC course)", value: 0.95 },
  { label: "Hilly, soft, or muddy", value: 0.93 },
  { label: "Very hilly, muddy, or technical", value: 0.9 },
];

const MAF_ADJUSTMENTS = [
  {
    label:
      "Recovering from illness, injury, or surgery — or on regular medication",
    value: -10,
  },
  {
    label: "New to running, training inconsistently, or frequent colds/allergies",
    value: -5,
  },
  {
    label: "Consistent, injury-free training — 2 years or less",
    value: 0,
  },
  {
    label:
      "Consistent, injury-free training — more than 2 years, and still improving",
    value: 5,
  },
];

const EFFORT_LEVELS = [
  { label: "Easy", pct: 0.6 },
  { label: "Moderate", pct: 0.7 },
  { label: "Hard", pct: 0.8 },
];

function formatPace(secondsPerMile: number): string {
  return `${formatClock(secondsPerMile)}/mi`;
}

function formatPaceValue(value: number | [number, number]): string {
  if (Array.isArray(value)) {
    return `${formatClock(value[0])}–${formatPace(value[1])}`;
  }
  return formatPace(value);
}

function predictSeconds(
  knownMeters: number,
  knownSeconds: number,
  targetMeters: number,
): number {
  return knownSeconds * Math.pow(targetMeters / knownMeters, 1.06);
}

// A recent race predicts marathon fitness less reliably the further it sits
// from marathon distance, since it has to bridge fatigue resistance and
// fueling demands a shorter race never tests. This is a rough, illustrative
// widening — not a statistically derived confidence interval.
function marathonRangeSeconds(
  pointSeconds: number,
  fromMeters: number,
): [number, number] {
  const gap = Math.log2(MARATHON_METERS / Math.max(fromMeters, 1500));
  const pct = Math.min(0.1, Math.max(0.02, gap * 0.012));
  return [pointSeconds * (1 - pct), pointSeconds * (1 + pct)];
}

function lapTime(secondsPerMile: number, meters: number): number {
  return (secondsPerMile / MILE_METERS) * meters;
}

// Track convention: splits under 600m are read off as whole seconds (e.g.
// "78"), splits 600m and up are read as minutes:seconds.
function formatSplit(secondsPerMile: number, meters: number): string {
  const split = lapTime(secondsPerMile, meters);
  return meters < 600 ? String(Math.round(split)) : formatClock(split);
}

function formatLapLine(paces: number[], metersList: number[]): string {
  return metersList
    .map((meters) => {
      const label = `${meters}m`;
      if (paces.length === 1) {
        return `${formatSplit(paces[0], meters)}/${label}`;
      }
      return `${formatSplit(paces[0], meters)}–${formatSplit(paces[1], meters)}/${label}`;
    })
    .join(" · ");
}

function karvonenAt(
  maxHr: number,
  restingHr: number,
  pct: number,
  femaleAdj: number,
): number {
  return Math.round((maxHr - restingHr) * pct + restingHr + femaleAdj);
}

type ZoneCardProps = {
  label: string;
  paceLabel: string;
  derivedFrom?: string;
  splitCaption?: string;
  hrLabel?: string;
  hrNote?: string;
  description: string;
  learnMoreHref: string;
  learnMoreLabel?: string;
  showDetails: boolean;
};

function ZoneCard({
  label,
  paceLabel,
  derivedFrom,
  splitCaption,
  hrLabel,
  hrNote,
  description,
  learnMoreHref,
  learnMoreLabel,
  showDetails,
}: ZoneCardProps) {
  return (
    <div className={statCardClass}>
      <p className={statLabelClass}>{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
        {paceLabel}
      </p>
      {showDetails && derivedFrom && (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {derivedFrom}
        </p>
      )}
      {hrLabel && (
        <p className="mt-1 text-xs font-medium text-zinc-700 dark:text-zinc-200">
          {hrLabel}
        </p>
      )}
      <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
        {description}
      </p>
      {showDetails && hrNote && (
        <p className="mt-1 text-[10.5px] text-zinc-500 dark:text-zinc-400">
          {hrNote}
        </p>
      )}
      {showDetails && splitCaption && (
        <p className="mt-1.5 text-[10.5px] text-zinc-600 dark:text-zinc-300">
          {splitCaption}
        </p>
      )}
      <Link href={learnMoreHref} className={learnMoreClass}>
        {learnMoreLabel ?? "Learn why →"}
      </Link>
    </div>
  );
}

export function PaceCalculator() {
  const baseId = useId();

  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const safeDistanceKey =
    persisted?.distanceKey && DISTANCES.some((d) => d.key === persisted.distanceKey)
      ? persisted.distanceKey
      : undefined;
  const [distanceKey, setDistanceKeyRaw] = usePersistedField<DistanceKey>(safeDistanceKey, "5k");
  const [timeInput, setTimeInput] = usePersistedField(persisted?.timeInput, "20:00");
  const [course, setCourse] = usePersistedField<Course>(persisted?.course, "xc");
  const safeXcDifficultyIndex =
    typeof persisted?.xcDifficultyIndex === "number" &&
    persisted.xcDifficultyIndex >= 0 &&
    persisted.xcDifficultyIndex < XC_ADJUSTMENTS.length
      ? persisted.xcDifficultyIndex
      : undefined;
  const [xcDifficultyIndex, setXcDifficultyIndex] = usePersistedField(safeXcDifficultyIndex, 1);
  const [showAdvanced, setShowAdvanced] = usePersistedField(persisted?.showAdvanced, false);
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  const [ageInput, setAgeInput] = usePersistedField(persisted?.ageInput, "16");
  const [restingHrInput, setRestingHrInput] = usePersistedField(persisted?.restingHrInput, "60");
  const [knownMaxHrInput, setKnownMaxHrInput] = usePersistedField(persisted?.knownMaxHrInput, "");
  const [isFemale, setIsFemale] = usePersistedField(persisted?.isFemale, false);
  const safeMafIndex =
    typeof persisted?.mafIndex === "number" && persisted.mafIndex >= 0 && persisted.mafIndex < MAF_ADJUSTMENTS.length
      ? persisted.mafIndex
      : undefined;
  const [mafIndex, setMafIndex] = usePersistedField(safeMafIndex, 2);

  useEffect(() => {
    try {
      const state: PersistedState = {
        distanceKey,
        timeInput,
        course,
        xcDifficultyIndex,
        ageInput,
        restingHrInput,
        knownMaxHrInput,
        isFemale,
        mafIndex,
        showAdvanced,
        showMethodology,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [
    distanceKey,
    timeInput,
    course,
    xcDifficultyIndex,
    ageInput,
    restingHrInput,
    knownMaxHrInput,
    isFemale,
    mafIndex,
    showAdvanced,
    showMethodology,
  ]);

  // Track races are essentially never run as cross country, so picking one
  // defaults the course to Track / Road — still changeable, since a 2 mile
  // (or similar) XC course does occasionally happen.
  function handleDistanceChange(next: DistanceKey) {
    setDistanceKeyRaw(next);
    const nextOption = DISTANCES.find((d) => d.key === next);
    if (nextOption?.group === "Track") {
      setCourse("track");
    }
  }

  function handleClearSavedData() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore unavailable storage.
    }
    setDistanceKeyRaw("5k");
    setTimeInput("20:00");
    setCourse("xc");
    setXcDifficultyIndex(1);
    setAgeInput("16");
    setRestingHrInput("60");
    setKnownMaxHrInput("");
    setIsFemale(false);
    setMafIndex(2);
    setShowAdvanced(false);
    setShowMethodology(false);
  }

  const selectedDistance = DISTANCES.find((d) => d.key === distanceKey)!;
  const xcAdjustment = XC_ADJUSTMENTS[xcDifficultyIndex].value;
  const knownSeconds = parseTimeToSeconds(timeInput);
  const effectiveSeconds =
    knownSeconds && course === "xc" ? knownSeconds * xcAdjustment : knownSeconds;

  const fiveKSeconds = effectiveSeconds
    ? predictSeconds(selectedDistance.meters, effectiveSeconds, 5000)
    : null;
  const fiveKPace = fiveKSeconds ? fiveKSeconds / (5000 / MILE_METERS) : null;

  // Easy/Tempo/VO2 max are anchored to cross country 5K effort specifically
  // (that's the benchmark the underlying training system is built around),
  // so a track/road entry gets reverse-adjusted — the inverse of the XC
  // adjustment above — before being used for these three.
  const xcAnchorSeconds = knownSeconds
    ? course === "xc"
      ? knownSeconds
      : knownSeconds / xcAdjustment
    : null;
  const xcFiveKSeconds = xcAnchorSeconds
    ? predictSeconds(selectedDistance.meters, xcAnchorSeconds, 5000)
    : null;
  const xcFiveKPace = xcFiveKSeconds
    ? xcFiveKSeconds / (5000 / MILE_METERS)
    : null;

  const marathonSeconds = effectiveSeconds
    ? predictSeconds(selectedDistance.meters, effectiveSeconds, MARATHON_METERS)
    : null;
  const marathonRange = marathonSeconds
    ? marathonRangeSeconds(marathonSeconds, selectedDistance.meters)
    : null;
  const marathonPaceRange: [number, number] | null = marathonRange
    ? [
        marathonRange[0] / (MARATHON_METERS / MILE_METERS),
        marathonRange[1] / (MARATHON_METERS / MILE_METERS),
      ]
    : null;
  const marathonPaceMid = marathonPaceRange
    ? (marathonPaceRange[0] + marathonPaceRange[1]) / 2
    : null;

  const rawPacePerMile = knownSeconds
    ? knownSeconds / (selectedDistance.meters / MILE_METERS)
    : null;
  const rawPacePerKm = knownSeconds
    ? knownSeconds / (selectedDistance.meters / 1000)
    : null;

  const age = Number(ageInput);
  const ageValid = ageInput.trim() !== "" && !Number.isNaN(age) && age > 0;
  const restingHr = Number(restingHrInput);
  const restingHrValid =
    restingHrInput.trim() !== "" && !Number.isNaN(restingHr) && restingHr > 0;
  const knownMaxHr = Number(knownMaxHrInput);
  const knownMaxHrValid =
    knownMaxHrInput.trim() !== "" && !Number.isNaN(knownMaxHr) && knownMaxHr > 0;

  const effectiveMaxHr = knownMaxHrValid
    ? knownMaxHr
    : ageValid
      ? 220 - age
      : null;
  const mafCeiling = ageValid
    ? Math.round(180 - age + MAF_ADJUSTMENTS[mafIndex].value)
    : null;
  const femaleAdj = isFemale ? 3 : 0;

  const hrReady = restingHrValid && effectiveMaxHr !== null;
  const easyHrLabel = hrReady
    ? `${karvonenAt(effectiveMaxHr!, restingHr, 0.6, femaleAdj)}–${karvonenAt(effectiveMaxHr!, restingHr, 0.7, femaleAdj)} bpm`
    : undefined;
  const tempoHrLabel = hrReady
    ? `~${karvonenAt(effectiveMaxHr!, restingHr, 0.8, femaleAdj)} bpm`
    : undefined;
  const marathonHrLabel = hrReady
    ? `~${karvonenAt(effectiveMaxHr!, restingHr, 0.7, femaleAdj)} bpm`
    : undefined;

  const visibleDistances = showAdvanced
    ? DISTANCES
    : DISTANCES.filter((d) => d.core || d.key === distanceKey);

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Pace calculator</p>
        <div className={statCardClass}>
          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor={`${baseId}-distance`} className={labelClass}>
                Recent race distance
              </label>
              <select
                id={`${baseId}-distance`}
                value={distanceKey}
                onChange={(event) =>
                  handleDistanceChange(event.target.value as DistanceKey)
                }
                className={fieldClass}
              >
                {DISTANCE_GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {DISTANCES.filter((d) => d.group === group).map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${baseId}-time`} className={labelClass}>
                Finish time
              </label>
              <input
                id={`${baseId}-time`}
                type="text"
                value={timeInput}
                onChange={(event) => setTimeInput(event.target.value)}
                placeholder="mm:ss or h:mm:ss"
                autoComplete="off"
                className={`w-40 ${fieldClass}`}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-course`} className={labelClass}>
                Course
              </label>
              <select
                id={`${baseId}-course`}
                value={course}
                onChange={(event) => setCourse(event.target.value as Course)}
                className={fieldClass}
              >
                <option value="track">Track / Road</option>
                <option value="xc">Cross Country</option>
              </select>
            </div>
            {course === "xc" && (
              <div className="min-w-0 max-w-full sm:max-w-xs">
                <label
                  htmlFor={`${baseId}-xc-difficulty`}
                  className={labelClass}
                >
                  Course difficulty
                </label>
                <select
                  id={`${baseId}-xc-difficulty`}
                  value={xcDifficultyIndex}
                  onChange={(event) =>
                    setXcDifficultyIndex(Number(event.target.value))
                  }
                  className={`w-full ${fieldClass}`}
                >
                  {XC_ADJUSTMENTS.map((option, index) => (
                    <option key={option.label} value={index}>
                      {option.label} (
                      {Math.round((1 - option.value) * 100)}%)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {!knownSeconds && (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
              Enter a finish time as mm:ss (5K, 10K) or h:mm:ss (half,
              marathon).
            </p>
          )}
          {knownSeconds && course === "xc" && (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
              Cross country times are adjusted about{" "}
              {Math.round((1 - xcAdjustment) * 100)}% faster to estimate
              flat track/road effort before estimating other distances.
              Many flatter, firmer courses may need a smaller adjustment,
              while very difficult courses may need a larger one — still a
              rough rule of thumb, not a precise conversion.
            </p>
          )}
        </div>

        {knownSeconds && rawPacePerMile && rawPacePerKm && (
          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
            Your pace, as run:{" "}
            <span className="font-semibold text-zinc-900 dark:text-white">
              {formatPace(rawPacePerMile)}
            </span>{" "}
            · {formatClock(rawPacePerKm)}/km
          </p>
        )}

        {knownSeconds &&
          effectiveSeconds &&
          fiveKPace &&
          xcFiveKPace &&
          marathonPaceRange &&
          marathonPaceMid && (
            <>
              <p className={`mt-6 ${sectionLabelClass}`}>
                Your running profile
              </p>
              <div className={heroCardClass}>
                <p className={statLabelClass}>Entered performance</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                  {formatClock(knownSeconds)}{" "}
                  {course === "xc" ? "XC " : ""}
                  {selectedDistance.label}
                </p>

                <p className={`mt-5 ${statLabelClass}`}>
                  Estimated equivalent ability
                </p>
                <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    Mile:{" "}
                    {formatClock(
                      predictSeconds(
                        selectedDistance.meters,
                        effectiveSeconds,
                        MILE_METERS,
                      ),
                    )}
                  </p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    10K:{" "}
                    {formatClock(
                      predictSeconds(
                        selectedDistance.meters,
                        effectiveSeconds,
                        10000,
                      ),
                    )}
                  </p>
                </div>

                <p className={`mt-5 ${statLabelClass}`}>
                  What this result suggests
                </p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                  This level of fitness typically points toward building
                  aerobic consistency and durability before adding more
                  intensity — a general starting point, not a diagnosis of
                  what you specifically need.
                </p>
                <Link
                  href="/training-philosophy#five-principles-not-a-formula"
                  className={learnMoreClass}
                >
                  See the guiding principles →
                </Link>

                <SaveCalculationButton
                  calculatorType="pace-calculator"
                  input={{
                    distanceKey,
                    timeInput,
                    course,
                    xcDifficultyIndex,
                    ageInput,
                    restingHrInput,
                    knownMaxHrInput,
                    isFemale,
                    mafIndex,
                  }}
                  output={{
                    milePace: formatClock(
                      predictSeconds(selectedDistance.meters, effectiveSeconds, MILE_METERS),
                    ),
                    tenKPace: formatClock(
                      predictSeconds(selectedDistance.meters, effectiveSeconds, 10000),
                    ),
                    fiveKPace: formatPace(fiveKPace),
                    easyPace: formatPaceValue([xcFiveKPace + 90, xcFiveKPace + 150]),
                    tempoPace: formatPaceValue(xcFiveKPace / 0.93),
                    marathonPaceRange: formatPaceValue(marathonPaceRange),
                  }}
                  label={`${formatClock(knownSeconds)} ${course === "xc" ? "XC " : ""}${selectedDistance.label}`}
                />
              </div>

              <div className="mt-4 rounded-r-xl border-l-4 border-zinc-900/20 bg-zinc-900/[0.02] p-4 dark:border-white/25 dark:bg-white/[0.03]">
                <p className={statLabelClass}>
                  Why this is only a starting point
                </p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                  Two runners can have the same race time and need very
                  different training. This calculator doesn&rsquo;t know
                  your mileage, training history, injury background,
                  goals, or current season phase.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((value) => !value)}
                aria-expanded={showAdvanced}
                className={`mt-6 ${toggleClass}`}
              >
                {showAdvanced ? "Hide" : "Show"} advanced calculations
                <span aria-hidden="true">{showAdvanced ? "↑" : "↓"}</span>
              </button>

              <p className={`mt-6 ${sectionLabelClass}`}>
                Equivalent race times
                {course === "xc" ? " (track/road equivalent)" : ""}
              </p>
              <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-300">
                Useful for sanity-checking a goal time in an event you
                haven&rsquo;t raced recently, or comparing current fitness
                across distances.
              </p>
              <div className="space-y-4">
                {DISPLAY_GROUPS.map((group) => {
                  const items = visibleDistances.filter(
                    (d) => d.displayGroup === group,
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className={groupLabelClass}>{group}</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                        {items.map((d) => {
                          const isEntered = d.key === distanceKey;
                          const cardClass = isEntered
                            ? `${statCardClass} ring-1 ring-inset ring-zinc-900/25 dark:ring-white/25`
                            : statCardClass;
                          if (d.key === "marathon") {
                            const [lo, hi] = marathonRange!;
                            return (
                              <div key={d.key} className={cardClass}>
                                <p className={statLabelClass}>{d.label}</p>
                                <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                                  {formatClock(lo)}–{formatClock(hi)}
                                </p>
                                <p className="mt-0.5 text-[10.5px] text-zinc-600 dark:text-zinc-300">
                                  estimated range
                                </p>
                              </div>
                            );
                          }
                          const seconds = predictSeconds(
                            selectedDistance.meters,
                            effectiveSeconds,
                            d.meters,
                          );
                          return (
                            <div key={d.key} className={cardClass}>
                              <p className={statLabelClass}>{d.label}</p>
                              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                                {formatClock(seconds)}
                              </p>
                              <p className="mt-0.5 text-[10.5px] text-zinc-600 dark:text-zinc-300">
                                estimated
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-6 text-sm text-zinc-700 dark:text-zinc-200">
                Based on this performance, here are estimated training
                paces to use as a reference — not a personalized plan,
                since that also depends on your mileage, history, and
                goals.
              </p>
              <p className={sectionLabelClass}>Training paces</p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ZoneCard
                  label="Easy"
                  paceLabel={formatPaceValue([
                    xcFiveKPace + 90,
                    xcFiveKPace + 150,
                  ])}
                  derivedFrom="= XC 5K pace + 1:30–2:30/mi"
                  splitCaption={formatLapLine(
                    [xcFiveKPace + 90, xcFiveKPace + 150],
                    [400, 800],
                  )}
                  hrLabel={easyHrLabel}
                  description="Conversational and relaxed. You should finish feeling like you could have kept going."
                  learnMoreHref="/the-aerobic-base#60-000-miles-of-plumbing"
                  learnMoreLabel="Why easy runs matter →"
                  showDetails={showAdvanced}
                />
                <ZoneCard
                  label="Tempo / Threshold"
                  paceLabel={formatPaceValue(xcFiveKPace / 0.93)}
                  derivedFrom="= XC 5K pace ÷ 0.93"
                  splitCaption={formatLapLine([xcFiveKPace / 0.93], [400, 800])}
                  hrLabel={tempoHrLabel}
                  description="Comfortably hard — controlled and sustainable, never all-out. Roughly a 6-out-of-10 effort."
                  learnMoreHref="/workout-library#dialing-in-a-tempo-run"
                  showDetails={showAdvanced}
                />
                <ZoneCard
                  label="VO2-oriented reps"
                  paceLabel={formatPaceValue(xcFiveKPace)}
                  derivedFrom="= XC 5K pace"
                  splitCaption={formatLapLine(
                    [xcFiveKPace],
                    [400, 800, 1000],
                  )}
                  hrNote="Max effort — heart rate lags behind pace on reps this short, so trust the pace and how it feels over a number."
                  description="Hard but controlled, not an all-out sprint. Pace alone doesn't determine the adaptation — rep length and recovery matter just as much as the number on the watch."
                  learnMoreHref="/5k-training#vo2-max-intervals"
                  showDetails={showAdvanced}
                />
                <ZoneCard
                  label="Marathon"
                  paceLabel={formatPaceValue(marathonPaceRange)}
                  hrLabel={marathonHrLabel}
                  description="Steady and controlled — a pace you could defend from mile 1 to mile 26, not just survive. Requires marathon-specific training, not just current fitness."
                  learnMoreHref="/marathon-training#racing-the-last-25"
                  showDetails={showAdvanced}
                />
              </div>

              {showAdvanced && (
                <div className="mt-6 overflow-x-auto">
                  <p className={sectionLabelClass}>Workout pace reference</p>
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-black/10 dark:border-white/10">
                        <th className="py-2 pr-3 text-left font-semibold text-zinc-900 dark:text-white">
                          Split
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">
                          Easy
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">
                          Threshold
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">
                          VO2-oriented
                        </th>
                        <th className="py-2 pl-3 text-right font-semibold text-zinc-900 dark:text-white">
                          Marathon
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-700 dark:text-zinc-200">
                      {SPLIT_METERS.map((meters) => (
                        <tr
                          key={meters}
                          className="border-b border-black/5 dark:border-white/5"
                        >
                          <td className="py-1.5 pr-3 text-zinc-600 dark:text-zinc-300">
                            {meters === 1600 ? "1600m / Mile" : `${meters}m`}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {formatSplit(xcFiveKPace + 120, meters)}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {formatSplit(xcFiveKPace / 0.93, meters)}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {formatSplit(xcFiveKPace, meters)}
                          </td>
                          <td className="py-1.5 pl-3 text-right">
                            {formatSplit(marathonPaceMid, meters)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[10.5px] text-zinc-600 dark:text-zinc-300">
                    Easy uses the middle of your easy-pace range. Marathon
                    uses the middle of its estimated range.
                  </p>
                </div>
              )}
            </>
          )}
      </div>

      <div>
        <p className={sectionLabelClass}>Heart rate calculator</p>
        <div className={statCardClass}>
          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor={`${baseId}-age`} className={labelClass}>
                Age
              </label>
              <input
                id={`${baseId}-age`}
                type="number"
                min={1}
                value={ageInput}
                onChange={(event) => setAgeInput(event.target.value)}
                className={`w-20 ${fieldClass}`}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-resting`} className={labelClass}>
                Resting HR (optional)
              </label>
              <input
                id={`${baseId}-resting`}
                type="number"
                min={1}
                value={restingHrInput}
                onChange={(event) => setRestingHrInput(event.target.value)}
                className={`w-32 ${fieldClass}`}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-maxhr`} className={labelClass}>
                Known max HR (optional)
              </label>
              <input
                id={`${baseId}-maxhr`}
                type="number"
                min={1}
                value={knownMaxHrInput}
                onChange={(event) => setKnownMaxHrInput(event.target.value)}
                placeholder="e.g. 198"
                className={`w-28 ${fieldClass}`}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-sex`} className={labelClass}>
                Sex
              </label>
              <select
                id={`${baseId}-sex`}
                value={isFemale ? "female" : "male"}
                onChange={(event) =>
                  setIsFemale(event.target.value === "female")
                }
                className={fieldClass}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="min-w-[240px] flex-1">
              <label htmlFor={`${baseId}-maf`} className={labelClass}>
                Training and health status
              </label>
              <select
                id={`${baseId}-maf`}
                value={mafIndex}
                onChange={(event) => setMafIndex(Number(event.target.value))}
                className={`w-full ${fieldClass}`}
              >
                {MAF_ADJUSTMENTS.map((option, index) => (
                  <option key={option.label} value={index}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {knownMaxHrValid && (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
              Using your entered max HR instead of the 220-minus-age estimate
              everywhere below.
            </p>
          )}
        </div>

        {(ageValid || knownMaxHrValid) && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={statCardClass}>
              <p className={statLabelClass}>
                {knownMaxHrValid ? "Max HR" : "Max HR estimate"}
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                {effectiveMaxHr}{" "}
                <span className="text-sm font-normal text-zinc-600 dark:text-zinc-300">
                  bpm
                </span>
              </p>
            </div>
            {ageValid && (
              <div className={statCardClass}>
                <p className={statLabelClass}>
                  Aerobic training ceiling (MAF estimate)
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                  {mafCeiling}{" "}
                  <span className="text-sm font-normal text-zinc-600 dark:text-zinc-300">
                    bpm
                  </span>
                </p>
                <Link
                  href="/coaching-library#phil-maffetone-the-maf-method"
                  className={learnMoreClass}
                >
                  Read the science →
                </Link>
              </div>
            )}
            {restingHrValid &&
              effectiveMaxHr !== null &&
              EFFORT_LEVELS.map((effort) => (
                <div key={effort.label} className={statCardClass}>
                  <p className={statLabelClass}>
                    {effort.label} ({Math.round(effort.pct * 100)}% HRR)
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                    {karvonenAt(effectiveMaxHr, restingHr, effort.pct, femaleAdj)}{" "}
                    <span className="text-sm font-normal text-zinc-600 dark:text-zinc-300">
                      bpm
                    </span>
                  </p>
                </div>
              ))}
          </div>
        )}
        {(ageValid || knownMaxHrValid) && !restingHrValid && (
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
            Add a resting heart rate to also see Karvonen training targets at
            a few common efforts.
          </p>
        )}
        {(ageValid || knownMaxHrValid) && restingHrValid && (
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
            Give yourself about five beats on either side of each target —
            see{" "}
            <Link
              href="/training-plans#finding-your-training-heart-rate"
              className="underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
            >
              Training Plans
            </Link>{" "}
            for the full Karvonen formula.
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowMethodology((value) => !value)}
          aria-expanded={showMethodology}
          className="flex items-center gap-2 py-1 text-lg font-semibold text-zinc-900 dark:text-white"
        >
          Behind the calculator: formulas, assumptions, and limitations
          <span aria-hidden="true" className="text-sm font-normal">
            {showMethodology ? "↑" : "↓"}
          </span>
        </button>
        {showMethodology && (
          <div className="mt-4 max-w-[64ch] space-y-2">
            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Race prediction formula
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Equivalent race times use Pete Riegel&rsquo;s endurance
                  formula —{" "}
                  <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">
                    T2 = T1 × (D2/D1)^1.06
                  </code>{" "}
                  — built from an analysis of world records spanning 100
                  meters to 100 miles.<sup>1</sup> It&rsquo;s most reliable
                  comparing distances of a similar character, roughly 5K
                  through the marathon. Bridging all the way down to the
                  mile is less reliable, since that crosses from a race
                  that&rsquo;s meaningfully anaerobic into one that&rsquo;s
                  almost entirely aerobic — a runner whose speed and
                  endurance aren&rsquo;t in the &ldquo;average&rdquo; ratio
                  the formula assumes will see the mile estimate miss by
                  more than the others. The marathon estimate is shown as a
                  range rather than a single number for the same reason,
                  widened further the shorter the entered race is.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Cross country adjustment
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Selecting Cross Country adjusts the entered time faster
                  before estimating anything else, using whichever course
                  difficulty is selected — 3% for a flat, firm, fast course
                  up to 10% for a very hilly, muddy, or technical one, with
                  5% (average hills and footing) as the default. This is
                  still a common coaching rule of thumb for translating
                  grass, turns, and hills into an equivalent flat effort,
                  not a precise conversion — nobody can reduce a specific
                  course to one number with real accuracy, but a runner who
                  knows their course was unusually tough or unusually fast
                  can dial the estimate in better than a single fixed
                  percentage would. Every row in the equivalent-times
                  table, including the one matching your entered distance
                  (outlined), shows that flat track/road estimate;
                  &ldquo;Your pace, as run&rdquo; above is the only number
                  that reflects your literal, unadjusted time.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Training pace calculations
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Training paces (Easy, Tempo/Threshold, VO2-oriented
                  reps) are anchored to cross country 5K effort
                  specifically, since that&rsquo;s the benchmark the
                  underlying training system was built around: easy pace
                  is XC 5K pace plus 1:30–2:30 per mile, tempo/threshold
                  pace is XC 5K pace divided by 0.93, and VO2-oriented
                  reps are run at XC 5K pace itself — though the actual
                  adaptation from those reps depends on rep length and
                  recovery too, not pace alone. A track or road entry is
                  reverse-adjusted into an estimated XC-effort 5K pace
                  first, so the paces come out slightly more conservative
                  than if they were built from the flat-equivalent number
                  above. Marathon pace and the equivalent-race-times table
                  use flat track/road-equivalent fitness instead, since
                  marathon racing itself is a road event. Splits under
                  600m are shown in whole seconds, matching how
                  they&rsquo;re actually called out on the track; 600m and
                  up switch to minutes:seconds.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Heart rate calculations
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Max heart rate uses the standard 220-minus-age population
                  estimate unless a known max HR is entered, in which case
                  that real number replaces it everywhere on this page — a
                  measured or race-tested value is always more trustworthy
                  than a population formula. The aerobic training ceiling
                  uses Maffetone&rsquo;s MAF Method (180 minus age,
                  adjusted for training and health history) — a specific,
                  somewhat controversial system, not a consensus number,
                  which is why it&rsquo;s labeled as an estimate. The
                  effort-based targets use the Karvonen formula, extended
                  across a few common intensities. The heart-rate ranges
                  next to each pace zone are approximate — heart rate
                  responds more slowly than pace, especially on short hard
                  efforts, so treat pace and effort as the primary targets
                  and heart rate as a secondary check.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Limitations
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Every number here is a starting point, not a verdict —
                  test it against how the effort actually feels, and let
                  feel win when the two disagree. Two runners with the
                  same recent race time but very different training
                  histories shouldn&rsquo;t run the same week, and this
                  page has no way to know that difference — it only knows
                  the one result you entered.
                </p>
                <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
                  <h3 className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                    Sources
                  </h3>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs">
                    <li>
                      Riegel,{" "}
                      <a
                        href="https://pubmed.ncbi.nlm.nih.gov/7235349/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                      >
                        Athletic Records and Human Endurance
                      </a>
                      , <em>American Scientist</em>, Vol. 69, No. 3 (1981)
                      — source of the race-time prediction formula used
                      here.
                    </li>
                  </ol>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

      <div className={`${statCardClass} text-center`}>
        <p className="text-sm text-zinc-700 dark:text-zinc-200">
          Want a training plan built around your goals, mileage, schedule,
          and training history?
        </p>
        <button
          type="button"
          disabled
          title="Personalized training plans are coming soon"
          className="mt-4 inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-black/5 px-5 py-2.5 text-sm font-semibold text-zinc-400 dark:bg-white/5 dark:text-zinc-500"
        >
          Coming Soon
        </button>
        <p className="mt-4 border-t border-black/10 pt-4 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-300">
          Or browse the{" "}
          <Link
            href="/training-plans"
            className="underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
          >
            Training Plans
          </Link>
          ,{" "}
          <Link
            href="/workout-library"
            className="underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
          >
            Workout Library
          </Link>
          , or{" "}
          <Link
            href="/coaching-library"
            className="underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
          >
            Coaching Library
          </Link>
          .
        </p>
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Training on hills or a treadmill incline? The{" "}
        <Link
          href="/gap-calculator"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          GAP Calculator
        </Link>{" "}
        finds the flat-ground effort a grade was really worth.
      </p>

      <p className="border-t border-black/10 pt-4 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-300">
        Formulas: Riegel endurance equation, adjusted for cross country by a
        common coaching rule of thumb · training paces per 5K Training ·
        heart-rate ceilings per Training Plans and Coaching Library · Your
        inputs are remembered on this device only · No data is sent or
        stored anywhere else.{" "}
        <button
          type="button"
          onClick={handleClearSavedData}
          className="underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Clear saved data
        </button>
      </p>
    </div>
  );
}
