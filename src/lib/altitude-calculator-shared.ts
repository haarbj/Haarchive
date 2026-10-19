// Shared "which altitude does this preset button actually resolve to" logic
// for the unified Altitude Calculator (VO2max mode + Performance mode).
// Pulled out as pure functions specifically so the wiring between the
// shared Home/Target altitude presets and the two conversion models below
// them is independently testable, pinned against the exact default
// behavior each of the two calculators this tool unifies used to have on
// its own -- see altitude-calculator.tsx's own header comment for the full
// unification writeup.

export type HomeAltitudeMode = "sea" | "same" | "other";
export type TargetAltitudeMode = "none" | "sea" | "home" | "other";

/**
 * Resolves the "Home / living altitude" preset to a km value (null only
 * when "other" is selected with no valid custom value yet). "sea" (0 km)
 * is the default, matching both original tools' own prior default: the
 * Altitude Calculator's blank home-altitude field meant "fully
 * unacclimatized" (home = sea level = 0 for the Performance model's
 * acclimation discount), and the Altitude-Adjusted Pace Calculator's own
 * default home mode was already "sea."
 */
export function resolveHomeAltitudeKm(
  mode: HomeAltitudeMode,
  customAltitudeKm: number | null,
  currentAltitudeKm: number | null,
): number | null {
  if (mode === "sea") return 0;
  if (mode === "same") return currentAltitudeKm;
  return customAltitudeKm;
}

/**
 * Resolves the "Convert to" target-altitude preset to a km value ("none"
 * means no target at all, distinct from "sea" which is a real target of
 * 0 km). "none" is the default, matching the Altitude Calculator's own
 * original blank-target default (show only the sea-level-equivalent
 * baseline, no target result for either model) -- unlike the
 * Altitude-Adjusted Pace Calculator, which always required a target.
 * Unifying the two meant adding "none" as a fourth option alongside that
 * tool's original three (sea/home/other), not removing any of them.
 */
export function resolveTargetAltitudeKm(
  mode: TargetAltitudeMode,
  customAltitudeKm: number | null,
  homeAltitudeKm: number | null,
): number | null {
  switch (mode) {
    case "none":
      return null;
    case "sea":
      return 0;
    case "home":
      return homeAltitudeKm;
    case "other":
      return customAltitudeKm;
  }
}
