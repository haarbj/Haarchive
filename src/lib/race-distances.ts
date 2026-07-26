// A single canonical "named race distance -> meters" catalog, shared by
// every tool that needs to offer a distance picker (Pace & Heart Rate
// Calculator, the Race Pace Calculator) instead of each one hand-rolling
// its own near-duplicate list. Only the objective facts live here (the
// distance itself, and which race categories it's actually contested in)
// -- how a specific tool wants to group, filter, or visually arrange these
// is that tool's own presentation concern, not a fact about the distance.
export type RaceCategory = "track" | "xc" | "road";

export type RaceDistance = {
  key: string;
  label: string;
  meters: number;
  categories: RaceCategory[];
};

const MILE_METERS = 1609.344;
const MARATHON_METERS = 42195;

export const RACE_DISTANCES: RaceDistance[] = [
  { key: "100m", label: "100m", meters: 100, categories: ["track"] },
  { key: "200m", label: "200m", meters: 200, categories: ["track"] },
  { key: "400m", label: "400m", meters: 400, categories: ["track"] },
  { key: "600m", label: "600m", meters: 600, categories: ["track"] },
  { key: "800m", label: "800m", meters: 800, categories: ["track"] },
  { key: "1000m", label: "1000m", meters: 1000, categories: ["track"] },
  { key: "1200m", label: "1200m", meters: 1200, categories: ["track"] },
  { key: "1500m", label: "1500m", meters: 1500, categories: ["track"] },
  { key: "1600m", label: "1600m", meters: 1600, categories: ["track"] },
  { key: "mile", label: "Mile", meters: MILE_METERS, categories: ["track", "road"] },
  { key: "2000m", label: "2000m", meters: 2000, categories: ["track", "xc"] },
  { key: "2400m", label: "2400m", meters: 2400, categories: ["track"] },
  { key: "3000m", label: "3000m", meters: 3000, categories: ["track", "xc"] },
  { key: "3200m", label: "3200m", meters: 3200, categories: ["track"] },
  { key: "2mile", label: "2 Mile", meters: MILE_METERS * 2, categories: ["track"] },
  { key: "4k", label: "4K", meters: 4000, categories: ["xc"] },
  { key: "3mile", label: "3 Mile", meters: MILE_METERS * 3, categories: ["xc"] },
  { key: "5k", label: "5K", meters: 5000, categories: ["track", "xc", "road"] },
  { key: "4mile", label: "4 Mile", meters: MILE_METERS * 4, categories: ["road"] },
  { key: "6k", label: "6K", meters: 6000, categories: ["xc", "road"] },
  { key: "8k", label: "8K", meters: 8000, categories: ["xc", "road"] },
  { key: "5mile", label: "5 Mile", meters: MILE_METERS * 5, categories: ["road"] },
  { key: "6mile", label: "6 Mile", meters: MILE_METERS * 6, categories: ["road"] },
  { key: "10k", label: "10K", meters: 10000, categories: ["track", "xc", "road"] },
  { key: "12k", label: "12K", meters: 12000, categories: ["xc", "road"] },
  { key: "15k", label: "15K", meters: 15000, categories: ["road"] },
  { key: "10mile", label: "10 Mile", meters: MILE_METERS * 10, categories: ["road"] },
  { key: "20k", label: "20K", meters: 20000, categories: ["road"] },
  { key: "half", label: "Half Marathon", meters: MARATHON_METERS / 2, categories: ["road"] },
  { key: "25k", label: "25K", meters: 25000, categories: ["road"] },
  { key: "30k", label: "30K", meters: 30000, categories: ["road"] },
  { key: "20mile", label: "20 Mile", meters: MILE_METERS * 20, categories: ["road"] },
  { key: "marathon", label: "Marathon", meters: MARATHON_METERS, categories: ["road"] },
];

export const raceDistanceMap = new Map(RACE_DISTANCES.map((d) => [d.key, d]));

export function metersFor(key: string): number {
  const distance = raceDistanceMap.get(key);
  if (!distance) throw new Error(`Unknown race distance key: ${key}`);
  return distance.meters;
}
