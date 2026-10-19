// Turns a single reference pace into a complete, structured interval
// session: warmup, a repeated work/recovery main set, and a cooldown, with
// totals and a Garmin-structured-workout-style plain-language program.
// Deliberately does no pace *prediction* of its own -- the reference pace
// is a given (typed in, or copied from a zone on one of this site's other
// pace calculators), the same way the Race Pace Planner takes a goal pace
// as a given rather than predicting it (see race-pace-planner/fueling-plan.ts's
// own header comment for that same pattern).
//
// All distance math happens in meters and all pace math happens in seconds
// per meter internally -- unit-agnostic, so a mi/km display toggle is a
// pure formatting concern (see paceRangeForDisplay/formatMetersAuto below),
// never a recomputation.

import { PACE_UNIT_LABEL, PACE_UNIT_METERS, formatPaceOutput, type PaceUnit } from "@/lib/pace-percent-math";
import { formatClock } from "@/lib/running-format";

export type RecoveryType = "jog" | "walk" | "stand";

export const RECOVERY_TYPE_LABEL: Record<RecoveryType, string> = {
  jog: "Recovery jog",
  walk: "Recovery walk",
  stand: "Rest",
};

const RECOVERY_VERB: Record<RecoveryType, string> = {
  jog: "Jog",
  walk: "Walk",
  stand: "Rest",
};

export type MainSetMode = "distance" | "time";
export type RecoveryMode = "distance" | "time";

export type WorkoutInputs = {
  /** Seconds per meter at the target intensity -- the one number every main-set rep is built around. */
  referencePaceSecPerMeter: number;
  /** Seconds per meter assumed for the warmup, cooldown, and a "jog" recovery -- only ever used for the total-time estimate, never prescribed as a watch target (see buildGarminProgram). */
  easyPaceSecPerMeter: number;
  warmupMeters: number;
  cooldownMeters: number;
  /** 1-20, per this tool's own input range. */
  reps: number;
  mainSetMode: MainSetMode;
  mainSetDistanceMeters: number;
  mainSetDurationSeconds: number;
  recoveryMode: RecoveryMode;
  recoveryDistanceMeters: number;
  recoveryDurationSeconds: number;
  recoveryType: RecoveryType;
};

export type WorkoutStep = {
  label: string;
  distanceMeters: number;
  durationSeconds: number;
  /** Null when the step is run "open" (no prescribed pace) -- every warmup, cooldown, and recovery step, matching how a real structured workout would actually be programmed (see this file's header). */
  targetPaceSecPerMeter: number | null;
};

export type WorkoutPlan = {
  steps: WorkoutStep[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
};

// A brisk-walk assumption (~17:00/mi), used only to estimate total time for
// a "walk" recovery (or a "stand" recovery given as a distance, an edge
// case the UI itself doesn't offer -- see the component) -- never shown as
// a prescribed pace.
const WALK_PACE_SEC_PER_METER = (17 * 60) / PACE_UNIT_METERS.mi;

function assumedRecoveryPaceSecPerMeter(type: RecoveryType, easyPaceSecPerMeter: number): number {
  switch (type) {
    case "jog":
      return easyPaceSecPerMeter;
    case "walk":
      return WALK_PACE_SEC_PER_METER;
    case "stand":
      return 0; // covers no ground, by assumption.
  }
}

function mainSetStep(inputs: WorkoutInputs): { distanceMeters: number; durationSeconds: number } {
  if (inputs.mainSetMode === "distance") {
    const distanceMeters = inputs.mainSetDistanceMeters;
    return { distanceMeters, durationSeconds: distanceMeters * inputs.referencePaceSecPerMeter };
  }
  const durationSeconds = inputs.mainSetDurationSeconds;
  return { distanceMeters: durationSeconds / inputs.referencePaceSecPerMeter, durationSeconds };
}

function recoveryStep(inputs: WorkoutInputs): { distanceMeters: number; durationSeconds: number } {
  if (inputs.recoveryMode === "time") {
    const durationSeconds = inputs.recoveryDurationSeconds;
    const pace = assumedRecoveryPaceSecPerMeter(inputs.recoveryType, inputs.easyPaceSecPerMeter);
    return { distanceMeters: pace > 0 ? durationSeconds / pace : 0, durationSeconds };
  }
  const distanceMeters = inputs.recoveryDistanceMeters;
  // A "stand" recovery given as a distance is a contradiction the UI
  // doesn't actually offer (see pace-model-comparison.tsx's sibling
  // component), but this stays well-defined rather than dividing by zero.
  const pace = inputs.recoveryType === "stand" ? WALK_PACE_SEC_PER_METER : assumedRecoveryPaceSecPerMeter(inputs.recoveryType, inputs.easyPaceSecPerMeter);
  return { distanceMeters, durationSeconds: distanceMeters * pace };
}

export function buildWorkoutPlan(inputs: WorkoutInputs): WorkoutPlan {
  const steps: WorkoutStep[] = [];

  steps.push({
    label: "Warmup",
    distanceMeters: inputs.warmupMeters,
    durationSeconds: inputs.warmupMeters * inputs.easyPaceSecPerMeter,
    targetPaceSecPerMeter: null,
  });

  const rep = mainSetStep(inputs);
  const recovery = recoveryStep(inputs);
  const recoveryLabel = RECOVERY_TYPE_LABEL[inputs.recoveryType];

  for (let i = 1; i <= inputs.reps; i++) {
    steps.push({
      label: `Rep ${i}`,
      distanceMeters: rep.distanceMeters,
      durationSeconds: rep.durationSeconds,
      targetPaceSecPerMeter: inputs.referencePaceSecPerMeter,
    });
    steps.push({
      label: `${recoveryLabel} ${i}`,
      distanceMeters: recovery.distanceMeters,
      durationSeconds: recovery.durationSeconds,
      targetPaceSecPerMeter: null,
    });
  }

  steps.push({
    label: "Cooldown",
    distanceMeters: inputs.cooldownMeters,
    durationSeconds: inputs.cooldownMeters * inputs.easyPaceSecPerMeter,
    targetPaceSecPerMeter: null,
  });

  const totalDistanceMeters = steps.reduce((sum, s) => sum + s.distanceMeters, 0);
  const totalDurationSeconds = steps.reduce((sum, s) => sum + s.durationSeconds, 0);
  return { steps, totalDistanceMeters, totalDurationSeconds };
}

// --- Display formatting -----------------------------------------------------
//
// Garmin (and every other GPS-watch structured-workout editor) requires a
// pace TARGET to be a range, not one number -- a watch can't hold you to an
// exact instant. ±5 sec/[unit] is this tool's own reasonable default width,
// not a model output.
export const TARGET_PACE_HALF_WIDTH_SECONDS = 5;

/** [fast, slow] pace, in seconds at the given display unit -- fast first, matching every pace range already shown elsewhere on this site. */
export function paceRangeForDisplay(
  paceSecPerMeter: number,
  unit: PaceUnit,
  halfWidthSeconds: number = TARGET_PACE_HALF_WIDTH_SECONDS,
): [number, number] {
  const paceSecondsAtUnit = paceSecPerMeter * PACE_UNIT_METERS[unit];
  return [paceSecondsAtUnit - halfWidthSeconds, paceSecondsAtUnit + halfWidthSeconds];
}

export function formatPaceRange(paceSecPerMeter: number, unit: PaceUnit, halfWidthSeconds?: number): string {
  const [fast, slow] = paceRangeForDisplay(paceSecPerMeter, unit, halfWidthSeconds);
  return `${formatPaceOutput(fast, unit)}–${formatPaceOutput(slow, unit)}${PACE_UNIT_LABEL[unit]}`;
}

/** "400m" under 1km, "2.0 km" (or "2.4 km") at or above it -- matches how a rep distance is conventionally read aloud, and avoids an awkward fractional-mile reading of a 400m rep. */
export function formatMetersAuto(meters: number): string {
  if (meters >= 1000) {
    const km = Math.round((meters / 1000) * 100) / 100;
    return `${km} km`;
  }
  return `${Math.round(meters)}m`;
}

/** Warmup/cooldown distances are entered directly in the runner's own chosen pace unit, so they're always displayed in that same unit (never auto-switched to meters). */
export function formatDistanceInUnit(meters: number, unit: PaceUnit): string {
  const value = Math.round((meters / PACE_UNIT_METERS[unit]) * 100) / 100;
  return `${value} ${unit}`;
}

// --- "Program this on your watch" -------------------------------------------
//
// A real structured-workout editor (Garmin Connect and most others) treats
// a work+recovery pair repeated N times as ONE step containing two child
// steps, not N separate pairs -- so this condenses to exactly 3 top-level
// steps (Warmup, the Repeat block, Cooldown) regardless of rep count,
// mirroring how a runner would actually key this into their watch. Reads
// plan.steps[1]/[2] (the first rep/recovery pair) rather than re-deriving
// anything from inputs a second time, since every rep/recovery pair in the
// plan is identical by construction -- one source of truth shared with the
// step-by-step table.
export function buildGarminProgram(plan: WorkoutPlan, inputs: WorkoutInputs, unit: PaceUnit): string[] {
  const warmup = plan.steps[0];
  const rep = plan.steps[1];
  const recovery = plan.steps[2];
  const cooldown = plan.steps[plan.steps.length - 1];

  const repDescription =
    inputs.mainSetMode === "distance" ? `Run ${formatMetersAuto(rep.distanceMeters)}` : `Run for ${formatClock(rep.durationSeconds)}`;
  const repTarget = `@ ${formatPaceRange(inputs.referencePaceSecPerMeter, unit)}`;

  const recoveryVerb = RECOVERY_VERB[inputs.recoveryType];
  const recoveryDescription =
    inputs.recoveryType === "stand"
      ? `${recoveryVerb} for ${formatClock(recovery.durationSeconds)}`
      : inputs.recoveryMode === "distance"
        ? `${recoveryVerb} ${formatMetersAuto(recovery.distanceMeters)}`
        : `${recoveryVerb} for ${formatClock(recovery.durationSeconds)}`;

  return [
    `Step 1: Run ${formatDistanceInUnit(warmup.distanceMeters, unit)}, no target.`,
    `Step 2: Repeat ${inputs.reps}× — ${repDescription} ${repTarget}, then ${recoveryDescription}, no target.`,
    `Step 3: Run ${formatDistanceInUnit(cooldown.distanceMeters, unit)}, no target.`,
  ];
}
