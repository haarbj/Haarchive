// Turns the engine results the calculator already produced into plain-
// language interpretation -- "what mattered, and by how much" -- rather
// than a fresh calculation. Every number used here (adjustmentSeconds per
// factor) already exists on EngineResult; this module only ranks and
// describes it. Feeds both the short coaching summary shown above the
// results and the longer Coach's Notes shown at the end.

import type { EngineResult } from "@/lib/environmental/types";

function magnitude(result: EngineResult): number {
  return Math.abs(result.adjustmentSeconds);
}

/** Every factor with a non-trivial effect, largest first -- what the checklist/breakdown UI displays in priority order. */
export function rankByImpact(results: EngineResult[]): EngineResult[] {
  return [...results].sort((a, b) => magnitude(b) - magnitude(a));
}

function totalMagnitude(results: EngineResult[]): number {
  return results.reduce((sum, result) => sum + magnitude(result), 0);
}

function lowerFactor(factor: string): string {
  return factor.toLowerCase();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Below this total (seconds, across the whole effort), conditions are
// treated as "close to ideal" rather than picking out a technically-
// largest-but-still-tiny factor as if it mattered.
const NEGLIGIBLE_TOTAL_SECONDS = 5;
// A factor "dominates" once it accounts for this share of the summed
// magnitude of every factor -- the rest are then described as minor.
const DOMINANT_SHARE = 0.6;
// A factor is worth mentioning by name at all once it clears this floor.
const NOTABLE_FACTOR_SECONDS = 1;

/**
 * A short (1-2 sentence), top-of-results interpretation: what mattered
 * most today, in plain language, before any numbers. See the calculator's
 * "lead with interpretation" design goal.
 */
export function buildCoachingSummary(results: EngineResult[]): string {
  if (results.length === 0) return "Not enough information yet to interpret this result.";

  const totalMag = totalMagnitude(results);
  if (totalMag < NEGLIGIBLE_TOTAL_SECONDS) {
    return "Conditions were close to ideal today -- heat, humidity, wind, and terrain each had only a small effect.";
  }

  const ranked = rankByImpact(results);
  const top = ranked[0];
  const topShare = totalMag > 0 ? magnitude(top) / totalMag : 0;
  const topName = lowerFactor(top.factor);
  const notableOthers = ranked.slice(1).filter((result) => magnitude(result) >= NOTABLE_FACTOR_SECONDS);

  if (topShare >= DOMINANT_SHARE) {
    const framing = top.adjustmentSeconds > 0 ? `Most of today's slowdown came from ${topName}` : `Today's performance got its biggest boost from ${topName}`;
    const othersText =
      notableOthers.length > 0
        ? ` ${capitalize(notableOthers.map((result) => lowerFactor(result.factor)).join(" and "))} had only a minor effect.`
        : " Every other factor had only a minor effect.";
    return `${framing} rather than the rest of the conditions.${othersText}`;
  }

  const second = ranked[1];
  if (second && magnitude(second) >= NOTABLE_FACTOR_SECONDS) {
    return `${capitalize(topName)} and ${lowerFactor(second.factor)} both had a meaningful effect on today's performance -- neither one alone tells the whole story.`;
  }
  const verb = top.adjustmentSeconds > 0 ? "slowdown" : "boost";
  return `${capitalize(topName)} was the main factor behind today's ${verb}.`;
}

/**
 * A longer, closing interpretation -- what today's breakdown implies
 * about the performance itself (representative of current fitness vs.
 * masked/flattered by conditions), not just which factor was biggest.
 * Still derived only from the same EngineResult numbers, not a new model.
 */
export function buildCoachNotes(results: EngineResult[]): string {
  if (results.length === 0) return "";

  const totalMag = totalMagnitude(results);
  if (totalMag < NEGLIGIBLE_TOTAL_SECONDS) {
    return "Today's conditions were close to ideal, so this performance is a fair, largely unadjusted read on your current fitness.";
  }

  const ranked = rankByImpact(results);
  const top = ranked[0];
  const topShare = totalMag > 0 ? magnitude(top) / totalMag : 0;
  const topName = lowerFactor(top.factor);
  const isWeatherFactor = top.factor === "Heat" || top.factor === "Humidity" || top.factor === "Wind";

  const magnitudeClause =
    topShare >= DOMINANT_SHARE
      ? `${capitalize(topName)} accounted for nearly all of today's adjustment, with the other factors playing a relatively small role.`
      : `${capitalize(topName)} was the largest single factor today, though it didn't act alone.`;

  const implicationClause =
    top.adjustmentSeconds > 0
      ? isWeatherFactor
        ? " This effort likely corresponds to a meaningfully faster performance under cooler, calmer conditions -- treat today's raw time as an understatement of current fitness."
        : " This suggests today's raw time understates current fitness more than the weather does -- the terrain, not conditions, was the bigger obstacle."
      : isWeatherFactor
        ? " Conditions worked in your favor today, so today's raw time may be a slightly flattering read on current fitness."
        : " The course itself worked in your favor today (net downhill or sheltered), so today's raw time may be a slightly flattering read on current fitness.";

  return `${magnitudeClause}${implicationClause}`;
}
