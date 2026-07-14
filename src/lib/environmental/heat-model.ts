// Shared duration-scaling + seconds-conversion logic used by both
// heat-engine.ts and humidity-engine.ts. The empirical log-speed
// adjustment surface in heat-humidity-model.ts is calibrated to marathon-
// length efforts (Mantzios et al. 2022 fit it to marathon results only),
// so this module scales that marathon-calibrated effect for shorter or
// longer distances and converts it into a seconds cost given the
// runner's own pace.
//
// Heat and humidity aren't physiologically separable -- the underlying
// grid already folds humidity's effect into a single temperature x
// humidity surface -- so heat-engine.ts and humidity-engine.ts split it by
// comparing the surface at a fixed dry-air reference humidity (isolating
// temperature's own effect) against the surface at actual humidity (the
// marginal cost humidity adds on top). Both import REFERENCE_RH_PCT from
// here so the split stays internally consistent.

import type { PerformanceContext } from "@/lib/environmental/types";

export const REFERENCE_RH_PCT = 30; // dry-air baseline used to isolate temperature's effect from humidity's

const MARATHON_REFERENCE_SECONDS = 4 * 3600; // ~4:00 marathon, the duration Mantzios et al.'s data is calibrated to
const MIN_DURATION_SCALE = 0.15; // even a 5K in the heat isn't immune, just far less exposed
const MAX_DURATION_SCALE = 1.3; // ultra-distance efforts extrapolate somewhat further, capped to avoid runaway numbers

export function durationScaleFor(actualTimeSeconds: number): number {
  return Math.min(
    MAX_DURATION_SCALE,
    Math.max(MIN_DURATION_SCALE, actualTimeSeconds / MARATHON_REFERENCE_SECONDS),
  );
}

/**
 * Converts a marathon-calibrated log-speed adjustment (negative = slower)
 * into a seconds cost over the full effort, scaling it for how this
 * effort's duration compares to a marathon's.
 *
 * The exact relationship (subtract the adjustment from the runner's log
 * pace, exponentiate, re-derive time from the resulting speed) is
 * nonlinear in the adjustment -- fine for a single combined adjustment,
 * but it would silently break HeatEngine + HumidityEngine's "these two
 * sum to exactly the full effect, no double-counting" split, since
 * f(a) + f(b) != f(a + b) for that nonlinear f. Using the linear
 * approximation instead (exact for infinitesimal adjustments, and within
 * ~1% of the exact value at any adjustment this table actually produces)
 * keeps that split exact, at a cost far smaller than the confidence band
 * already attached to the result.
 */
export function secondsFromLogspeedAdjustment(rawLogspeedAdjustment: number, context: PerformanceContext): number {
  const scaledAdjustment = rawLogspeedAdjustment * durationScaleFor(context.actualTimeSeconds);
  return -scaledAdjustment * context.actualTimeSeconds;
}
