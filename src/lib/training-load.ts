import { initialFatigueState, stepFatigueState, type PhysiologyProfile } from "@/lib/physiology-engine";

export type WorkoutForLoad = {
  id: string;
  completedAt: string;
  distanceM: number;
  timeSeconds: number;
};

export type WorkoutLoadPoint = WorkoutForLoad & {
  glycogenDepletedPct: number;
  cardiacDriftPct: number;
  wPrimeUsedPct: number;
};

// workout_completions only stores one aggregate distance+time per run (no
// per-mile splits or grade, unlike a real GPS route), so each workout is
// approximated as a single flat, even-paced segment run at its average
// speed -- close enough to see relative day-to-day load, not a true
// mile-by-mile simulation like Marathon Pacing Calculator gets from a real
// route. Fatigue state always starts fresh per workout (not carried over
// from the previous one): W'-balance and cardiac drift are within-one-
// continuous-effort models (recovery timescale of minutes), not multi-day
// freshness models -- see physiology-engine.ts's own module doc.
export function computeWorkoutLoad(profile: PhysiologyProfile, workout: WorkoutForLoad): WorkoutLoadPoint {
  const speedMS = workout.distanceM / workout.timeSeconds;
  const state = stepFatigueState(initialFatigueState(profile), profile, {
    grade: 0,
    speedMS,
    distanceM: workout.distanceM,
  });
  return {
    ...workout,
    glycogenDepletedPct: (1 - state.glycogenRemainingFraction) * 100,
    cardiacDriftPct: state.cardiacDriftFraction * 100,
    wPrimeUsedPct: (1 - state.wPrimeBalanceFraction) * 100,
  };
}

export function buildTrainingLoadSeries(profile: PhysiologyProfile, workouts: WorkoutForLoad[]): WorkoutLoadPoint[] {
  return workouts
    .map((workout) => computeWorkoutLoad(profile, workout))
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
}
