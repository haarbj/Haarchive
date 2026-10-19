// A safe week-by-week mileage ramp toward a goal, plus an ACWR read on
// each planned week -- the public counterpart to the private-coaching
// engine's own mileage ramp (coaching-engine/mileage-progression.ts) and
// the dashboard's own training-load math (acwr.ts). Deliberately reuses
// both rather than inventing a second ramp rate or a second set of ACWR
// bands: WEEKLY_INCREASE_CAP/CUTBACK_REDUCTION are the exact numbers a
// coach-assigned plan already ramps by, and zoneForRatio is the exact
// banding the dashboard already uses to read a real athlete's training
// history. This module's only genuinely new piece is the ramp-to-a-goal
// (rather than ramp-to-a-race) shape and the "can this goal be reached
// safely in the time given" check neither existing module needed to
// answer.
//
// Evidence-honesty note (see the tool's own UI copy for the full version):
// the 10%/week cap is a widely-repeated rule of thumb, not a result with
// its own dedicated trial; the acute:chronic workload ratio research it's
// paired with here comes mostly from team-sport literature (Gabbett 2016
// and the debate around it), not distance running specifically. Both are
// shown as directional guidance, not a verdict.

import { zoneForRatio, type AcwrZone } from "@/lib/acwr";
import { CUTBACK_REDUCTION, WEEKLY_INCREASE_CAP } from "@/lib/coaching-engine/mileage-progression";
import { CUTBACK_INTERVAL_WEEKS } from "@/lib/coaching-engine/periodization";

export { CUTBACK_INTERVAL_WEEKS, CUTBACK_REDUCTION, WEEKLY_INCREASE_CAP };

export type PlannedWeek = {
  weekNumber: number;
  mileage: number;
  isCutback: boolean;
  /** Acute (this week) / chronic (this week's own trailing 4-week average, the same "coupled" convention acwr.ts uses). Null only if chronic average is 0 (can't happen once any real mileage is entered, kept for type-safety). */
  acwr: number | null;
  zone: AcwrZone | null;
};

export type SafeAlternative = {
  /** How many weeks (from today, at the same ramp rate) it would actually take to reach the goal safely. */
  weeksNeeded: number;
  /** The highest weekly mileage reachable within the weeks actually available, ramping at the same safe rate. */
  maxSafeMileageInGivenWeeks: number;
};

export type TrainingLoadPlan = {
  weeks: PlannedWeek[];
  /** True if the ramp reaches (or would hold at) the goal within the given weeks without exceeding the safe ramp rate. */
  reachesGoal: boolean;
  /** Set only when reachesGoal is false. */
  safeAlternative: SafeAlternative | null;
};

const MAX_SEARCH_WEEKS = 520; // 10 years -- a sane upper bound so a search for "weeks needed" can't loop forever on a goal that's effectively unreachable (e.g. 0 current mileage ramping toward a huge goal climbs slowly but never literally gets stuck, so this is a safety cap, not an expected real answer)

type RampState = { lastRampMileage: number; trainingWeekCount: number };

// One week's worth of the exact same ramp/cutback arithmetic
// mileage-progression.ts uses for a coach-assigned plan (minus that
// engine's taper/peak-ceiling logic, which has no equivalent here -- this
// tool ramps toward a flat weekly-mileage goal, not a race).
function stepWeek(state: RampState, goalM: number): { mileage: number; isCutback: boolean; next: RampState } {
  const trainingWeekCount = state.trainingWeekCount + 1;
  if (trainingWeekCount % CUTBACK_INTERVAL_WEEKS === 0) {
    const mileage = Math.round(state.lastRampMileage * (1 - CUTBACK_REDUCTION));
    return { mileage, isCutback: true, next: { lastRampMileage: state.lastRampMileage, trainingWeekCount } };
  }
  const mileage = Math.round(Math.min(goalM, state.lastRampMileage * (1 + WEEKLY_INCREASE_CAP)));
  return { mileage, isCutback: false, next: { lastRampMileage: mileage, trainingWeekCount } };
}

/**
 * Builds the N-week plan and, when the goal genuinely can't be reached
 * safely in that many weeks, the safe alternative (more weeks needed, or
 * the highest mileage actually reachable in the weeks given).
 *
 * `last4WeeksM` is oldest-to-most-recent; the ramp starts from the most
 * recent week (where the runner actually is right now) -- the other three
 * weeks exist only to seed each planned week's rolling 4-week chronic
 * average, so the very first planned week's ACWR reflects real recent
 * history, not just itself.
 */
export function buildTrainingLoadPlan(last4WeeksM: [number, number, number, number], goalWeeklyM: number, weeksAvailable: number): TrainingLoadPlan {
  const history: number[] = [...last4WeeksM];
  let state: RampState = { lastRampMileage: last4WeeksM[3], trainingWeekCount: 0 };
  const weeks: PlannedWeek[] = [];

  for (let weekNumber = 1; weekNumber <= weeksAvailable; weekNumber++) {
    const { mileage, isCutback, next } = stepWeek(state, goalWeeklyM);
    state = next;
    history.push(mileage);

    const chronicWindow = history.slice(-4);
    const chronic = chronicWindow.reduce((sum, m) => sum + m, 0) / chronicWindow.length;
    const ratio = chronic > 0 ? mileage / chronic : null;

    weeks.push({ weekNumber, mileage, isCutback, acwr: ratio, zone: ratio === null ? null : zoneForRatio(ratio) });
  }

  const reachesGoal = state.lastRampMileage >= goalWeeklyM;

  return {
    weeks,
    reachesGoal,
    // state.lastRampMileage here is exactly "the peak mileage the plan
    // above actually reached in the weeks given" -- reused directly
    // rather than re-simulated, so the two numbers can't drift apart.
    safeAlternative: reachesGoal ? null : { weeksNeeded: weeksNeededToReachGoal(last4WeeksM[3], goalWeeklyM), maxSafeMileageInGivenWeeks: state.lastRampMileage },
  };
}

// How many weeks (at the same safe ramp rate, continuing past
// weeksAvailable) it would actually take to reach the goal -- the "more
// weeks needed" half of the safe alternative.
function weeksNeededToReachGoal(startingMileageM: number, goalWeeklyM: number): number {
  let state: RampState = { lastRampMileage: startingMileageM, trainingWeekCount: 0 };
  let weeksNeeded = 0;

  while (state.lastRampMileage < goalWeeklyM && weeksNeeded < MAX_SEARCH_WEEKS) {
    const { next } = stepWeek(state, goalWeeklyM);
    state = next;
    weeksNeeded += 1;
  }

  return weeksNeeded;
}
