// Shared contract every environmental adjustment engine implements, so the
// calculator can run an arbitrary set of them (today: heat, humidity,
// wind, elevation) and sum the results the same way, and so future
// engines (solar radiation, air quality, altitude acclimatization) plug in
// without the combiner or UI needing to change -- only a new engine file
// implementing this same interface, registered in combine.ts.

/** What every engine needs to know about the performance being adjusted. */
export type PerformanceContext = {
  distanceMeters: number;
  actualTimeSeconds: number;
  /** Average speed, m/s -- derived, but engines need it often enough to take it precomputed. */
  paceMS: number;
};

export type EngineResult = {
  /** Which engine produced this. */
  factor: string;
  /**
   * Seconds this factor is estimated to have cost (positive) or saved
   * (negative) relative to ideal/neutral conditions, over the full
   * distance. This is what gets summed into the combined adjustment.
   */
  adjustmentSeconds: number;
  /**
   * A defensible low/high range around adjustmentSeconds -- environmental
   * models are estimates, not precise physiological measurements, and the
   * UI is built to always show a range alongside the point estimate
   * rather than imply false precision.
   */
  confidenceLowSeconds: number;
  confidenceHighSeconds: number;
  /** One-line, beginner-friendly summary of what drove this number. */
  summary: string;
};

export interface AdjustmentEngine<TInput> {
  /** Matches EngineResult.factor -- used as a stable key (e.g. for React lists). */
  readonly factor: string;
  /** Whether this engine has enough input to run at all (e.g. wind speed of 0 or unset). */
  isApplicable(input: TInput): boolean;
  compute(input: TInput, context: PerformanceContext): EngineResult;
}

export function paceMSFromDistance(distanceMeters: number, timeSeconds: number): number {
  return distanceMeters / timeSeconds;
}
