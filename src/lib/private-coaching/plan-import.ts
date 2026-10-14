import type { TrainingPlan } from "@/lib/training-plans/types";
import { scaleForTargetPeak, scaleDistance, renderDescription } from "@/lib/training-plans/template";
import { computeWorkoutPaceSeconds } from "@/lib/pace-percent-math";
import { bpmFromPercent } from "@/lib/hr-model";
import { addDays } from "@/lib/week";
import { MILE_METERS } from "@/lib/race-distances";

// Bridges a self-serve training-plan track (src/lib/training-plans/) into
// real coaching-platform data -- a day-by-day, pre-authored plan a
// self-coached athlete (or any coach) can apply instead of building every
// week by hand. Pure computation only, no DB access, so the whole mapping
// is unit-testable independent of the Server Action that actually writes
// it (see import-plan-actions.ts).

// What the coach supplies at import time so the plan's own "at 96-102%
// 5k"/"very easy" language can become real, literal pace/HR numbers
// instead of just prose -- see computePaceTarget/computeHrCeiling below.
// Every field is independently optional: this data isn't stored anywhere
// on this platform today (no persisted RHR/max-HR field, and a reference
// race is a live lookup, not a guaranteed fact), so omitting one just
// means the days that would have needed it keep their prose-only
// prescription, exactly like today -- never a fabricated number.
export type AthleteReferenceInputs = {
  restingHr: number | null;
  maxHr: number | null;
  fiveKPaceSPerMi: number | null;
  marathonPaceSPerMi: number | null;
};

export type ResolvedImportDay = {
  scheduledDate: string;
  dayLabel: string;
  sessionSlot: "AM" | "PM";
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedPaceSPerMi: number | null;
  plannedPaceMaxSPerMi: number | null;
  plannedHrBpm: number | null;
  plannedHrMaxBpm: number | null;
  notesFromCoach: string;
};

export type ResolvedImportWeek = { weekStart: string; targetVolumeMin: number };

export type ResolvedPlanImport = {
  days: ResolvedImportDay[];
  weeks: ResolvedImportWeek[];
  endDate: string;
};

function milesToMeters(miles: number): number {
  return Math.round(miles * MILE_METERS);
}

// Only ever true for the literal "Rest" entries some (not all) tracks use
// -- see plan-page.tsx's own identical `!== "Rest"` check, the established
// precedent for what counts as a rest day in this data. No row is ever
// created for one, matching the rest of this app's own "an empty day
// already reads as Off" convention.
function isRestDay(description: string): boolean {
  return description.trim() === "Rest";
}

const AM_PM_PATTERN = /^AM:\s*(.+?)\s*\/\s*PM:\s*(.+)$/i;

function splitAmPm(renderedText: string): { am: string; pm: string } | null {
  const match = renderedText.match(AM_PM_PATTERN);
  if (!match) return null;
  return { am: match[1].trim(), pm: match[2].trim() };
}

// Only used for an AM/PM-split entry, where there's no per-session
// totalDistance to fall back on (see resolveDay's own comment on why a
// non-split day uses the authoritative totalDistance field instead of
// parsing prose). Reads the first number or number range in already-scaled
// rendered text (renderDescription resolves multiplier placeholders to
// real integers before this ever runs).
const DISTANCE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?\s*mi/;

function parseDistanceFromText(renderedText: string): { min: number; max: number | null } | null {
  const match = renderedText.match(DISTANCE_PATTERN);
  if (!match) return null;
  const min = Number(match[1]);
  const max = match[2] ? Number(match[2]) : null;
  return { min, max: max != null && max !== min ? max : null };
}

// Best-effort only -- this data has no structured workout kind anywhere
// (see plan-import's own module comment / the plan this ships against),
// just free-text descriptions. A wrong guess here costs nothing real: the
// full rendered text is always preserved verbatim in notesFromCoach
// regardless, and the label itself is a one-click fix via the existing
// quick-edit panel. Ordered rules, first match wins; a day matching none
// of them stays "Training" until the week-level long-run pass (see
// resolvePlanImport) potentially promotes it.
function classifyDayLabel(renderedText: string): string {
  const text = renderedText.toLowerCase();
  const isRepStructured = /\d+\s*[×x]\s*\d|repeat/.test(text);
  if (isRepStructured) {
    if (/5k|vo2|vo₂|9[0-9]%/.test(text)) return "Intervals";
    if (/threshold/.test(text)) return "Threshold";
    if (/tempo|marathon pace|\bmp\b/.test(text)) return "Tempo";
    return "Intervals";
  }
  if (/threshold/.test(text)) return "Threshold";
  if (/tempo/.test(text)) return "Tempo";
  if (/progression/.test(text)) return "Progression";
  // Checked before the plain "easy" rule below -- "very easy" would
  // otherwise match it first (the substring is right there) and the two
  // get genuinely different HR ceilings (see computeHrCeiling), not just
  // different labels.
  if (/very easy/.test(text)) return "Very Easy";
  if (/easy/.test(text)) return "Easy";
  return "Training";
}

// "at 96-102% 5k" / "at 108-110% MP" -- Canova's percent-of-pace
// convention (see pace-percent-math.ts's own extensive comment on why this
// differs from percent-of-speed), which is what John Davis's own
// pace-percent calculator this site already ports uses, and John Davis is
// the author of this exact plan data -- the same convention, not a
// guess. "MP" and "marathon" both mean marathon pace; only 5k and MP
// appear in the real plan vocabulary today, so an unrecognized basis
// (10k/half/etc.) is left unresolved rather than guessed at.
const PACE_PERCENT_PATTERN = /(\d+)(?:\s*[-–]\s*(\d+))?\s*%\s*(5k|marathon|mp)\b/i;

function computePaceTarget(
  renderedText: string,
  athleteInputs: AthleteReferenceInputs,
): { min: number; max: number | null } | null {
  const match = renderedText.match(PACE_PERCENT_PATTERN);
  if (!match) return null;

  const basisKey = match[3].toLowerCase();
  const referenceSeconds = basisKey === "5k" ? athleteInputs.fiveKPaceSPerMi : athleteInputs.marathonPaceSPerMi;
  if (referenceSeconds == null) return null; // no reference on file -- prose only, never a fabricated pace

  const percentMin = Number(match[1]);
  const percentMax = match[2] ? Number(match[2]) : percentMin;
  const secondsAtMin = computeWorkoutPaceSeconds(referenceSeconds, percentMin, "pace");
  const secondsAtMax = computeWorkoutPaceSeconds(referenceSeconds, percentMax, "pace");
  // A higher percent is a FASTER (fewer seconds/mile) pace in this
  // convention, so the lower percent bound is the slower/larger-seconds
  // end -- sort into the min-seconds/max-seconds shape every other pace
  // range on this platform already uses (min = faster end).
  const min = Math.round(Math.min(secondsAtMin, secondsAtMax));
  const max = Math.round(Math.max(secondsAtMin, secondsAtMax));
  return { min, max: max !== min ? max : null };
}

// Easy: ceiling 65% HRR, floor 55%. Very Easy: ceiling below 60% HRR,
// floor 45%. The user specified the ceilings explicitly; the floors are a
// physiologically reasonable range underneath each ceiling (the DB itself
// requires a min whenever a max is set -- see validateHrRange in
// workout-distance.ts -- so a ceiling-only value isn't a storable shape on
// this schema regardless). No target at all for any other day label --
// this is deliberately scoped to exactly the two zones the user asked for,
// not a general effort-to-HR mapping.
function computeHrCeiling(dayLabel: string, athleteInputs: AthleteReferenceInputs): { min: number; max: number } | null {
  if (athleteInputs.restingHr == null || athleteInputs.maxHr == null) return null;
  const { restingHr, maxHr } = athleteInputs;
  const range = dayLabel === "Very Easy" ? [45, 60] : dayLabel === "Easy" ? [55, 65] : null;
  if (!range) return null;
  const min = bpmFromPercent(range[0], "hrreserve", maxHr, restingHr);
  const max = bpmFromPercent(range[1], "hrreserve", maxHr, restingHr);
  if (min == null || max == null) return null;
  return { min: Math.round(min), max: Math.round(max) };
}

type DayCandidate = {
  scheduledDate: string;
  sessionSlot: "AM" | "PM";
  renderedText: string;
  dayLabel: string;
  distanceMiles: number | null;
  distanceMaxMiles: number | null;
  paceSPerMi: number | null;
  paceMaxSPerMi: number | null;
  hrBpm: number | null;
  hrMaxBpm: number | null;
};

function resolveCandidate(
  scheduledDate: string,
  sessionSlot: "AM" | "PM",
  text: string,
  distanceMiles: number | null,
  distanceMaxMiles: number | null,
  athleteInputs: AthleteReferenceInputs,
): DayCandidate {
  const dayLabel = classifyDayLabel(text);
  const pace = computePaceTarget(text, athleteInputs);
  const hr = computeHrCeiling(dayLabel, athleteInputs);
  return {
    scheduledDate,
    sessionSlot,
    renderedText: text,
    dayLabel,
    distanceMiles,
    distanceMaxMiles,
    paceSPerMi: pace?.min ?? null,
    paceMaxSPerMi: pace?.max ?? null,
    hrBpm: hr?.min ?? null,
    hrMaxBpm: hr?.max ?? null,
  };
}

function resolveDay(
  rawDescription: string,
  totalDistance: number,
  scale: number,
  scheduledDate: string,
  athleteInputs: AthleteReferenceInputs,
): DayCandidate[] {
  if (isRestDay(rawDescription)) return [];

  const rendered = renderDescription(rawDescription, scale, "mi");
  const split = splitAmPm(rendered);

  if (split) {
    // The day's own totalDistance is still the ONE authoritative figure
    // for this whole day -- the exact same number the public Training
    // Plans page uses for its own single combined badge on an AM/PM day
    // (plan-page.tsx sums totalDistance*scale per day, never text-parsed
    // numbers). Split into two rows here (this platform models AM/PM as
    // genuinely separate sessions), but apportioned FROM that authoritative
    // total by each half's own parsed-from-text weight, rather than each
    // half re-deriving its own number independently from prose -- the
    // prose range and totalDistance are separately authored and don't
    // always agree exactly, so independent parsing let the two rows'
    // sum silently drift from the day (and week) total the reference page
    // shows for the same scale. The remainder (not a second independent
    // round) is what guarantees an exact sum. Each half becomes a single
    // point value (no range), matching that same page's own "always one
    // number" convention -- the original prose range is still preserved
    // verbatim in notesFromCoach, just not as a second structured min/max.
    const dayTotalMiles = scaleDistance(totalDistance, scale);
    const amWeight = parseDistanceFromText(split.am)?.min ?? 0;
    const pmWeight = parseDistanceFromText(split.pm)?.min ?? 0;
    const totalWeight = amWeight + pmWeight;
    const amMiles = totalWeight > 0 ? (dayTotalMiles * amWeight) / totalWeight : dayTotalMiles / 2;
    const pmMiles = dayTotalMiles - amMiles;
    return [
      resolveCandidate(scheduledDate, "AM", split.am, amMiles, null, athleteInputs),
      resolveCandidate(scheduledDate, "PM", split.pm, pmMiles, null, athleteInputs),
    ];
  }

  // A non-split day's own totalDistance is the plan's authoritative
  // per-day figure (see plan-page.tsx's identical use of scaleDistance on
  // this same field for its own displayed number) -- more reliable than
  // re-deriving it from whatever numbers happen to appear in the prose,
  // and consistent with how this same data already renders elsewhere in
  // the app. Applies uniformly whether or not the description itself has
  // a placeholder -- a pure quality/interval session (no placeholder,
  // written in %pace terms) still has a real totalDistance and gets the
  // same number badge treatment the static plan-library page gives it.
  const distanceMiles = scaleDistance(totalDistance, scale);
  // Every generated workout gets an explicit session slot, even a day
  // with just one session -- sessionSlot is plain, always-rendered display
  // text on this platform (Month/Week/Day views prepend it verbatim
  // whenever it's set, see calendar-types.ts), not a signal reserved for
  // AM/PM doubles, so a null here would just be a day silently missing a
  // label rather than a meaningfully different display. Single-session
  // days default to AM.
  return [resolveCandidate(scheduledDate, "AM", rendered, distanceMiles, null, athleteInputs)];
}

export function resolvePlanImport(
  plan: TrainingPlan,
  targetPeakWeeklyMiles: number,
  startDate: string,
  athleteInputs: AthleteReferenceInputs = { restingHr: null, maxHr: null, fiveKPaceSPerMi: null, marathonPaceSPerMi: null },
): ResolvedPlanImport {
  const scale = scaleForTargetPeak(plan.referencePeakWeeklyMiles, targetPeakWeeklyMiles);
  const weeks: ResolvedImportWeek[] = [];
  const days: ResolvedImportDay[] = [];

  for (let weekIndex = 0; weekIndex < plan.durationWeeks; weekIndex++) {
    const weekEntries = plan.workouts.slice(weekIndex * 7, weekIndex * 7 + 7);
    const weekStart = addDays(startDate, weekIndex * 7);
    const weekCandidates: DayCandidate[] = [];

    weekEntries.forEach((entry, dayIndex) => {
      const scheduledDate = addDays(startDate, weekIndex * 7 + dayIndex);
      weekCandidates.push(...resolveDay(entry.description, entry.totalDistance, scale, scheduledDate, athleteInputs));
    });

    // The week's own single largest still-unclassified entry becomes the
    // Long Run -- this data's real long-run entries are typically written
    // in plain "at 90-92% MP through rolling hills" terms with no "easy"/
    // "tempo"/rep-structure keyword to key off directly, so they fall
    // through classifyDayLabel's rules into the generic "Training" bucket
    // by construction; this second pass is what actually resolves them,
    // rather than a keyword rule trying to guess "long run" from prose
    // that rarely says it outright.
    const genericCandidates = weekCandidates.filter((c) => c.dayLabel === "Training" && c.distanceMiles != null);
    if (genericCandidates.length > 0) {
      const longest = genericCandidates.reduce((a, b) => ((b.distanceMiles ?? 0) > (a.distanceMiles ?? 0) ? b : a));
      longest.dayLabel = "Long Run";
    }

    const weekTotalMiles = weekCandidates.reduce((sum, c) => sum + (c.distanceMiles ?? 0), 0);
    weeks.push({ weekStart, targetVolumeMin: Math.round(weekTotalMiles) });

    for (const candidate of weekCandidates) {
      days.push({
        scheduledDate: candidate.scheduledDate,
        dayLabel: candidate.dayLabel,
        sessionSlot: candidate.sessionSlot,
        plannedDistanceM: candidate.distanceMiles != null ? milesToMeters(candidate.distanceMiles) : null,
        plannedDistanceMaxM: candidate.distanceMaxMiles != null ? milesToMeters(candidate.distanceMaxMiles) : null,
        plannedPaceSPerMi: candidate.paceSPerMi,
        plannedPaceMaxSPerMi: candidate.paceMaxSPerMi,
        plannedHrBpm: candidate.hrBpm,
        plannedHrMaxBpm: candidate.hrMaxBpm,
        notesFromCoach: candidate.renderedText,
      });
    }
  }

  const endDate = addDays(startDate, plan.durationWeeks * 7 - 1);
  return { days, weeks, endDate };
}
