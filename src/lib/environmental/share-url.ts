// Pure serialization/parsing for the Environmental Calculator's
// "shareable results" feature -- every result-affecting input lives in
// the URL's query string so opening a copied link reproduces the exact
// same result, with no backend and no server-side state at all.
//
// This module knows nothing about React or the component: it only
// converts a plain data object to/from a query string. The component
// (environmental-calculator.tsx) is the one place that reads
// `window.location.search` (once, at mount) and feeds the parsed result
// in as an additional override layer ahead of the existing
// localStorage-backed `usePersistedField` value -- see that file's
// `urlOverrides.field ?? persisted?.field` pattern. A missing or invalid
// param here simply comes back absent from the parsed object, which
// lets that same `?? persisted?.field ?? default` chain fall through
// exactly as if the param had never been in the URL.
//
// Param schema (readable keys, not single letters -- a link is meant to
// be at least somewhat legible/debuggable by a human, not just a blob):
//
//   mode   GoalMode            "analyze" | "predict" | "convert" | "adjust"
//   course CourseType          "road" | "track" | "route"
//   dist   DistancePreset      "800m" | "1500m" | "mile" | "3k" | "5k" | "8k" | "10k" | "half" | "marathon" | "custom"
//   cdist  customDistanceInput meters, numeric string, clamped [1, 500000]
//   rep    RepType             one of REP_TYPE_OPTIONS' values (track reps)
//   effort SpeedOrEffort       "constant-speed" | "constant-effort"
//   t      timeInput           time string ("mm:ss", "h:mm:ss", or track's bare seconds)
//   wt     weightInput         numeric string, clamped [1, 1000]
//   wu     WeightUnit          "lbs" | "kg"
//   hd     headingDeg          degrees, wrapped into [0, 360)
//   wprof  WindProfile         one of WIND_PROFILE_OPTIONS' values (road/route terrain)
//   wexp   windExposureScore   0-100 continuous exposure score (road/route terrain)
//   egain  elevationGainInput numeric string, clamped [0, 50000]
//   eloss  elevationLossInput numeric string, clamped [0, 50000]
//   eunit  ElevationUnit       "m" | "ft"
//   tempA  tempInputA          numeric string, clamped [-80, 150]
//   tuA    TempUnit            "c" | "f"
//   humA   rhInputA            numeric string, clamped [0, 100]
//   windA  windSpeedInputA     numeric string, clamped [0, 250]
//   wuA    WindSpeedUnit       "mph" | "kmh" | "knots" | "ms"
//   wdA    relativeWindAngleA  degrees, wrapped into [0, 360)
//   altA   altitudeInputA      numeric string, clamped [0, 9000], or "" for unset
//   tempB..altB                same seven fields, for Conditions B
//   wtype  WorkoutType         one of WORKOUT_TYPE_ORDER's values
//   wpace  workoutPaceInput    time string (pace, mm:ss)
//   wmode  WorkoutInputMode    "distance" | "duration"
//   wdist  workoutDistanceInput numeric string, clamped [0, 500]
//   wdur   workoutDurationInput time string ("mm:ss" or "h:mm:ss")
//   pu     PaceDisplayUnit     "mi" | "km" (cosmetic -- doesn't change any result)
//
// The Conditions B set (tempB/tuB/humB/windB/wuB/wdB/altB) is ALWAYS
// included, not only when goalMode is "convert" -- a link opened later
// under a different mode (or switched to Convert after the fact) should
// still restore whatever B scenario the sharer had set up, exactly the
// same way Conditions A always round-trips regardless of mode.
//
// Deliberately excluded from this schema (not a gap -- see each reason):
//   - sourceA (the manual/auto weather-source toggle): "auto" depends on
//     a live network fetch (geocoding + a weather API call) that isn't
//     part of this component's own state and can't be replayed from a
//     URL alone. A shared link always restores in manual mode with
//     whatever temp/humidity/wind/altitude values were actually in
//     effect at share time -- which is the real, resolved data either
//     way, auto-fetched or not.
//   - the imported GPS route itself (courseType "route"'s file/Strava
//     data): a route's full point-by-point track can be thousands of
//     points, far too large for a URL and not meaningfully different
//     from asking the recipient to re-import it. A `course=route` link
//     with no route loaded is handled by the existing "import a route"
//     empty-state placeholder the component already shows when
//     `routeSummary` is null -- it never crashes, it just asks the
//     recipient to (re-)import the activity themselves.
//   - showAdvanced / showEducation: pure UI-disclosure state, not an
//     input that changes any computed result.

import { parseTimeToSeconds } from "@/lib/running-format";

export type ShareGoalMode = "analyze" | "predict" | "convert" | "adjust";
export type ShareCourseType = "road" | "track" | "route";
export type ShareDistancePreset = "800m" | "1500m" | "mile" | "3k" | "5k" | "8k" | "10k" | "half" | "marathon" | "custom";
export type ShareRepType = "200m" | "200m-alt" | "400m" | "600m" | "600m-alt" | "1000m" | "1000m-alt";
export type ShareSpeedOrEffort = "constant-speed" | "constant-effort";
export type ShareWeightUnit = "lbs" | "kg";
export type ShareWindProfile = "urban" | "suburban" | "rural" | "none";
export type ShareElevationUnit = "m" | "ft";
export type ShareTempUnit = "c" | "f";
export type ShareWindSpeedUnit = "mph" | "kmh" | "knots" | "ms";
export type ShareWorkoutType =
  | "race"
  | "easy"
  | "recovery"
  | "long-run"
  | "marathon-pace"
  | "steady-state"
  | "tempo"
  | "threshold"
  | "critical-velocity"
  | "vo2max"
  | "hill-repeats"
  | "intervals"
  | "progression"
  | "fartlek"
  | "custom";
export type ShareWorkoutInputMode = "distance" | "duration";
export type SharePaceDisplayUnit = "mi" | "km";

export type ShareableFields = {
  mode: ShareGoalMode;
  course: ShareCourseType;
  dist: ShareDistancePreset;
  cdist: string;
  rep: ShareRepType;
  effort: ShareSpeedOrEffort;
  t: string;
  wt: string;
  wu: ShareWeightUnit;
  hd: number;
  wprof: ShareWindProfile;
  wexp: number;
  egain: string;
  eloss: string;
  eunit: ShareElevationUnit;
  tempA: string;
  tuA: ShareTempUnit;
  humA: string;
  windA: string;
  wuA: ShareWindSpeedUnit;
  wdA: number;
  altA: string;
  tempB: string;
  tuB: ShareTempUnit;
  humB: string;
  windB: string;
  wuB: ShareWindSpeedUnit;
  wdB: number;
  altB: string;
  wtype: ShareWorkoutType;
  wpace: string;
  wmode: ShareWorkoutInputMode;
  wdist: string;
  wdur: string;
  pu: SharePaceDisplayUnit;
};

/** Every key this schema knows about -- used by the drift-catching test to confirm nothing documented above goes silently unread. */
export const SHARE_URL_PARAM_KEYS: readonly (keyof ShareableFields)[] = [
  "mode",
  "course",
  "dist",
  "cdist",
  "rep",
  "effort",
  "t",
  "wt",
  "wu",
  "hd",
  "wprof",
  "wexp",
  "egain",
  "eloss",
  "eunit",
  "tempA",
  "tuA",
  "humA",
  "windA",
  "wuA",
  "wdA",
  "altA",
  "tempB",
  "tuB",
  "humB",
  "windB",
  "wuB",
  "wdB",
  "altB",
  "wtype",
  "wpace",
  "wmode",
  "wdist",
  "wdur",
  "pu",
];

const GOAL_MODES: readonly ShareGoalMode[] = ["analyze", "predict", "convert", "adjust"];
const COURSE_TYPES: readonly ShareCourseType[] = ["road", "track", "route"];
const DISTANCE_PRESETS: readonly ShareDistancePreset[] = [
  "800m",
  "1500m",
  "mile",
  "3k",
  "5k",
  "8k",
  "10k",
  "half",
  "marathon",
  "custom",
];
const REP_TYPES: readonly ShareRepType[] = ["200m", "200m-alt", "400m", "600m", "600m-alt", "1000m", "1000m-alt"];
const SPEED_OR_EFFORTS: readonly ShareSpeedOrEffort[] = ["constant-speed", "constant-effort"];
const WEIGHT_UNITS: readonly ShareWeightUnit[] = ["lbs", "kg"];
const WIND_PROFILES: readonly ShareWindProfile[] = ["urban", "suburban", "rural", "none"];
const ELEVATION_UNITS: readonly ShareElevationUnit[] = ["m", "ft"];
const TEMP_UNITS: readonly ShareTempUnit[] = ["c", "f"];
const WIND_SPEED_UNITS: readonly ShareWindSpeedUnit[] = ["mph", "kmh", "knots", "ms"];
const WORKOUT_TYPES: readonly ShareWorkoutType[] = [
  "race",
  "easy",
  "recovery",
  "long-run",
  "marathon-pace",
  "steady-state",
  "tempo",
  "threshold",
  "critical-velocity",
  "vo2max",
  "hill-repeats",
  "intervals",
  "progression",
  "fartlek",
  "custom",
];
const WORKOUT_INPUT_MODES: readonly ShareWorkoutInputMode[] = ["distance", "duration"];
const PACE_DISPLAY_UNITS: readonly SharePaceDisplayUnit[] = ["mi", "km"];

function parseEnum<T extends string>(raw: string | null, valid: readonly T[]): T | undefined {
  if (raw === null) return undefined;
  return (valid as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

function parseClampedNumber(raw: string | null, min: number, max: number): number | undefined {
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

function parseClampedNumericString(raw: string | null, min: number, max: number): string | undefined {
  const n = parseClampedNumber(raw, min, max);
  return n === undefined ? undefined : String(n);
}

/** Altitude fields are the one numeric-string field where "" is itself a valid, meaningful value (sea level / unknown), not something to clamp away. */
function parseOptionalAltitudeString(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  if (raw.trim() === "") return "";
  return parseClampedNumericString(raw, 0, 9000);
}

/** Degrees wrap rather than clamp -- 370 and 10 mean the same heading, so wrapping is the honest behavior, not an error case. */
function parseDegrees(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return ((n % 360) + 360) % 360;
}

/**
 * Validates a time-ish string using the real parseTimeToSeconds, the
 * same parser the calculator itself trusts for every "mm:ss" / "h:mm:ss"
 * field. Track mode's own bare-seconds format (e.g. "62.4", no colon --
 * see parseTrackTime in running-format.ts) is a second legitimate shape
 * parseTimeToSeconds alone rejects by design (it requires at least one
 * colon), so a plain non-negative finite number is accepted here too --
 * otherwise a track-mode share link could never round-trip its own time.
 */
function parseTimeString(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (parseTimeToSeconds(trimmed) !== null) return trimmed;
  const bare = Number(trimmed);
  return Number.isFinite(bare) && bare >= 0 ? trimmed : undefined;
}

/**
 * Reads and validates every documented param from a query string (as
 * produced by `location.search`, leading "?" optional). Anything
 * missing, malformed, or out of its documented enum/range is simply
 * absent from the returned object -- callers fall back to their own
 * existing default/persisted value for that field, never to a crash or
 * a half-applied partial state.
 */
export function parseShareUrlParams(search: string): Partial<ShareableFields> {
  const params = new URLSearchParams(search);
  const get = (key: string) => params.get(key);

  const result: Partial<ShareableFields> = {};

  const mode = parseEnum(get("mode"), GOAL_MODES);
  if (mode !== undefined) result.mode = mode;
  const course = parseEnum(get("course"), COURSE_TYPES);
  if (course !== undefined) result.course = course;
  const dist = parseEnum(get("dist"), DISTANCE_PRESETS);
  if (dist !== undefined) result.dist = dist;
  const cdist = parseClampedNumericString(get("cdist"), 1, 500000);
  if (cdist !== undefined) result.cdist = cdist;
  const rep = parseEnum(get("rep"), REP_TYPES);
  if (rep !== undefined) result.rep = rep;
  const effort = parseEnum(get("effort"), SPEED_OR_EFFORTS);
  if (effort !== undefined) result.effort = effort;
  const t = parseTimeString(get("t"));
  if (t !== undefined) result.t = t;
  const wt = parseClampedNumericString(get("wt"), 1, 1000);
  if (wt !== undefined) result.wt = wt;
  const wu = parseEnum(get("wu"), WEIGHT_UNITS);
  if (wu !== undefined) result.wu = wu;
  const hd = parseDegrees(get("hd"));
  if (hd !== undefined) result.hd = hd;
  const wprof = parseEnum(get("wprof"), WIND_PROFILES);
  if (wprof !== undefined) result.wprof = wprof;
  const wexp = parseClampedNumber(get("wexp"), 0, 100);
  if (wexp !== undefined) result.wexp = wexp;
  const egain = parseClampedNumericString(get("egain"), 0, 50000);
  if (egain !== undefined) result.egain = egain;
  const eloss = parseClampedNumericString(get("eloss"), 0, 50000);
  if (eloss !== undefined) result.eloss = eloss;
  const eunit = parseEnum(get("eunit"), ELEVATION_UNITS);
  if (eunit !== undefined) result.eunit = eunit;

  const tempA = parseClampedNumericString(get("tempA"), -80, 150);
  if (tempA !== undefined) result.tempA = tempA;
  const tuA = parseEnum(get("tuA"), TEMP_UNITS);
  if (tuA !== undefined) result.tuA = tuA;
  const humA = parseClampedNumericString(get("humA"), 0, 100);
  if (humA !== undefined) result.humA = humA;
  const windA = parseClampedNumericString(get("windA"), 0, 250);
  if (windA !== undefined) result.windA = windA;
  const wuA = parseEnum(get("wuA"), WIND_SPEED_UNITS);
  if (wuA !== undefined) result.wuA = wuA;
  const wdA = parseDegrees(get("wdA"));
  if (wdA !== undefined) result.wdA = wdA;
  const altA = parseOptionalAltitudeString(get("altA"));
  if (altA !== undefined) result.altA = altA;

  const tempB = parseClampedNumericString(get("tempB"), -80, 150);
  if (tempB !== undefined) result.tempB = tempB;
  const tuB = parseEnum(get("tuB"), TEMP_UNITS);
  if (tuB !== undefined) result.tuB = tuB;
  const humB = parseClampedNumericString(get("humB"), 0, 100);
  if (humB !== undefined) result.humB = humB;
  const windB = parseClampedNumericString(get("windB"), 0, 250);
  if (windB !== undefined) result.windB = windB;
  const wuB = parseEnum(get("wuB"), WIND_SPEED_UNITS);
  if (wuB !== undefined) result.wuB = wuB;
  const wdB = parseDegrees(get("wdB"));
  if (wdB !== undefined) result.wdB = wdB;
  const altB = parseOptionalAltitudeString(get("altB"));
  if (altB !== undefined) result.altB = altB;

  const wtype = parseEnum(get("wtype"), WORKOUT_TYPES);
  if (wtype !== undefined) result.wtype = wtype;
  const wpace = parseTimeString(get("wpace"));
  if (wpace !== undefined) result.wpace = wpace;
  const wmode = parseEnum(get("wmode"), WORKOUT_INPUT_MODES);
  if (wmode !== undefined) result.wmode = wmode;
  const wdist = parseClampedNumericString(get("wdist"), 0, 500);
  if (wdist !== undefined) result.wdist = wdist;
  const wdur = parseTimeString(get("wdur"));
  if (wdur !== undefined) result.wdur = wdur;

  const pu = parseEnum(get("pu"), PACE_DISPLAY_UNITS);
  if (pu !== undefined) result.pu = pu;

  return result;
}

/** Builds the query string (no leading "?") for a full, current set of shareable fields. Always includes every documented param, regardless of the current goalMode -- see the module comment on why Conditions B is never omitted. */
export function serializeShareUrlParams(fields: ShareableFields): string {
  const params = new URLSearchParams();
  for (const key of SHARE_URL_PARAM_KEYS) {
    params.set(key, String(fields[key]));
  }
  return params.toString();
}

/** Convenience wrapper: a full shareable URL for the given pathname (and optional origin, e.g. `window.location.origin`). */
export function buildShareUrl(pathname: string, fields: ShareableFields, origin = ""): string {
  return `${origin}${pathname}?${serializeShareUrlParams(fields)}`;
}
