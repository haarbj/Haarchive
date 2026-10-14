import { MILE_METERS } from "@/lib/race-distances";
import { formatMiles } from "@/lib/format";
import { formatClock } from "@/lib/running-format";

// Deliberately NOT derived from scheduled_workout_steps. A duration-only
// step (a "20-minute tempo effort" with distanceM null) has no distance to
// sum, and guessing one from pace would be fabricating data, not reading
// it -- see the calendar-rebuild plan's own reasoning. A structured
// workout with no top-level distance shows its existing summarizeStep
// text on the calendar instead of a number; the weekly total simply
// omits it rather than estimating.
//
// Callers sum this (raw meters) across a week's workouts and format the
// total once via format.ts's existing formatMiles -- there's no separate
// meters->miles helper here since formatMiles already does that
// conversion; summing pre-rounded "X.X mi" strings instead of raw meters
// is exactly the rounding-drift mistake to avoid.
export function getWorkoutPlannedDistanceM(plannedDistanceM: number | null): number | null {
  return plannedDistanceM;
}

// A stored distance was rounded to the nearest meter on save
// (Math.round(miles * MILE_METERS)), so dividing straight back never lands
// on a clean "4" for a coach who typed exactly 4 -- it lands on something
// like 3.9997663644317187 (caught live: a coach re-opening a workout they'd
// entered as "4-6 mi" saw that instead). Round to 2dp for editing, matching
// StepsEditor's own existing distance-input precedent -- a coach re-editing
// should see the same clean number they typed, not raw float noise.
export function metersToMilesInput(m: number | null): string {
  return m != null ? (m / MILE_METERS).toFixed(2) : "";
}

// Companion to metersToMilesInput for the duration side -- whole minutes,
// matching the granularity a coach actually types at the top level (same
// convention as StepsEditor's own "Duration (min)" field).
export function secondsToMinutesInput(s: number | null): string {
  return s != null ? String(Math.round(s / 60)) : "";
}

// Pace reads naturally as a clock ("7:30"), not raw seconds or decimal
// minutes -- reuses running-format.ts's own formatClock/parseTimeToSeconds
// (the same mm:ss parser every other pace-entry tool on this site already
// uses) rather than inventing a third time-parsing convention.
export function secondsToPaceInput(s: number | null): string {
  return s != null ? formatClock(s) : "";
}

// min-only -> point value; min+max -> range; both null -> nothing to show.
// Shared by the calendar card and the workout detail page so the two
// never render this differently.
export function formatDistanceRange(minM: number | null, maxM: number | null): string | null {
  if (minM == null) return null;
  if (maxM == null || maxM === minM) return formatMiles(minM);
  return `${(minM / MILE_METERS).toFixed(1)}–${(maxM / MILE_METERS).toFixed(1)} mi`;
}

// "6-8mi", not "6.0–8.0 mi" -- the same value formatDistanceRange
// produces, just terser: a whole number drops its decimal, a genuinely
// fractional one keeps it ("4-5.5mi"), and there's no space before the
// unit. For density-constrained surfaces (Month View's day cells,
// WeekStrip's adjacent-week summaries) where formatDistanceRange's own
// one-decimal/spaced convention costs real room without adding meaning.
function formatCompactMiles(m: number): string {
  return (m / MILE_METERS).toFixed(1).replace(/\.0$/, "");
}
export function formatCompactDistanceRange(minM: number | null, maxM: number | null): string | null {
  if (minM == null) return null;
  if (maxM == null || maxM === minM) return `${formatCompactMiles(minM)}mi`;
  return `${formatCompactMiles(minM)}-${formatCompactMiles(maxM)}mi`;
}

// A time-based prescription ("45-60 min easy") is just as common as a
// distance-based one, especially for shorter or less experienced athletes
// -- the top-level quick-create fields only ever accepted distance, which
// forced anyone coaching by time onto the full Steps editor just to say
// "45 minutes." Whole minutes, not mm:ss clock format: that's the
// granularity a coach actually types at the top level (matching
// StepsEditor's own "Duration (min)" field), and "45-60 min" reads more
// naturally than "45:00-60:00" for a plain time range.
export function formatDurationRange(minS: number | null, maxS: number | null): string | null {
  if (minS == null) return null;
  const minMinutes = Math.round(minS / 60);
  if (maxS == null || maxS === minS) return `${minMinutes} min`;
  const maxMinutes = Math.round(maxS / 60);
  return `${minMinutes}–${maxMinutes} min`;
}

// Mirrors formatDistanceRange/formatDurationRange for pace -- min-only is
// a point value, min+max is a range.
export function formatPaceRange(minSPerMi: number | null, maxSPerMi: number | null): string | null {
  if (minSPerMi == null) return null;
  if (maxSPerMi == null || maxSPerMi === minSPerMi) return `${formatClock(minSPerMi)}/mi`;
  return `${formatClock(minSPerMi)}–${formatClock(maxSPerMi)}/mi`;
}

// Mirrors formatPaceRange for a program_days/program_day_steps
// pace_percent_min/max pair -- an exact target (e.g. Canyon's own "100%
// 5k") stores min === max (both columns are always set together, see
// validatePacePercentRange below), and reads as a single "100%", never a
// degenerate "100-100%" range.
export function formatPacePercentRange(min: number | null, max: number | null): string | null {
  if (min == null || max == null) return null;
  if (max === min) return `${min}%`;
  return `${min}–${max}%`;
}

export type RangeValidation = { valid: true } | { valid: false; error: string };

// The same invariants apply whether it's distance or duration: min-only is
// a point value, min+max is a range, a max without a min or a max below
// the min are both invalid. Shared so the two never drift into slightly
// different rules or wording.
function validateRange(min: number | null, max: number | null, label: string): RangeValidation {
  if (max != null && min == null) return { valid: false, error: `Enter a minimum ${label} before a maximum.` };
  if (max != null && min != null && max < min) {
    return { valid: false, error: `Maximum ${label} can't be less than the minimum.` };
  }
  return { valid: true };
}

// Checked here first so a coach gets a real error message instead of a raw
// constraint-violation string -- the exact same invariants
// scheduled_workouts_distance_range_valid enforces at the DB layer (see
// the migration).
export function validateDistanceRange(minM: number | null, maxM: number | null): RangeValidation {
  return validateRange(minM, maxM, "distance");
}

// Mirrors validateDistanceRange -- scheduled_workouts_duration_range_valid
// is the DB-layer backstop (see the planned-duration migration).
export function validateDurationRange(minS: number | null, maxS: number | null): RangeValidation {
  return validateRange(minS, maxS, "duration");
}

// Mirrors validateDistanceRange -- scheduled_workouts_pace_range_valid is
// the DB-layer backstop (see the planned-pace/HR/RPE migration).
export function validatePaceRange(minSPerMi: number | null, maxSPerMi: number | null): RangeValidation {
  return validateRange(minSPerMi, maxSPerMi, "pace");
}

export function validateHrRange(minBpm: number | null, maxBpm: number | null): RangeValidation {
  return validateRange(minBpm, maxBpm, "heart rate");
}

// A Program's own overview mileage range (initial/peak weekly mileage,
// e.g. "25-34 mi/wk") -- real weekly miles, not a per-workout meters
// figure, so this stays independent of formatDistanceRange/
// validateDistanceRange above. Mirrors the same min-only-is-a-point-value
// invariant every other range field on this platform already follows.
export function validateWeeklyMileageRange(minMiles: number | null, maxMiles: number | null): RangeValidation {
  return validateRange(minMiles, maxMiles, "mileage");
}

// RPE additionally has to sit on Foster's 1-10 scale (the same bound the
// DB itself enforces on every other rpe column in this schema, e.g.
// completed_workouts.rpe) -- checked here first, same reasoning as the
// range invariant above.
export function validateRpeRange(min: number | null, max: number | null): RangeValidation {
  if (min != null && (min < 1 || min > 10)) return { valid: false, error: "RPE runs from 1-10." };
  if (max != null && (max < 1 || max > 10)) return { valid: false, error: "RPE runs from 1-10." };
  return validateRange(min, max, "RPE");
}

// Percent-of-a-reference-pace, used only by program_days/program_day_steps
// (see program-generation.ts's own header comment on why this is scoped to
// Programs, not scheduled_workouts/workout_templates). Also requires both
// bounds be filled in together, unlike distance/duration/pace/HR above
// where a min-only value is a valid point value -- a percent RANGE is the
// whole point here (an exact percent is just min === max), so a lone bound
// is always a data-entry mistake, never a legitimate open-ended value.
// 1-300 matches the same percent bound the Pace Percent Calculator and
// pace-zone-table already enforce (pace-percent-math.ts).
export function validatePacePercentRange(min: number | null, max: number | null): RangeValidation {
  if ((min == null) !== (max == null)) return { valid: false, error: "Enter both a low and high percent." };
  if (min == null || max == null) return { valid: true };
  if (min < 1 || min > 300 || max < 1 || max > 300) return { valid: false, error: "Percent must be between 1 and 300." };
  return validateRange(min, max, "percent");
}

// Distance, duration, and pace are mathematically linked -- pace is
// duration per mile, so any two of the three fix the third
// (pace = duration / distance). Heart rate and RPE aren't part of this:
// there's no formula linking perceived effort or heart rate to a pace
// without athlete-specific physiology this form doesn't have, so they
// stay independent, freestanding target ranges (see Data & Analytics'
// "Three Layers of Measurement" -- external workload, physiological
// response, and perceived effort are three separate signals, not one
// derived from another).
export function paceSPerMiFromDistanceDuration(distanceM: number, durationS: number): number {
  return durationS / (distanceM / MILE_METERS);
}
export function durationSFromDistancePace(distanceM: number, paceSPerMi: number): number {
  return (distanceM / MILE_METERS) * paceSPerMi;
}
export function distanceMFromDurationPace(durationS: number, paceSPerMi: number): number {
  return (durationS / paceSPerMi) * MILE_METERS;
}

export type WorkoutTargetRanges = {
  distanceMinM: number | null;
  distanceMaxM: number | null;
  durationMinS: number | null;
  durationMaxS: number | null;
  paceMinSPerMi: number | null;
  paceMaxSPerMi: number | null;
};

export type WorkoutTargetField = "distance" | "duration" | "pace";

// Pairs each range's min with the other range's min, and max with max
// (rather than combining every possible way) -- "4-6 miles in 30-40
// minutes" reads as two paired scenarios, the shorter end of the distance
// with the shorter end of the time and the longer end with the longer,
// not a fastest/slowest spread across every combination. That pairing can
// still produce a "max" number smaller than the "min" one (pace isn't
// guaranteed to move in the same direction as an uneven distance/duration
// pairing), so the two computed endpoints are re-sorted into numeric
// order before being returned, since min <= max is the one invariant
// every range field on this form enforces.
function deriveRange(
  minA: number,
  maxA: number | null,
  minB: number,
  maxB: number | null,
  compute: (a: number, b: number) => number,
): { min: number; max: number | null } {
  const min = compute(minA, minB);
  if (maxA == null || maxB == null) return { min: Math.round(min), max: null };
  const max = compute(maxA, maxB);
  return { min: Math.round(Math.min(min, max)), max: Math.round(Math.max(min, max)) };
}

// Keeps distance, duration, and pace consistent as a coach edits any one
// of them. `edited` is the field that just changed; when both of the
// other two fields already have a value, the one that recomputes is
// whichever ranks lower in distance > duration > pace (a coach is more
// likely to have already fixed "6 miles" or "45 minutes" before pace than
// the other way around, so the higher-ranked field is the one treated as
// already decided and left alone). When only one of the other two has a
// value, that's the one filled in -- there's nothing yet to prefer
// between them. When neither does, there's nothing to derive: the edited
// field is left to stand alone, matching "only one of the three is
// required."
export function autoCompleteWorkoutTargets(edited: WorkoutTargetField, ranges: WorkoutTargetRanges): WorkoutTargetRanges {
  const { distanceMinM, distanceMaxM, durationMinS, durationMaxS, paceMinSPerMi, paceMaxSPerMi } = ranges;
  const hasDistance = distanceMinM != null;
  const hasDuration = durationMinS != null;
  const hasPace = paceMinSPerMi != null;

  function recomputePace(): WorkoutTargetRanges {
    if (!hasDistance || !hasDuration) return ranges;
    const { min, max } = deriveRange(distanceMinM!, distanceMaxM, durationMinS!, durationMaxS, paceSPerMiFromDistanceDuration);
    return { ...ranges, paceMinSPerMi: min, paceMaxSPerMi: max };
  }
  function recomputeDuration(): WorkoutTargetRanges {
    if (!hasDistance || !hasPace) return ranges;
    const { min, max } = deriveRange(distanceMinM!, distanceMaxM, paceMinSPerMi!, paceMaxSPerMi, durationSFromDistancePace);
    return { ...ranges, durationMinS: min, durationMaxS: max };
  }
  function recomputeDistance(): WorkoutTargetRanges {
    if (!hasDuration || !hasPace) return ranges;
    const { min, max } = deriveRange(durationMinS!, durationMaxS, paceMinSPerMi!, paceMaxSPerMi, distanceMFromDurationPace);
    return { ...ranges, distanceMinM: min, distanceMaxM: max };
  }

  if (edited === "distance") return hasDuration ? recomputePace() : recomputeDuration();
  if (edited === "duration") return hasDistance ? recomputePace() : recomputeDistance();
  return hasDistance ? recomputeDuration() : recomputeDistance();
}
