import { predictRaceTime } from "@/lib/coaching-engine";

export type RaceResultInput = {
  id: string;
  raceName: string;
  raceDate: string;
  distanceM: number;
  finishTimeS: number;
};

export type TrendPoint = RaceResultInput & {
  equivalentSeconds: number;
};

// Postgres `date` columns come back as a bare "YYYY-MM-DD" string. Parsing
// that with `new Date(iso)` reads it as UTC midnight, which then renders as
// the *previous* day in any timezone behind UTC -- constructing the Date
// from its parts instead keeps it anchored to the calendar day the athlete
// actually raced on, regardless of the viewer's timezone.
export function parseIsoDateLocal(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Different race distances aren't directly comparable, so every result is
// projected onto one common distance (Riegel) to build a single trend
// line -- the same normalization the dashboard already does once for the
// single most recent race (recent-fitness.ts), just applied to the whole
// history and sorted chronologically for charting.
export function buildPerformanceTrend(races: RaceResultInput[], targetMeters = 5000): TrendPoint[] {
  return races
    .map((race) => ({
      ...race,
      equivalentSeconds: predictRaceTime(race.distanceM, race.finishTimeS, targetMeters),
    }))
    .sort((a, b) => parseIsoDateLocal(a.raceDate).getTime() - parseIsoDateLocal(b.raceDate).getTime());
}
