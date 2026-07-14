// Empirical log-speed adjustment surface for marathon performance vs. air
// temperature and humidity, ported (data + interpolation approach) from
// johnjdavisiv/heat-adjusted-pace (MIT license), which fit this to
// Mantzios et al., "Modeling the Effect of Ambient Temperature and
// Humidity on Marathon Performance" (Medicine & Science in Sports &
// Exercise, 2022;54(1):151) -- a statistical model fit to 3,891 runners
// across 754 marathons. This replaces this engine's earlier WBGT-slope
// heuristic with real race-result data instead of a formula reasoned out
// from first principles.
//
// heat-humidity-adjustments-fine.json is an unmodified copy of the
// source repo's data file: a regular grid, air temperature 0-45°C
// (step 1) by relative humidity 0-100% (step 1), 4,646 points, giving a
// log-speed adjustment at each combination. 0 near the grid's
// coolest/driest conditions (its performance optimum, consistent with
// Ely et al. 2007's independently-found ~10°C optimum); increasingly
// negative as heat stress rises. Adding this value to a runner's log
// speed and exponentiating gives their heat-adjusted speed; subtracting
// it from an actual heat-run's log speed and exponentiating gives the
// calm-conditions-equivalent speed.

import rawTable from "@/lib/environmental/data/heat-humidity-adjustments-fine.json";

export const TEMP_MIN_C = 0;
export const TEMP_MAX_C = 45;
export const HUMIDITY_MIN_PCT = 0;
export const HUMIDITY_MAX_PCT = 100;

const TEMP_STEPS = TEMP_MAX_C - TEMP_MIN_C + 1; // 46 columns per row
const GRID: readonly number[] = rawTable.logspeed_adjust;

function gridValue(tempIndex: number, humidityIndex: number): number {
  return GRID[humidityIndex * TEMP_STEPS + tempIndex];
}

// Returns [loIndex, hiIndex, t], where t is the interpolation fraction
// between the grid values at loIndex and hiIndex -- t is only ever
// outside [0, 1] when `value` falls beyond [min, max], in which case the
// edge segment's slope is used to linearly extrapolate rather than
// clamping, matching the source tool's own `extrapolate: true` behavior.
function bracket(value: number, min: number, max: number): [number, number, number] {
  if (value <= min) return [min, min + 1, value - min];
  if (value >= max) return [max - 1, max, value - (max - 1)];
  const lo = Math.floor(value);
  return [lo, lo + 1, value - lo];
}

/**
 * Bilinear (linearly extrapolated beyond the grid's edges) lookup of the
 * log-speed adjustment at a given temperature/humidity. A result of
 * -0.05, for instance, means marathon-pace speed is reduced by roughly
 * 5% (in log space) versus the grid's coolest/driest reference point.
 */
export function logspeedAdjustment(tempC: number, humidityPct: number): number {
  const [ix0, ix1, tx] = bracket(tempC, TEMP_MIN_C, TEMP_MAX_C);
  const [iy0, iy1, ty] = bracket(humidityPct, HUMIDITY_MIN_PCT, HUMIDITY_MAX_PCT);

  const z11 = gridValue(ix0, iy0);
  const z21 = gridValue(ix1, iy0);
  const z12 = gridValue(ix0, iy1);
  const z22 = gridValue(ix1, iy1);

  const a = z11 * (1 - tx) + z21 * tx;
  const b = z12 * (1 - tx) + z22 * tx;
  return a * (1 - ty) + b * ty;
}
