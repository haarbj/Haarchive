// One day's entry in a plan, exactly as authored -- `totalDistance` is in
// miles, at the plan's own reference (unscaled) volume. `description` may
// contain `[[ N * multiplier|number:0 ]]` / `[[ units ]]` placeholders (see
// template.ts) for mileage-based easy/long days, or be complete, literal
// text for quality sessions already written in %5K/%marathon-pace terms,
// which never need scaling at all.
export type RawWorkout = {
  description: string;
  totalDistance: number;
};

export type RawPlanFile = {
  raceType: string;
  raceDistance: number;
  workouts: RawWorkout[];
};

// The five volume tracks, lowest to highest weekly mileage -- see data.ts
// for the actual computed stats behind that ordering.
export type TrackKey = "breeze" | "wind" | "gale" | "tornado" | "hurricane";
export type DurationWeeks = 12 | 18;

export type TrainingPlan = {
  slug: string;
  track: TrackKey;
  trackLabel: string;
  durationWeeks: DurationWeeks;
  raceType: string;
  raceDistanceMiles: number;
  workouts: RawWorkout[];
  // Computed once from the workouts array itself at module load -- never
  // hand-maintained separately, so these can never drift from the real data.
  referencePeakWeeklyMiles: number;
  referenceAvgWeeklyMiles: number;
  referenceTotalMiles: number;
};
