// Pete Riegel's endurance equation: T2 = T1 x (D2/D1)^1.06. Same formula and
// exponent as the one currently inline (and unexported) in
// pace-calculator.tsx -- this is its canonical, tested, importable home.
// Not called by generateTrainingPlan itself (goal time is a required input
// there, not predicted), but exported now so a fast-follow like "predict my
// goal time from a recent race" has somewhere to import it from instead of
// a third copy of the same math.
export function predictRaceTime(knownMeters: number, knownSeconds: number, targetMeters: number): number {
  return knownSeconds * Math.pow(targetMeters / knownMeters, 1.06);
}
