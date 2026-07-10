import { addDays } from "@/lib/coaching-engine/date-utils";
import { distanceBucket, type DistanceBucket } from "@/lib/coaching-engine/distance-buckets";
import type {
  MesocycleAllocation,
  MesocycleDraft,
  MesocyclePhase,
  WeekPlan,
} from "@/lib/coaching-engine/types";

const PHASE_WEIGHTS = { base: 0.45, build: 0.35, peak: 0.2 };
const TAPER_WEEKS_BY_BUCKET: Record<DistanceBucket, number> = { short: 1, middle: 2, long: 3 };
export const CUTBACK_INTERVAL_WEEKS = 4;

const FOCUS_NOTES: Record<MesocyclePhase, string> = {
  base: "Build aerobic volume; keep almost everything easy.",
  build: "Add tempo work on top of the base you've built.",
  peak: "Race-specific sharpening -- your hardest, most specific weeks.",
  taper: "Cut volume, hold a little intensity, arrive fresh.",
  recovery: "Cutback week -- reduced volume to absorb the block before it.",
};

// Splits the weeks available before goal day into base/build/peak/taper
// blocks. Taper length scales with race distance (a marathon needs longer
// to shed fatigue than a 5K); base/build/peak split the remainder 45/35/20,
// a standard, defensible starting allocation -- not a per-philosophy
// (polarized/pyramidal/threshold-heavy) model. Short plans collapse to just
// base + taper, since there isn't enough runway to sharpen safely.
export function allocateMesocycles(totalWeeks: number, goalDistanceM: number): MesocycleAllocation[] {
  const bucket = distanceBucket(goalDistanceM);
  const taper = Math.min(TAPER_WEEKS_BY_BUCKET[bucket], Math.max(1, Math.floor(totalWeeks / 4)));
  const remaining = totalWeeks - taper;

  if (remaining <= 3) {
    return [
      { phase: "base" as const, weeks: remaining },
      { phase: "taper" as const, weeks: taper },
    ].filter((allocation) => allocation.weeks > 0);
  }

  const base = Math.round(remaining * PHASE_WEIGHTS.base);
  const build = Math.round(remaining * PHASE_WEIGHTS.build);
  let peak = remaining - base - build;
  let adjustedBase = base;
  let adjustedBuild = build;

  if (peak < 1) {
    if (adjustedBase >= adjustedBuild) adjustedBase -= 1;
    else adjustedBuild -= 1;
    peak = 1;
  }

  return [
    { phase: "base", weeks: adjustedBase },
    { phase: "build", weeks: adjustedBuild },
    { phase: "peak", weeks: peak },
    { phase: "taper", weeks: taper },
  ];
}

export type DownWeekSettings = { enabled: boolean; intervalWeeks: number };

const DEFAULT_DOWN_WEEKS: DownWeekSettings = { enabled: true, intervalWeeks: CUTBACK_INTERVAL_WEEKS };

// Expands a phase allocation into one entry per week, substituting a
// recovery/cutback week every `intervalWeeks`th training week -- counting
// only base/build/peak weeks, since taper is already a deload and shouldn't
// be interrupted by a second one. Defaults preserve the original hardcoded
// behavior (every 4th week) for every existing caller; a coach building a
// season can now see and change this instead of it being invisible.
export function buildWeeklyPhaseSequence(
  allocation: MesocycleAllocation[],
  downWeeks: DownWeekSettings = DEFAULT_DOWN_WEEKS,
): WeekPlan[] {
  const weeks: WeekPlan[] = [];
  let weekIndex = 0;
  let trainingWeekCount = 0;

  for (const block of allocation) {
    for (let i = 0; i < block.weeks; i++) {
      let phase: MesocyclePhase = block.phase;
      let isCutback = false;

      if (block.phase !== "taper") {
        trainingWeekCount += 1;
        if (downWeeks.enabled && trainingWeekCount % downWeeks.intervalWeeks === 0) {
          phase = "recovery";
          isCutback = true;
        }
      }

      weeks.push({ weekIndex, phase, isCutback });
      weekIndex += 1;
    }
  }

  return weeks;
}

export type CoalescedMesocycles = {
  mesocycles: MesocycleDraft[];
  // weekMesocycleIndex[i] = which entry in `mesocycles` week i belongs to.
  weekMesocycleIndex: number[];
};

// Groups consecutive same-phase weeks into the mesocycle rows that actually
// get written to the database -- e.g. a 12-week base block with two 4-week
// cutbacks becomes [base 3wk, recovery 1wk, base 3wk, recovery 1wk, base
// 3wk, recovery 1wk] as six separate mesocycle rows, each using `recovery`
// as a first-class phase parallel to base/build/peak/taper, exactly as the
// schema models it. Returns the per-week mesocycle index alongside the
// drafts (computed from the same boundary walk) so callers never have to
// re-derive it by comparing dates.
export function coalesceMesocycles(weeks: WeekPlan[], planStartDate: string): CoalescedMesocycles {
  const mesocycles: MesocycleDraft[] = [];
  const weekMesocycleIndex: number[] = [];
  let blockStart = 0;

  for (let i = 1; i <= weeks.length; i++) {
    const atBoundary = i === weeks.length || weeks[i].phase !== weeks[blockStart].phase;
    if (!atBoundary) continue;

    const phase = weeks[blockStart].phase;
    const weeksInBlock = i - blockStart;
    const startDate = addDays(planStartDate, blockStart * 7);
    const endDate = addDays(planStartDate, blockStart * 7 + weeksInBlock * 7 - 1);
    const mesocycleIndex = mesocycles.length;
    mesocycles.push({ phase, startDate, endDate, focusNotes: FOCUS_NOTES[phase] });
    for (let week = blockStart; week < i; week++) weekMesocycleIndex.push(mesocycleIndex);
    blockStart = i;
  }

  return { mesocycles, weekMesocycleIndex };
}
