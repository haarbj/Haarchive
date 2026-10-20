// Today's conditions guidance: the forward-looking twin of conditions-
// adjusted actuals (completed-workout-conditions.ts) -- same engines, same
// voice, opposite direction. That build asks "what was this Strava-matched
// run actually worth, once conditions are undone?"; this one asks "what
// will today's target pace actually cost, given today's conditions?"
// Pure composition only -- no Supabase, no fetch, no Strava. The
// Supabase/weather-fetch-touching orchestration lives in
// today-conditions-service.ts.
//
// SCOPE: heat + humidity only, deliberately. Unlike a completed run (which
// has a real GPS trace to resolve grade/heading from), a workout that
// hasn't happened yet has no route -- WindEngine needs a real heading and
// a real terrain-exposure score (windExposureScore, see wind-exposure.ts),
// and ElevationEngine needs real elevation gain/loss, neither of which
// exists for "wherever the athlete happens to run today." Fabricating a
// "typical" heading or terrain would be exactly the kind of invented input
// CLAUDE.md §5/§15 and this module's own sibling (completed-workout-
// conditions.ts) both avoid. Heat and humidity are the only two factors
// that depend on conditions alone, not route -- so those are the only two
// this module ever adjusts for.

import { heatEngine } from "@/lib/environmental/heat-engine";
import { humidityEngine } from "@/lib/environmental/humidity-engine";
import { combineAdjustments, predictedActualTime } from "@/lib/environmental/combine";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";
import { estimateWBGT, heatZoneFor, heatGuidance, type HeatGuidance } from "@/lib/heat-physics";
import { MILE_METERS } from "@/lib/race-distances";

/**
 * A 1-mile reference performance is the honest unit trick that lets
 * combine.ts's own Predict-mode math ("I can run this time ideally --
 * what should I expect under these conditions?") answer a PACE question
 * instead of a whole-performance-time question: a mile's own "ideal
 * time" IS its pace in seconds, so the result IS the adjusted pace,
 * nothing re-derived or approximated on top of what combine.ts already
 * computes.
 */
export function conditionsAdjustedPaceSPerMi(targetPaceSPerMi: number, conditions: WeatherConditions): number {
  const context = { distanceMeters: MILE_METERS, actualTimeSeconds: targetPaceSPerMi, paceMS: MILE_METERS / targetPaceSPerMi };
  const heatInput = { tempC: conditions.tempC };
  const humidityInput = { tempC: conditions.tempC, relativeHumidityPct: conditions.relativeHumidityPct };
  const results = [
    heatEngine.isApplicable(heatInput) ? heatEngine.compute(heatInput, context) : null,
    humidityEngine.isApplicable(humidityInput) ? humidityEngine.compute(humidityInput, context) : null,
  ].filter((r) => r !== null);
  const combined = combineAdjustments(results);
  return predictedActualTime(targetPaceSPerMi, combined).estimateSeconds;
}

/**
 * The reused materiality signal: heat-tracker.tsx's own heatGuidance only
 * ever sets `raceTip` once heat is costing real, actionable time (its
 * yellow zone above the 60°F/HEAT_IMPAIR_START_F threshold, or red/black)
 * -- not a new threshold invented for this card, the exact same gate that
 * decides whether heat-tracker.tsx shows its own race-day callout. Null
 * when conditions don't clear that bar, so a mild day shows the plain
 * conditions line with no caution at all.
 */
export function heatCautionFor(conditions: WeatherConditions): HeatGuidance | null {
  const wbgtC = estimateWBGT(conditions.tempC, conditions.relativeHumidityPct);
  const zone = heatZoneFor(wbgtC);
  const guidance = heatGuidance(wbgtC, zone.name);
  return guidance.raceTip ? guidance : null;
}

/** The hottest of today's already-fetched hourly readings -- "peak heat window," not "right now." Pure pick, no fetch. */
export function peakHeatReading(points: WeatherConditions[]): WeatherConditions | null {
  if (points.length === 0) return null;
  return points.reduce((hottest, p) => (p.tempC > hottest.tempC ? p : hottest));
}
