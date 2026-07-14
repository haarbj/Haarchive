// Humidity's marginal effect on race pace, on top of HeatEngine's dry-air
// temperature effect -- see heat-model.ts for why they're split this way.
// This engine compares the empirical temperature/humidity adjustment
// surface at the actual humidity against the same surface at a fixed
// dry-air reference humidity, holding temperature constant, and
// attributes the difference to humidity specifically.

import { REFERENCE_RH_PCT, secondsFromLogspeedAdjustment } from "@/lib/environmental/heat-model";
import { logspeedAdjustment } from "@/lib/environmental/heat-humidity-model";
import type { AdjustmentEngine, EngineResult, PerformanceContext } from "@/lib/environmental/types";

export type HumidityEngineInput = {
  tempC: number;
  relativeHumidityPct: number;
};

const CONFIDENCE_BAND_FRACTION = 0.3; // same rationale as HeatEngine -- individual sweat response varies widely

export const humidityEngine: AdjustmentEngine<HumidityEngineInput> = {
  factor: "Humidity",

  isApplicable(input: HumidityEngineInput) {
    return Number.isFinite(input.tempC) && Number.isFinite(input.relativeHumidityPct);
  },

  compute(input: HumidityEngineInput, context: PerformanceContext): EngineResult {
    const actualAdjustment = logspeedAdjustment(input.tempC, input.relativeHumidityPct);
    const dryAdjustment = logspeedAdjustment(input.tempC, REFERENCE_RH_PCT);
    const marginalAdjustment = actualAdjustment - dryAdjustment;

    const adjustmentSeconds = secondsFromLogspeedAdjustment(marginalAdjustment, context);

    const summary =
      input.relativeHumidityPct <= REFERENCE_RH_PCT
        ? `At ${input.relativeHumidityPct.toFixed(0)}% relative humidity, the air was dry enough that humidity added little or no extra cost beyond temperature alone.`
        : `At ${input.relativeHumidityPct.toFixed(0)}% relative humidity, sweat evaporates less efficiently, adding extra cooling strain on top of the temperature itself.`;

    return {
      factor: "Humidity",
      adjustmentSeconds,
      confidenceLowSeconds: adjustmentSeconds - Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      confidenceHighSeconds: adjustmentSeconds + Math.abs(adjustmentSeconds) * CONFIDENCE_BAND_FRACTION,
      summary,
    };
  },
};
