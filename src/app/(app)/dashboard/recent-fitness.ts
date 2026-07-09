import { predictRaceTime } from "@/lib/coaching-engine";
import { parseTimeToSeconds } from "@/lib/format";

// Mirrors the DistanceKey -> meters mapping in pace-calculator.tsx (that
// component is out of scope to modify -- see its header comment -- so this
// is a plain, opinion-free table of fixed race distances, not a second copy
// of any actual logic).
const DISTANCE_METERS_BY_KEY: Record<string, number> = {
  "1500m": 1500,
  "1600m": 1600,
  mile: 1609.34,
  "3000m": 3000,
  "3200m": 3200,
  "2mile": 3218.69,
  "5k": 5000,
  "6k": 6000,
  "8k": 8000,
  "10k": 10000,
  "10mile": 16093.4,
  half: 21097.5,
  marathon: 42195,
};

const REFERENCE_DISTANCES = [
  { key: "5k", label: "5K", meters: 5000 },
  { key: "10k", label: "10K", meters: 10000 },
  { key: "half", label: "Half", meters: 21097.5 },
  { key: "marathon", label: "Marathon", meters: 42195 },
];

export type EquivalentPerformance = { label: string; seconds: number };

// Recomputed at render time from the calculator's own saved input (distance
// + finish time), rather than reading pre-formatted training paces out of
// output_json -- those are pace *zones*, not equivalent race times, and
// predictRaceTime (Riegel) already exists for exactly this. Deliberately
// ignores course/XC adjustment: this is a lightweight snapshot, not a
// recomputation of the calculator's full methodology.
export function equivalentPerformances(inputJson: unknown, maxResults = 3): EquivalentPerformance[] {
  if (typeof inputJson !== "object" || inputJson === null) return [];
  const input = inputJson as { distanceKey?: string; timeInput?: string };

  const knownMeters = input.distanceKey ? DISTANCE_METERS_BY_KEY[input.distanceKey] : undefined;
  const knownSeconds = input.timeInput ? parseTimeToSeconds(input.timeInput) : null;
  if (!knownMeters || !knownSeconds) return [];

  return REFERENCE_DISTANCES.filter((d) => d.key !== input.distanceKey)
    .slice(0, maxResults)
    .map((d) => ({
      label: d.label,
      seconds: predictRaceTime(knownMeters, knownSeconds, d.meters),
    }));
}
