// The math behind turning a coach-configurable, reusable "Program"
// (training_programs / program_phase_definitions / program_duration_
// variants / program_days) into one athlete's real, individualized
// schedule (training_phases / scheduled_workouts / training_week_plans).
// Pure, deterministic, no DB access -- directly parallel to plan-import.ts
// (the older, static-plan import path this generalizes), reusing its
// scaling/pace-percent math rather than reimplementing it. See
// assign-program-actions.ts for the caller that loads real rows, calls
// resolveProgramGeneration, and (via assign_program_generation, the
// Postgres function) writes the result atomically.
//
// Nothing here assumes any one coach's methodology: phase count/order/
// duration, whether the plan scales by mileage at all, which fields scale
// when it does, and whether race day is a real authored workout or purely
// informational are all read from the input, never hardcoded.
//
// pace_percent_basis/min/max is deliberately NEVER resolved into a literal
// pace here -- it's passed straight through, same as pace_reference always
// has been. It used to resolve once, at assignment time (see this file's
// own prior revision); that was reversed once real usage showed an
// athlete's fitness estimate is expected to change mid-plan and every
// not-yet-completed workout should reflect the update automatically --
// exactly the always-live-resolving contract pace_reference already had.
// Resolution now happens only at read time, against the athlete's current
// fitness estimate (see fitness-estimates.ts's resolvePacePercent).
// computeProgramPaceTarget below is reused by that same read path, not by
// anything in this file anymore.

import { computeWorkoutPaceSeconds } from "@/lib/pace-percent-math";
import { scaleDistance, scaleForTargetPeak } from "@/lib/training-plans/template";
import { addDays, daysBetween, mostRecentMonday } from "@/lib/week";
import { MILE_METERS } from "@/lib/race-distances";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import type { WorkoutStepType, WorkoutTargetType } from "@/lib/private-coaching/steps";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import { classifyWorkoutTitle } from "@/lib/private-coaching/workout-title";

export type ProgramPhaseDefinition = {
  id: string;
  phaseKey: string;
  name: string | null;
  durationWeeksMin: number;
  durationWeeksMax: number;
  isOptional: boolean;
  /** Coach-authored "why this phase," carried onto the athlete's own phase row at assignment time so their copy survives any later edit to this definition. */
  explainer: string | null;
};

export type ProgramPhaseWeekLabel = {
  phaseDefinitionId: string;
  weekNumber: number;
  label: string | null;
  /** The longer coach-authored week narrative (program_phase_weeks.notes), carried onto the athlete's training_week_plans row the same way label is. */
  notes?: string | null;
};

/**
 * One week's authored goal mileage for the peak-volume variant the coach
 * selected at assignment time (program_phase_week_volumes). The caller
 * passes rows for THAT VARIANT ONLY -- resolving which variant is in play
 * is an assignment decision, not something this function re-derives.
 *
 * goalMileageMin being null is a real authored value, not missing data:
 * race week prescribes no weekly total at all ("n/a"), and that must stay
 * absent rather than becoming a target of zero.
 */
export type ProgramPhaseWeekVolume = {
  phaseDefinitionId: string;
  weekNumber: number;
  goalMileageMin: number | null;
  goalMileageMax: number | null;
};

export type ProgramDayStepContent = {
  stepOrder: number;
  stepType: WorkoutStepType;
  durationS: number | null;
  durationMaxS: number | null;
  distanceM: number | null;
  distanceMaxM: number | null;
  targetType: WorkoutTargetType;
  targetMin: number | null;
  targetMax: number | null;
  targetUnit: string | null;
  targetPaceReference: PaceReferenceKey | null;
  targetPacePercentBasis: PaceReferenceKey | null;
  targetPacePercentMin: number | null;
  targetPacePercentMax: number | null;
  repetitions: number | null;
  repetitionsMax: number | null;
  restS: number | null;
  restMaxS: number | null;
  instructions: string | null;
};

export type ProgramDayExtraContent = WorkoutExtraInput & { extraOrder: number };

export type ProgramDayContent = {
  /** program_days.id -- carried through as provenance on the generated scheduled_workouts row. */
  id: string;
  phaseDefinitionId: string;
  /** 1-indexed within the phase. */
  weekNumber: number;
  /** 1=Monday .. 7=Sunday. */
  dayOfWeek: number;
  dayLabel: string | null;
  sessionSlot: string | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  plannedPaceSPerMi: number | null;
  plannedPaceMaxSPerMi: number | null;
  paceReference: PaceReferenceKey | null;
  pacePercentBasis: PaceReferenceKey | null;
  pacePercentMin: number | null;
  pacePercentMax: number | null;
  plannedHrBpm: number | null;
  plannedHrMaxBpm: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  isEventDay: boolean;
  /** A session the framework itself marks optional (Ridge/Peak/Summit secondary runs). Carried onto the athlete's workout so they can tell which sessions are genuinely skippable. */
  isOptional: boolean;
  /** The framework's own stated substitute for this session, verbatim -- a single-session alternative to a double-threshold day, or a single-workout alternative to a special block. */
  alternativeText: string | null;
  notes: string | null;
  steps: ProgramDayStepContent[];
  extras: ProgramDayExtraContent[];
};

/** Seconds per mile, keyed the same way pace-reference.ts's PaceReferenceKey is -- built by the caller from one reference race via resolvePaceReference. */
export type ProgramAthleteReferenceInputs = Partial<Record<PaceReferenceKey, number>>;

export type GeneratePhaseSelection = {
  phaseDefinitionId: string;
  /** Only meaningful for an is_optional phase -- a required phase is always included regardless of this value. */
  include: boolean;
  weeks: number;
};

export type GenerateProgramAnchor =
  | { kind: "startDate"; startDate: string; targetEventDate: string | null }
  | { kind: "targetEventDate"; targetEventDate: string };

export type GenerateProgramInput = {
  /** In position order, from program_variant_phases. */
  variantPhases: ProgramPhaseDefinition[];
  phaseSelections: GeneratePhaseSelection[];
  /** Every authored day for every phase in variantPhases (in-range and out-of-range alike -- partitioning happens inside this function). */
  days: ProgramDayContent[];
  weekLabels: ProgramPhaseWeekLabel[];
  /** Empty for a program with no peak-volume variants, which is every hand-authored one -- such a program's week totals keep being derived from its own authored day distances. */
  weekVolumes: ProgramPhaseWeekVolume[];
  scalesDistanceWithMileage: boolean;
  scalesDurationWithMileage: boolean;
  /** Miles. Required (validated) iff scalesDistanceWithMileage. */
  targetPeakWeeklyMiles: number | null;
  /** Seconds. Required (validated) iff scalesDurationWithMileage. */
  targetPeakWeeklyDurationS: number | null;
  anchor: GenerateProgramAnchor;
};

export type ResolvedProgramStep = {
  sourceProgramDayId: string;
  stepOrder: number;
  stepType: WorkoutStepType;
  durationS: number | null;
  durationMaxS: number | null;
  distanceM: number | null;
  distanceMaxM: number | null;
  targetType: WorkoutTargetType;
  targetMin: number | null;
  targetMax: number | null;
  targetUnit: string | null;
  targetPaceReference: PaceReferenceKey | null;
  // Passed through unresolved, exactly like targetPaceReference above --
  // see this type's own file header and the fitness-estimates.ts module
  // for why a percent-of-pace prescription now resolves live, at read
  // time, against the athlete's current fitness estimate, rather than
  // being baked into a literal pace once at assignment.
  targetPacePercentBasis: PaceReferenceKey | null;
  targetPacePercentMin: number | null;
  targetPacePercentMax: number | null;
  repetitions: number | null;
  repetitionsMax: number | null;
  restS: number | null;
  restMaxS: number | null;
  instructions: string | null;
};

export type ResolvedProgramDay = {
  sourceProgramDayId: string;
  scheduledDate: string;
  dayLabel: string | null;
  sessionSlot: string | null;
  isOptional: boolean;
  alternativeText: string | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  plannedPaceSPerMi: number | null;
  plannedPaceMaxSPerMi: number | null;
  paceReference: PaceReferenceKey | null;
  // Passed through unresolved -- see ResolvedProgramStep's own comment.
  pacePercentBasis: PaceReferenceKey | null;
  pacePercentMin: number | null;
  pacePercentMax: number | null;
  plannedHrBpm: number | null;
  plannedHrMaxBpm: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  notes: string | null;
  steps: ResolvedProgramStep[];
  extras: ProgramDayExtraContent[];
};

export type ResolvedProgramPhase = {
  phaseDefinitionId: string;
  phaseKey: string;
  name: string | null;
  startDate: string;
  endDate: string;
  explainer: string | null;
};

export type ResolvedProgramWeek = {
  weekStart: string;
  /** Null only when the week's authored goal mileage is explicitly "no total prescribed" (race week). A derived total is always a number. */
  targetVolumeMin: number | null;
  /** Set only when the authored goal mileage is a real range ("85-90"). A derived total has no upper bound. */
  targetVolumeMax: number | null;
  label: string | null;
  notes: string | null;
};

export type ProgramGenerationWarnings = {
  emptyPhaseDefinitionIds: string[];
  emptyWeeks: { phaseDefinitionId: string; weekNumber: number }[];
  daysAfterEventDate: string[];
  outOfRangeDays: { sourceProgramDayId: string; phaseDefinitionId: string; weekNumber: number }[];
};

export type ResolvedProgramGeneration = {
  phases: ResolvedProgramPhase[];
  weeks: ResolvedProgramWeek[];
  days: ResolvedProgramDay[];
  startDate: string;
  endDate: string;
  totalWeeks: number;
  referencePeakWeeklyMiles: number | null;
  referencePeakWeeklyDurationS: number | null;
  raceDayAlignment: {
    targetEventDate: string;
    finalTrainingWeekEndDate: string;
    daysBetween: number;
    eventDaySourceProgramDayId: string | null;
  } | null;
  warnings: ProgramGenerationWarnings;
};

export type GenerateProgramResult = { error: string } | { result: ResolvedProgramGeneration };

// The percent-of-a-reference-pace resolution -- structurally identical to
// plan-import.ts's own computePaceTarget, generalized to any of the 8
// PaceReferenceKey bases instead of just 5k/marathon, and taking an
// already-numeric percent range (Program authoring stores this as real
// columns, not prose to regex-parse). percentMax (the higher, faster
// percent) produces the faster/lower-time edge (min); percentMin produces
// the slower/higher-time edge (max) -- matches planned_pace_s_per_mi/_max's
// own "max >= min" convention. Returns null (never a fabricated number)
// when the athlete has no reference pace on file for that key.
export function computeProgramPaceTarget(
  basis: PaceReferenceKey,
  percentMin: number,
  percentMax: number,
  referenceSecondsByKey: ProgramAthleteReferenceInputs,
): { min: number; max: number } | null {
  const referenceSeconds = referenceSecondsByKey[basis];
  if (referenceSeconds == null) return null;
  const min = computeWorkoutPaceSeconds(referenceSeconds, percentMax, "pace");
  const max = computeWorkoutPaceSeconds(referenceSeconds, percentMin, "pace");
  return { min, max };
}

function isFinitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * A day's own pace_percent_basis/min/max is deliberately never set by
 * framework-seed.ts/framework-structure.ts at the DAY level (only at
 * STEP level, program_day_steps.target_pace_percent_*) -- see that
 * module's own header. But the headline pace a coach sees on a workout
 * card resolves live purely off these three day-level columns
 * (calendar-data.ts's own resolvePacePercent call is gated on exactly
 * that), so without this every percent-based framework day would show no
 * pace at all despite its steps carrying real ones.
 *
 * Derives one from the day's own steps: the step with the FASTEST stated
 * percent among its non-warm-up/cool-down ("work") steps -- the float
 * leg of a cruise-interval pair, or an easier rung of a ladder, is real
 * structured content but not what "the pace for this session" should
 * mean on the card. Still never a literal resolved pace -- same percent-
 * basis/min/max shape, resolved live exactly like every other pace
 * percent on this platform (this file's own header above on why that's
 * deliberate and was already tried the other way once).
 */
function deriveTopLevelPacePercent(
  steps: { stepType: WorkoutStepType; targetPacePercentBasis: PaceReferenceKey | null; targetPacePercentMin: number | null; targetPacePercentMax: number | null }[],
): { basis: PaceReferenceKey; min: number; max: number | null } | null {
  const workSteps = steps.filter(
    (s): s is typeof s & { targetPacePercentBasis: PaceReferenceKey; targetPacePercentMin: number } =>
      s.stepType !== "warmup" && s.stepType !== "cooldown" && s.targetPacePercentBasis != null && s.targetPacePercentMin != null,
  );
  if (workSteps.length === 0) return null;
  const primary = workSteps.reduce((best, s) => (s.targetPacePercentMin > best.targetPacePercentMin ? s : best));
  return { basis: primary.targetPacePercentBasis, min: primary.targetPacePercentMin, max: primary.targetPacePercentMax ?? null };
}

/**
 * Distance / a LITERAL pace only -- deliberately never from a percent-
 * based pace, which (per this file's own header) is never resolved here
 * at all. A duration baked from a percent resolved once at assignment
 * time would go stale the exact way a baked literal pace already did and
 * was reverted for -- so for the overwhelming majority of framework days
 * (pace is always a percent, never a literal, until read time), this
 * stays null, which is the honest answer, not a gap to fill in later.
 */
function deriveDurationS(distanceM: number | null, paceSPerMi: number | null): number | null {
  if (distanceM == null || paceSPerMi == null) return null;
  return Math.round((distanceM / MILE_METERS) * paceSPerMi);
}

export function resolveProgramGeneration(input: GenerateProgramInput): GenerateProgramResult {
  const { variantPhases, phaseSelections, days, weekLabels, weekVolumes, anchor } = input;

  // --- Step 1: phase selection, fail loudly, never adjust a chosen length. ---
  const selectionByPhase = new Map(phaseSelections.map((s) => [s.phaseDefinitionId, s]));
  const resolvedPhaseWeeks: { phase: ProgramPhaseDefinition; weeks: number }[] = [];
  for (const phase of variantPhases) {
    const selection = selectionByPhase.get(phase.id);
    const included = !phase.isOptional || (selection?.include ?? false);
    if (!included) continue;
    const weeks = selection?.weeks;
    if (weeks == null || !Number.isFinite(weeks) || weeks < phase.durationWeeksMin || weeks > phase.durationWeeksMax) {
      return {
        error: `Choose a week count between ${phase.durationWeeksMin} and ${phase.durationWeeksMax} for ${phase.name ?? phase.phaseKey}.`,
      };
    }
    resolvedPhaseWeeks.push({ phase, weeks });
  }
  const totalWeeks = resolvedPhaseWeeks.reduce((sum, p) => sum + p.weeks, 0);
  if (totalWeeks < 1) {
    return { error: "This program has no phases selected -- nothing to assign." };
  }

  const includedPhaseIds = new Set(resolvedPhaseWeeks.map((p) => p.phase.id));
  const weeksByPhaseId = new Map(resolvedPhaseWeeks.map((p) => [p.phase.id, p.weeks]));

  // --- Step 2: partition authored content by the selected week count. ---
  const inRangeDays: ProgramDayContent[] = [];
  const outOfRangeDays: { sourceProgramDayId: string; phaseDefinitionId: string; weekNumber: number }[] = [];
  for (const day of days) {
    if (!includedPhaseIds.has(day.phaseDefinitionId)) continue;
    const selectedWeeks = weeksByPhaseId.get(day.phaseDefinitionId)!;
    if (day.weekNumber <= selectedWeeks) {
      inRangeDays.push(day);
    } else {
      outOfRangeDays.push({ sourceProgramDayId: day.id, phaseDefinitionId: day.phaseDefinitionId, weekNumber: day.weekNumber });
    }
  }
  const outOfRangeDayIds = new Set(outOfRangeDays.map((d) => d.sourceProgramDayId));

  // --- Step 3: event-day uniqueness (defense in depth) + startDate resolution. ---
  const eventDays = days.filter((d) => d.isEventDay && includedPhaseIds.has(d.phaseDefinitionId));
  if (eventDays.length > 1) {
    return { error: "This program has more than one day marked as race day -- a data integrity problem, not a normal input." };
  }
  const eventDay = eventDays[0] ?? null;
  const eventDayIsOutOfRange = eventDay ? outOfRangeDayIds.has(eventDay.id) : false;
  if (eventDay && eventDayIsOutOfRange) {
    const phase = variantPhases.find((p) => p.id === eventDay.phaseDefinitionId);
    const selectedWeeks = weeksByPhaseId.get(eventDay.phaseDefinitionId);
    return {
      error: `Your marked race day falls in week ${eventDay.weekNumber} of ${phase?.name ?? phase?.phaseKey ?? "a phase"}, which is outside the ${selectedWeeks ?? "?"} weeks you selected for that phase. Increase the phase length or unmark race day to continue.`,
    };
  }

  // Offset (days) of the event-day slot from the program's own start.
  function eventDayOffset(): number {
    if (!eventDay) return 0;
    let weeksBefore = 0;
    for (const { phase, weeks } of resolvedPhaseWeeks) {
      if (phase.id === eventDay.phaseDefinitionId) break;
      weeksBefore += weeks;
    }
    return weeksBefore * 7 + (eventDay.weekNumber - 1) * 7 + (eventDay.dayOfWeek - 1);
  }

  let startDate: string;
  if (eventDay && !eventDayIsOutOfRange && anchor.kind === "targetEventDate") {
    startDate = addDays(anchor.targetEventDate, -eventDayOffset());
  } else if (anchor.kind === "startDate") {
    startDate = anchor.startDate;
  } else {
    // No valid event-day slot, anchored by target event date: approximate
    // placement (the final week's Monday falls in race week) -- clearly
    // weaker than the event-day-slot case, never adjusted further to try
    // to force an exact match.
    startDate = addDays(mostRecentMonday(new Date(`${anchor.targetEventDate}T00:00:00Z`)), -(totalWeeks - 1) * 7);
  }

  // --- Step 4: assign phase date spans; compute in-range days' real dates. ---
  const resolvedPhases: ResolvedProgramPhase[] = [];
  const phaseStartByPhaseId = new Map<string, string>();
  let cursor = startDate;
  for (const { phase, weeks } of resolvedPhaseWeeks) {
    const phaseStart = cursor;
    const phaseEnd = addDays(phaseStart, weeks * 7 - 1);
    resolvedPhases.push({
      phaseDefinitionId: phase.id,
      phaseKey: phase.phaseKey,
      name: phase.name,
      startDate: phaseStart,
      endDate: phaseEnd,
      explainer: phase.explainer,
    });
    phaseStartByPhaseId.set(phase.id, phaseStart);
    cursor = addDays(phaseStart, weeks * 7);
  }
  const endDate = resolvedPhases.length > 0 ? resolvedPhases[resolvedPhases.length - 1].endDate : startDate;

  function scheduledDateFor(day: ProgramDayContent): string {
    const phaseStart = phaseStartByPhaseId.get(day.phaseDefinitionId)!;
    return addDays(phaseStart, (day.weekNumber - 1) * 7 + (day.dayOfWeek - 1));
  }

  // --- Step 5: scaling, distance and duration fully independent, one canonical unit each (meters / seconds). ---
  let distanceScale = 1;
  let referencePeakWeeklyMeters: number | null = null;
  if (input.scalesDistanceWithMileage) {
    const targetMeters = isFinitePositive(input.targetPeakWeeklyMiles) ? input.targetPeakWeeklyMiles * MILE_METERS : null;
    if (targetMeters == null) {
      return { error: "Enter a target peak weekly mileage greater than zero." };
    }
    const weeklyTotals = weeklyDistanceTotals(inRangeDays);
    const reference = weeklyTotals.length > 0 ? Math.max(...weeklyTotals) : 0;
    if (!isFinitePositive(reference)) {
      return { error: "This program scales by distance, but has no distance-based workouts to compute a reference peak from." };
    }
    referencePeakWeeklyMeters = reference;
    distanceScale = scaleForTargetPeak(reference, targetMeters);
  }

  let durationScale = 1;
  let referencePeakWeeklyDurationS: number | null = null;
  if (input.scalesDurationWithMileage) {
    const targetSeconds = isFinitePositive(input.targetPeakWeeklyDurationS) ? input.targetPeakWeeklyDurationS : null;
    if (targetSeconds == null) {
      return { error: "Enter a target peak weekly duration greater than zero." };
    }
    const weeklyTotals = weeklyDurationTotals(inRangeDays);
    const reference = weeklyTotals.length > 0 ? Math.max(...weeklyTotals) : 0;
    if (!isFinitePositive(reference)) {
      return { error: "This program scales by duration, but has no duration-based workouts to compute a reference peak from." };
    }
    referencePeakWeeklyDurationS = reference;
    durationScale = scaleForTargetPeak(reference, targetSeconds);
  }

  // --- Step 6: apply scales. pace_percent_basis/min/max passes through
  // unresolved, same as pace_reference -- see this file's own header
  // comment for why resolution moved to read time. ---
  const resolvedDays: ResolvedProgramDay[] = inRangeDays.map((day) => {
    const steps: ResolvedProgramStep[] = day.steps.map((step) => ({
      sourceProgramDayId: day.id,
      stepOrder: step.stepOrder,
      stepType: step.stepType,
      durationS: step.durationS != null ? Math.round(scaleDistance(step.durationS, durationScale)) : null,
      durationMaxS: step.durationMaxS != null ? Math.round(scaleDistance(step.durationMaxS, durationScale)) : null,
      distanceM: step.distanceM != null ? Math.round(scaleDistance(step.distanceM, distanceScale)) : null,
      distanceMaxM: step.distanceMaxM != null ? Math.round(scaleDistance(step.distanceMaxM, distanceScale)) : null,
      targetType: step.targetType,
      targetMin: step.targetMin,
      targetMax: step.targetMax,
      targetUnit: step.targetUnit,
      targetPaceReference: step.targetPaceReference,
      targetPacePercentBasis: step.targetPacePercentBasis ?? null,
      targetPacePercentMin: step.targetPacePercentMin ?? null,
      targetPacePercentMax: step.targetPacePercentMax ?? null,
      repetitions: step.repetitions,
      repetitionsMax: step.repetitionsMax,
      restS: step.restS,
      restMaxS: step.restMaxS,
      instructions: step.instructions,
    }));

    const plannedDistanceM = day.plannedDistanceM != null ? Math.round(scaleDistance(day.plannedDistanceM, distanceScale)) : null;
    const plannedDistanceMaxM = day.plannedDistanceMaxM != null ? Math.round(scaleDistance(day.plannedDistanceMaxM, distanceScale)) : null;

    // Both `??` fallbacks: a day that already has a real, hand-authored
    // value (canyon-program.ts's own dayLabel vocabulary, or a day-level
    // percent framework-seed.ts's own "single unambiguous clause" rule
    // did set) keeps it untouched -- these only fill in what's currently
    // always null for the web-PDF-transcribed frameworks.
    const pacePercent = day.pacePercentBasis == null ? deriveTopLevelPacePercent(steps) : null;
    const dayLabel =
      day.dayLabel ??
      classifyWorkoutTitle({
        notes: day.notes,
        distanceMiMin: plannedDistanceM != null ? plannedDistanceM / MILE_METERS : null,
        steps: steps.map((s) => ({
          stepType: s.stepType,
          targetPacePercentBasis: s.targetPacePercentBasis,
          targetPacePercentMin: s.targetPacePercentMin,
          targetPacePercentMax: s.targetPacePercentMax,
          repetitions: s.repetitions,
          restS: s.restS,
          restMaxS: s.restMaxS,
        })),
      });

    return {
      sourceProgramDayId: day.id,
      scheduledDate: scheduledDateFor(day),
      dayLabel,
      sessionSlot: day.sessionSlot,
      // Copied verbatim, never scaled: neither is a quantity, and both are
      // authored framework intent rather than anything per-athlete.
      isOptional: day.isOptional,
      alternativeText: day.alternativeText,
      plannedDistanceM,
      plannedDistanceMaxM,
      plannedDurationS: day.plannedDurationS != null ? Math.round(scaleDistance(day.plannedDurationS, durationScale)) : deriveDurationS(plannedDistanceM, day.plannedPaceSPerMi),
      plannedDurationMaxS: day.plannedDurationMaxS != null ? Math.round(scaleDistance(day.plannedDurationMaxS, durationScale)) : deriveDurationS(plannedDistanceMaxM, day.plannedPaceMaxSPerMi ?? day.plannedPaceSPerMi),
      plannedPaceSPerMi: day.plannedPaceSPerMi,
      plannedPaceMaxSPerMi: day.plannedPaceMaxSPerMi,
      paceReference: day.paceReference,
      pacePercentBasis: day.pacePercentBasis ?? pacePercent?.basis ?? null,
      pacePercentMin: day.pacePercentMin ?? pacePercent?.min ?? null,
      pacePercentMax: day.pacePercentMax ?? pacePercent?.max ?? null,
      plannedHrBpm: day.plannedHrBpm,
      plannedHrMaxBpm: day.plannedHrMaxBpm,
      plannedRpe: day.plannedRpe,
      plannedRpeMax: day.plannedRpeMax,
      notes: day.notes,
      steps,
      extras: day.extras,
    };
  });

  // --- Step 7: weeks[] + raceDayAlignment. ---
  const resolvedWeeks = buildWeeks(resolvedDays, weekLabels, weekVolumes, resolvedPhases);

  let raceDayAlignment: ResolvedProgramGeneration["raceDayAlignment"] = null;
  const targetEventDate = anchor.kind === "targetEventDate" ? anchor.targetEventDate : anchor.targetEventDate;
  if (targetEventDate) {
    raceDayAlignment = {
      targetEventDate,
      finalTrainingWeekEndDate: endDate,
      daysBetween: daysBetween(endDate, targetEventDate),
      eventDaySourceProgramDayId: eventDay && !eventDayIsOutOfRange ? eventDay.id : null,
    };
  }

  // --- Step 8: flag anything scheduled after the event; out-of-range already collected. ---
  const daysAfterEventDate = targetEventDate
    ? resolvedDays.filter((d) => d.scheduledDate > targetEventDate).map((d) => d.sourceProgramDayId)
    : [];

  // --- Step 9: empty-phase/week warnings. ---
  const emptyPhaseDefinitionIds: string[] = [];
  const emptyWeeks: { phaseDefinitionId: string; weekNumber: number }[] = [];
  for (const { phase, weeks } of resolvedPhaseWeeks) {
    const phaseDays = inRangeDays.filter((d) => d.phaseDefinitionId === phase.id);
    if (phaseDays.length === 0) {
      emptyPhaseDefinitionIds.push(phase.id);
      continue;
    }
    const daysByWeek = new Map<number, number>();
    for (const d of phaseDays) daysByWeek.set(d.weekNumber, (daysByWeek.get(d.weekNumber) ?? 0) + 1);
    for (let week = 1; week <= weeks; week++) {
      if (!daysByWeek.has(week)) emptyWeeks.push({ phaseDefinitionId: phase.id, weekNumber: week });
    }
  }

  return {
    result: {
      phases: resolvedPhases,
      weeks: resolvedWeeks,
      days: resolvedDays,
      startDate,
      endDate,
      totalWeeks,
      referencePeakWeeklyMiles: referencePeakWeeklyMeters != null ? referencePeakWeeklyMeters / MILE_METERS : null,
      referencePeakWeeklyDurationS,
      raceDayAlignment,
      warnings: { emptyPhaseDefinitionIds, emptyWeeks, daysAfterEventDate, outOfRangeDays },
    },
  };
}

function weekKeyFor(day: ProgramDayContent): string {
  return `${day.phaseDefinitionId}|${day.weekNumber}`;
}

function weeklyDistanceTotals(days: ProgramDayContent[]): number[] {
  const totals = new Map<string, number>();
  for (const day of days) {
    if (day.plannedDistanceM == null) continue;
    const key = weekKeyFor(day);
    totals.set(key, (totals.get(key) ?? 0) + day.plannedDistanceM);
  }
  return [...totals.values()];
}

function weeklyDurationTotals(days: ProgramDayContent[]): number[] {
  const totals = new Map<string, number>();
  for (const day of days) {
    if (day.plannedDurationS == null) continue;
    const key = weekKeyFor(day);
    totals.set(key, (totals.get(key) ?? 0) + day.plannedDurationS);
  }
  return [...totals.values()];
}

// Builds one ResolvedProgramWeek per real calendar week that has at least
// one resolved day. A week with an authored program_phase_weeks label but
// zero days still isn't given a week here (nothing to schedule) -- that
// gap is exactly what warnings.emptyWeeks already reports.
//
// WHERE A WEEK'S TARGET VOLUME COMES FROM. Two sources, in strict priority:
//
//   1. The selected peak-volume variant's AUTHORED goal mileage for that
//      phase week, when the program has one. This is the only correct
//      source for the seeded frameworks, whose weekly total is a target the
//      athlete distributes across the week themselves ("adjust easy run
//      lengths as needed to hit the weekly total") and is emphatically NOT
//      the sum of the authored days -- those days carry no distances at
//      all, so summing them would write a target of 0 for all 18 weeks.
//      An authored "n/a" (race week) resolves to null: no total prescribed,
//      which must not become zero.
//
//   2. Otherwise, the sum of that week's own already-scaled day distances,
//      exactly as before -- the "derive, never hand-maintain separately"
//      discipline plan-import.ts's week-total reduce uses, and still right
//      for every hand-authored program, where the days ARE the volume.
//
// Only an authored range produces a targetVolumeMax; a derived total is a
// single number with no upper bound, as it has always been.
function buildWeeks(
  resolvedDays: ResolvedProgramDay[],
  weekLabels: ProgramPhaseWeekLabel[],
  weekVolumes: ProgramPhaseWeekVolume[],
  phases: ResolvedProgramPhase[],
): ResolvedProgramWeek[] {
  const labelByKey = new Map(weekLabels.map((w) => [`${w.phaseDefinitionId}|${w.weekNumber}`, w.label]));
  const notesByKey = new Map(weekLabels.map((w) => [`${w.phaseDefinitionId}|${w.weekNumber}`, w.notes ?? null]));
  const volumeByKey = new Map(weekVolumes.map((v) => [`${v.phaseDefinitionId}|${v.weekNumber}`, v]));
  const totalsByWeekStart = new Map<string, number>();
  const labelByWeekStart = new Map<string, string | null>();
  const notesByWeekStart = new Map<string, string | null>();
  const authoredByWeekStart = new Map<string, ProgramPhaseWeekVolume | undefined>();

  for (const phase of phases) {
    for (const day of resolvedDays) {
      if (day.scheduledDate < phase.startDate || day.scheduledDate > phase.endDate) continue;
      const weekStart = mostRecentMonday(new Date(`${day.scheduledDate}T00:00:00Z`));
      const weekOffsetDays = daysBetween(phase.startDate, weekStart);
      const weekNumber = Math.floor(weekOffsetDays / 7) + 1;
      const key = `${phase.phaseDefinitionId}|${weekNumber}`;
      totalsByWeekStart.set(weekStart, (totalsByWeekStart.get(weekStart) ?? 0) + (day.plannedDistanceM ?? 0));
      if (!labelByWeekStart.has(weekStart)) labelByWeekStart.set(weekStart, labelByKey.get(key) ?? null);
      if (!notesByWeekStart.has(weekStart)) notesByWeekStart.set(weekStart, notesByKey.get(key) ?? null);
      if (!authoredByWeekStart.has(weekStart)) authoredByWeekStart.set(weekStart, volumeByKey.get(key));
    }
  }

  return [...totalsByWeekStart.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([weekStart, totalMeters]) => {
      const authored = authoredByWeekStart.get(weekStart);
      return {
        weekStart,
        targetVolumeMin: authored ? authored.goalMileageMin : Math.round((totalMeters / MILE_METERS) * 10) / 10,
        targetVolumeMax: authored ? authored.goalMileageMax : null,
        label: labelByWeekStart.get(weekStart) ?? null,
        notes: notesByWeekStart.get(weekStart) ?? null,
      };
    });
}
