import breeze12 from "./source/expl_mee_breeze_12.json";
import breeze18 from "./source/expl_mee_breeze_18.json";
import gale12 from "./source/expl_mee_gale_12.json";
import gale18 from "./source/expl_mee_gale_18.json";
import hurricane12 from "./source/expl_mee_hurricane_12.json";
import hurricane18 from "./source/expl_mee_hurricane_18.json";
import tornado12 from "./source/expl_mee_tornado_12.json";
import tornado18 from "./source/expl_mee_tornado_18.json";
import wind12 from "./source/expl_mee_wind_12.json";
import wind18 from "./source/expl_mee_wind_18.json";
import type { DurationWeeks, RawPlanFile, TrackKey, TrainingPlan } from "./types";

// Real, day-by-day marathon plans exported from John J Davis's book
// "Marathon Excellence for Everyone" (github.com/johnjdavisiv/mee-expl,
// data only -- no app or license file in that repo, so nothing to port
// beyond the plans themselves). Five volume tracks (named after wind
// intensity), each offered as a 12- or 18-week build.
//
// TRACK_ORDER below is deliberately lowest-to-highest weekly mileage --
// verified directly from each file's own totalDistance figures (see
// buildPlan), not assumed from the naming: Breeze averages roughly
// 37-38 mi/week, Wind ~50-52, Gale ~62-65, Tornado ~74-76, Hurricane ~86,
// with peak weeks of roughly 48, 55, 70, 85, and 100 miles respectively.
const TRACK_LABELS: Record<TrackKey, string> = {
  breeze: "Breeze",
  wind: "Wind",
  gale: "Gale",
  tornado: "Tornado",
  hurricane: "Hurricane",
};

const TRACK_ORDER: TrackKey[] = ["breeze", "wind", "gale", "tornado", "hurricane"];

const RAW_FILES: Record<TrackKey, Record<DurationWeeks, RawPlanFile>> = {
  breeze: { 12: breeze12 as RawPlanFile, 18: breeze18 as RawPlanFile },
  wind: { 12: wind12 as RawPlanFile, 18: wind18 as RawPlanFile },
  gale: { 12: gale12 as RawPlanFile, 18: gale18 as RawPlanFile },
  tornado: { 12: tornado12 as RawPlanFile, 18: tornado18 as RawPlanFile },
  hurricane: { 12: hurricane12 as RawPlanFile, 18: hurricane18 as RawPlanFile },
};

const DURATIONS: DurationWeeks[] = [12, 18];

function buildPlan(track: TrackKey, durationWeeks: DurationWeeks): TrainingPlan {
  const raw = RAW_FILES[track][durationWeeks];
  const weeklyTotals: number[] = [];
  for (let i = 0; i < raw.workouts.length; i += 7) {
    weeklyTotals.push(raw.workouts.slice(i, i + 7).reduce((sum, w) => sum + w.totalDistance, 0));
  }
  const referenceTotalMiles = weeklyTotals.reduce((a, b) => a + b, 0);

  return {
    slug: `${track}-${durationWeeks}`,
    track,
    trackLabel: TRACK_LABELS[track],
    durationWeeks,
    raceType: raw.raceType,
    raceDistanceMiles: raw.raceDistance,
    workouts: raw.workouts,
    referencePeakWeeklyMiles: Math.max(...weeklyTotals),
    referenceAvgWeeklyMiles: referenceTotalMiles / weeklyTotals.length,
    referenceTotalMiles,
  };
}

export const TRAINING_PLANS: TrainingPlan[] = TRACK_ORDER.flatMap((track) =>
  DURATIONS.map((durationWeeks) => buildPlan(track, durationWeeks)),
);

export const trainingPlanMap = new Map(TRAINING_PLANS.map((plan) => [plan.slug, plan]));

export function plansForTrack(track: TrackKey): TrainingPlan[] {
  return TRAINING_PLANS.filter((plan) => plan.track === track);
}
