import {
  formatResolvedPaceText,
  PACE_REFERENCE_LABELS,
  type PaceReferenceKey,
  type ResolvedPaceReference,
} from "./pace-reference";
import { formatPacePercentRange, formatPaceRange } from "./workout-distance";

// Pure logic behind workout_template_steps / scheduled_workout_steps --
// both tables share this exact shape (see the Phase 1 migration's own
// comment on why scheduled_workout_steps is a copy, not a live reference).

export type WorkoutStepType = "warmup" | "main" | "interval" | "recovery" | "cooldown";
export type WorkoutTargetType = "pace" | "heart_rate" | "power" | "rpe" | "duration" | "distance" | "open";

export const WORKOUT_STEP_TYPES: WorkoutStepType[] = ["warmup", "main", "interval", "recovery", "cooldown"];
export const WORKOUT_TARGET_TYPES: WorkoutTargetType[] = [
  "pace",
  "heart_rate",
  "power",
  "rpe",
  "duration",
  "distance",
  "open",
];

export const WORKOUT_STEP_TYPE_LABELS: Record<WorkoutStepType, string> = {
  warmup: "Warmup",
  main: "Main",
  interval: "Interval",
  recovery: "Recovery",
  cooldown: "Cooldown",
};

export const WORKOUT_TARGET_TYPE_LABELS: Record<WorkoutTargetType, string> = {
  pace: "Pace",
  heart_rate: "Heart rate",
  power: "Power",
  rpe: "RPE",
  duration: "Duration",
  distance: "Distance",
  open: "Open (no specific target)",
};

export type StepInput = {
  stepType: WorkoutStepType;
  durationS: number | null;
  // Nullable, min-only-is-a-point-value / min+max-is-a-range -- mirrors
  // scheduled_workouts.planned_distance_m/_max_m exactly (see the
  // step_ranges migration), so a warmup or cooldown can say "15-20min" or
  // "1-2mi" the same way the workout-level fields already can.
  durationMaxS: number | null;
  distanceM: number | null;
  distanceMaxM: number | null;
  targetType: WorkoutTargetType;
  targetMin: number | null;
  targetMax: number | null;
  targetUnit: string | null;
  // Set only when targetType is "pace" -- mutually exclusive with
  // targetMin/targetMax at the DB level (see the pace_reference migration).
  // This field always round-trips through the editor as whatever's
  // actually stored; it is NEVER overwritten with a resolved number here
  // -- resolution happens downstream, in the calendar/detail read path
  // only, via separate additive fields (see calendar-data.ts). Confusing
  // this field's own value with a resolved one is exactly the bug that
  // would silently turn "genuinely live" into "baked in at edit time."
  targetPaceReference: PaceReferenceKey | null;
  // Percent-of-a-reference-pace at the step level (e.g. a Kenyan
  // Progression's later reps running faster than its earlier ones) --
  // optional because only program_day_steps (Programs, see
  // program-generation.ts) ever populates these; workout_templates/
  // scheduled_workout_steps have no matching DB columns and simply never
  // set them (left undefined, not persisted). Mutually exclusive with
  // targetPaceReference and a fixed targetMin/targetMax, same as the day-
  // level pacePercentBasis/Min/Max trio.
  targetPacePercentBasis?: PaceReferenceKey | null;
  targetPacePercentMin?: number | null;
  targetPacePercentMax?: number | null;
  repetitions: number | null;
  // Nullable, min-only-is-a-point-value / min+max-is-a-range -- mirrors
  // durationMaxS/distanceMaxM above, for the same reason: several real
  // prescriptions give a rep-count or rest-interval RANGE ("6-7 x 3 min",
  // "10-12 x 500m w/ 30-45 sec walk"), not always a fixed point value.
  repetitionsMax: number | null;
  restS: number | null;
  restMaxS: number | null;
  instructions: string | null;
};

export function emptyStep(stepType: WorkoutStepType = "main"): StepInput {
  return {
    stepType,
    durationS: null,
    durationMaxS: null,
    distanceM: null,
    distanceMaxM: null,
    targetType: "open",
    targetMin: null,
    targetMax: null,
    targetUnit: null,
    targetPaceReference: null,
    targetPacePercentBasis: null,
    targetPacePercentMin: null,
    targetPacePercentMax: null,
    repetitions: null,
    repetitionsMax: null,
    restS: null,
    restMaxS: null,
    instructions: null,
  };
}

// The two pace units this schema actually resolves specially (see
// resolveAthleteVariables' formatMetricValue below) -- a pace target in
// either reads as a clock time ("6:30/mi"), not a raw seconds count.
// Anything else (a legacy row with some other unit string, or none at
// all) falls back to the plain numeric rendering below rather than
// guessing at a format.
const PACE_UNIT_SUFFIXES: Record<string, string> = {
  sec_per_mile: "/mi",
  sec_per_km: "/km",
};

function formatClockShort(totalSeconds: number): string {
  const rounded = Math.round(Math.max(0, totalSeconds));
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// A short, human-readable one-liner for a step -- used in the coach's
// template/schedule list views (and Month View's own condensed chips) so
// a whole workout's shape is scannable without opening the full editor.
// `resolvedPaceReference` is the caller's already-resolved value for
// whichever of step.targetPaceReference / step.targetPacePercentBasis is
// actually set on this step (the two are mutually exclusive at the DB
// layer, same as the workout-level pace_reference/pace_percent_basis pair
// -- see calendar-data.ts's own stepPaceReferences, which already resolves
// both cases into one array via resolvePaceReference/resolvePacePercent
// before this function ever sees it) -- this function stays pure and never
// resolves anything itself. Three distinct states, not two:
//   - omitted entirely (undefined): resolution doesn't even apply here --
//     a template's own list view, which is athlete-agnostic and can never
//     resolve a reference to a number -- renders the bare reference/percent
//     label ("Threshold Pace", "95% 5K Pace"), never a misleading "no race
//     on file yet."
//   - explicit null: resolution WAS attempted for a real athlete and came
//     back empty (no race result or fitness estimate on file yet) -- shows
//     that state honestly.
//   - a ResolvedPaceReference: shows the resolved pace + label.
//
// Previously, the targetPacePercentBasis case had no branch here at all --
// a percent target was silently dropped from the summary entirely (the
// function fell through to the bare step-type label, e.g. "Main" instead
// of "6-7x 3min @ 90% 5K Pace").
export function summarizeStep(step: StepInput, resolvedPaceReference?: ResolvedPaceReference | null): string {
  const parts: string[] = [];
  if (step.repetitions && step.repetitions > 1) {
    parts.push(
      step.repetitionsMax && step.repetitionsMax !== step.repetitions ? `${step.repetitions}-${step.repetitionsMax}x` : `${step.repetitions}x`,
    );
  }
  if (step.distanceM) {
    const minMi = (step.distanceM / 1609.344).toFixed(2).replace(/\.?0+$/, "");
    const maxMi = step.distanceMaxM ? (step.distanceMaxM / 1609.344).toFixed(2).replace(/\.?0+$/, "") : null;
    parts.push(maxMi && maxMi !== minMi ? `${minMi}-${maxMi}mi` : `${minMi}mi`);
  } else if (step.durationS) {
    const formatMin = (s: number) => (s / 60).toFixed(1).replace(/\.0$/, "");
    const minMin = formatMin(step.durationS);
    const maxMin = step.durationMaxS ? formatMin(step.durationMaxS) : null;
    parts.push(maxMin && maxMin !== minMin ? `${minMin}-${maxMin}min` : `${minMin}min`);
  }
  if (step.targetPacePercentBasis && step.targetPacePercentMin != null) {
    const percentText = formatPacePercentRange(step.targetPacePercentMin, step.targetPacePercentMax ?? step.targetPacePercentMin);
    const label = `${percentText} ${PACE_REFERENCE_LABELS[step.targetPacePercentBasis]}`;
    parts.push(`@ ${resolvedPaceReference === undefined ? label : formatResolvedPaceText(resolvedPaceReference, label)}`);
  } else if (step.targetPaceReference) {
    const label = PACE_REFERENCE_LABELS[step.targetPaceReference];
    parts.push(`@ ${resolvedPaceReference === undefined ? label : formatResolvedPaceText(resolvedPaceReference, label)}`);
  } else if (step.targetType !== "open" && (step.targetMin || step.targetMax)) {
    const paceSuffix = step.targetType === "pace" && step.targetUnit ? PACE_UNIT_SUFFIXES[step.targetUnit] : undefined;
    if (paceSuffix) {
      if (step.targetMin && step.targetMax && step.targetMin !== step.targetMax) {
        parts.push(`@ ${formatClockShort(step.targetMin)}-${formatClockShort(step.targetMax)}${paceSuffix}`);
      } else {
        parts.push(`@ ${formatClockShort(step.targetMin ?? step.targetMax!)}${paceSuffix}`);
      }
    } else {
      const unit = step.targetUnit ? ` ${step.targetUnit}` : "";
      if (step.targetMin && step.targetMax && step.targetMin !== step.targetMax) {
        parts.push(`@ ${step.targetMin}-${step.targetMax}${unit}`);
      } else {
        parts.push(`@ ${step.targetMin ?? step.targetMax}${unit}`);
      }
    }
  }
  if (step.restS) {
    parts.push(
      step.restMaxS && step.restMaxS !== step.restS
        ? `${Math.round(step.restS)}-${Math.round(step.restMaxS)}s rest`
        : `${Math.round(step.restS)}s rest`,
    );
  }
  return parts.length > 0 ? parts.join(" ") : WORKOUT_STEP_TYPE_LABELS[step.stepType];
}

// A workout day's single headline pace line -- distinct from summarizeStep's
// per-step rendering (which embeds "@ 5:32/mi (5K Pace)" inline in a
// sentence). The day headline leads with the relative expression a coach
// actually wrote, then the resolved number, e.g. "100% 5K Pace · 5:32/mi".
// Previously the detail page only ever resolved the pace_reference case --
// a pace_percent_basis workout (a Programs-generated "95% 5k") fell through
// to a blank formatPaceRange(null, null) even though resolution itself was
// already computed correctly for both modes (see page.tsx's
// resolvedWorkoutPace). `resolved` is null in exactly two situations this
// function can't tell apart on its own (by design -- the caller already
// knows which, from whether a race/estimate exists at all): no reference
// data on file yet, or a reference that legitimately resolves to nothing.
// Either way, the honest fallback is the same: show the relative expression
// plus an actionable nudge, never a blank line or a fabricated number.
export type DayPaceReference =
  | { kind: "race"; key: PaceReferenceKey }
  | { kind: "percent"; basis: PaceReferenceKey; min: number; max: number };

export type DayPaceSummary = { text: string | null; nudge: string | null; nudgeHref: string | null };

export function summarizeDayPace(
  reference: DayPaceReference | null,
  resolved: { minSPerMi: number; maxSPerMi: number | null } | null,
  fixedPaceMinSPerMi: number | null,
  fixedPaceMaxSPerMi: number | null,
): DayPaceSummary {
  if (!reference) {
    return { text: formatPaceRange(fixedPaceMinSPerMi, fixedPaceMaxSPerMi), nudge: null, nudgeHref: null };
  }
  const label =
    reference.kind === "race"
      ? PACE_REFERENCE_LABELS[reference.key]
      : `${formatPacePercentRange(reference.min, reference.max)} ${PACE_REFERENCE_LABELS[reference.basis]}`;
  if (resolved) {
    return { text: `${label} · ${formatPaceRange(resolved.minSPerMi, resolved.maxSPerMi)}`, nudge: null, nudgeHref: null };
  }
  return reference.kind === "race"
    ? { text: label, nudge: "Add a recent race result in Settings to see your target paces.", nudgeHref: "/settings#race-results" }
    : {
        text: label,
        nudge: `Add a ${PACE_REFERENCE_LABELS[reference.basis].replace(/ Pace$/, "")} estimate in Settings to see your target paces.`,
        nudgeHref: "/settings#fitness-estimates",
      };
}

function rangeError(min: number | null, max: number | null, label: string): string | null {
  if (max != null && min == null) return `Enter a minimum ${label} before a maximum.`;
  if (max != null && min != null && max < min) return `A step's maximum ${label} can't be less than its minimum.`;
  return null;
}

// Per-step range validation -- mirrors the top-level distance/duration/
// pace/HR/RPE range rule (validateDistanceRange etc. in
// workout-distance.ts): max requires min, max can't be less than min.
// One place this runs so saveScheduledWorkout and saveTemplate (the two
// callers) can't drift into checking it differently, or one of them
// skipping it entirely -- the DB's own range CHECK constraints are the
// real backstop either way.
export function validateStepRanges(steps: StepInput[]): { valid: true } | { valid: false; error: string } {
  for (const step of steps) {
    const distanceError = rangeError(step.distanceM, step.distanceMaxM, "distance");
    if (distanceError) return { valid: false, error: distanceError };
    const durationError = rangeError(step.durationS, step.durationMaxS, "duration");
    if (durationError) return { valid: false, error: durationError };
    if (step.targetType !== "open") {
      const targetError = rangeError(step.targetMin, step.targetMax, "target");
      if (targetError) return { valid: false, error: targetError };
    }
    const repetitionsError = rangeError(step.repetitions, step.repetitionsMax, "repetitions");
    if (repetitionsError) return { valid: false, error: repetitionsError };
    const restError = rangeError(step.restS, step.restMaxS, "rest");
    if (restError) return { valid: false, error: restError };
  }
  return { valid: true };
}

// @athlete.<key> substitution -- the mechanism the product brief asks for
// so a coach can write a template once ("@athlete.threshold_pace") and
// have it resolve per-athlete at scheduling time (see athlete_metrics).
// Deliberately conservative: an unresolvable placeholder (no matching
// metric on file) is left untouched rather than silently dropped, so a
// coach reviewing a scheduled workout can tell a variable didn't resolve.
export type AthleteMetricLookup = Record<string, { value: number; unit: string }>;

const VARIABLE_PATTERN = /@athlete\.([a-zA-Z0-9_]+)/g;

function formatMetricValue(value: number, unit: string): string {
  if (unit === "sec_per_mile" || unit === "sec_per_km") {
    const min = Math.floor(value / 60);
    const sec = Math.round(value % 60);
    const perUnit = unit === "sec_per_mile" ? "/mi" : "/km";
    return `${min}:${sec.toString().padStart(2, "0")}${perUnit}`;
  }
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export function resolveAthleteVariables(text: string, metrics: AthleteMetricLookup): string {
  return text.replace(VARIABLE_PATTERN, (match, key: string) => {
    const metric = metrics[key];
    if (!metric) return match;
    return formatMetricValue(metric.value, metric.unit);
  });
}

// Which @athlete.<key> variables a piece of text references -- used to
// warn a coach at scheduling time if a template references a metric the
// athlete doesn't have on file yet, before resolveAthleteVariables quietly
// leaves it unresolved.
export function referencedVariableKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const match of text.matchAll(VARIABLE_PATTERN)) keys.add(match[1]);
  return [...keys];
}
