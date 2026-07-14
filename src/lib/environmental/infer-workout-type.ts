// Best-effort automatic workout-type classification, so an imported
// activity doesn't force the user to answer "what kind of run was this?"
// before seeing anything -- the tool guesses first, and the user only
// has to correct it when the guess is wrong (see the "We detected this
// as..." + Change pattern in environmental-calculator.tsx).
//
// Deliberately NOT a rigorous classifier: it reads the signals actually
// available (an activity's own title, its distance, its elevation
// profile) rather than inventing new ones. Per-segment pace variability
// would be a genuinely useful signal (steady vs. bursty effort) but isn't
// modeled here -- RouteSummary only carries total distance/time and
// heading segments, not a time-per-segment breakdown, so there's no
// variability figure to compute yet.

import type { WorkoutType } from "@/lib/environmental/workout-types";

export type WorkoutTypeGuess = {
  type: WorkoutType;
  confidence: "high" | "medium" | "low";
  reason: string;
};

// Ordered by specificity -- checked top to bottom, first match wins, so a
// title like "Marathon Race Simulation" resolves to "race" (checked
// first) rather than "marathon-pace". Each entry's keywords are checked
// as substrings of the lowercased title.
const TITLE_KEYWORDS: { keywords: string[]; type: WorkoutType }[] = [
  { keywords: ["race"], type: "race" },
  { keywords: ["marathon"], type: "marathon-pace" },
  { keywords: ["recovery", "shakeout"], type: "recovery" },
  { keywords: ["long run", "long-run"], type: "long-run" },
  { keywords: ["easy", "conversational", "base run"], type: "easy" },
  { keywords: ["threshold"], type: "threshold" },
  { keywords: ["tempo"], type: "tempo" },
  { keywords: ["fartlek"], type: "fartlek" },
  { keywords: ["progression"], type: "progression" },
  { keywords: ["hill"], type: "hill-repeats" },
  { keywords: ["vo2", "vo₂"], type: "vo2max" },
  { keywords: ["interval", "repeats", "reps"], type: "intervals" },
  { keywords: ["steady state", "steady-state"], type: "steady-state" },
];

const MARATHON_METERS = 42195;
const MARATHON_PACE_DISTANCE_THRESHOLD_METERS = MARATHON_METERS * 0.9;
const LONG_RUN_THRESHOLD_METERS = 24140; // ~15 miles
const HILLY_GAIN_PER_KM_THRESHOLD_M = 20;

export function inferWorkoutType(params: {
  /** The activity's own title, when the source provides one (Strava activities always have one; GPX/TCX/FIT files generally don't). */
  title?: string | null;
  distanceMeters: number;
  elevationGainM?: number | null;
}): WorkoutTypeGuess {
  const { title, distanceMeters, elevationGainM } = params;

  if (title) {
    const normalized = title.toLowerCase();
    for (const entry of TITLE_KEYWORDS) {
      const matchedKeyword = entry.keywords.find((keyword) => normalized.includes(keyword));
      if (matchedKeyword) {
        return {
          type: entry.type,
          confidence: "high",
          reason: `The activity title mentions "${matchedKeyword}".`,
        };
      }
    }
  }

  if (distanceMeters >= MARATHON_PACE_DISTANCE_THRESHOLD_METERS) {
    return {
      type: "marathon-pace",
      confidence: "medium",
      reason: "The distance is close to marathon length.",
    };
  }

  if (distanceMeters >= LONG_RUN_THRESHOLD_METERS) {
    return {
      type: "long-run",
      confidence: "medium",
      reason: "The distance is long relative to a typical daily run.",
    };
  }

  if (elevationGainM != null && distanceMeters > 0 && elevationGainM / (distanceMeters / 1000) > HILLY_GAIN_PER_KM_THRESHOLD_M) {
    return {
      type: "hill-repeats",
      confidence: "medium",
      reason: "Elevation gain is high relative to the distance covered.",
    };
  }

  return {
    type: "easy",
    confidence: "low",
    reason: "No strong signal in the title, distance, or elevation -- defaulting to the most common training run.",
  };
}
