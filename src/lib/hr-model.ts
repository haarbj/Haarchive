// Shared heart-rate math used by every calculator that estimates a max HR
// or converts a percent-of-max / percent-of-reserve (Karvonen) target into
// a BPM number. Previously duplicated independently in pace-calculator.tsx
// and hr-threshold-calculator.tsx -- and not identically: pace-calculator's
// version silently added +3 bpm to every target for users who selected
// "female," with no citation anywhere in its code or its own "Heart rate
// calculations" methodology text, while the same Karvonen formula in
// hr-threshold-calculator.tsx (and every published description of the
// method) has no such term. No source for that adjustment could be found,
// and it was never explained to users, so it's been dropped rather than
// propagated to the other calculator -- the two now agree by construction,
// not by coincidence.

import type { HrBasis } from "@/lib/hr-threshold-reference";

/** 220-minus-age population estimate, unless a known (measured/race-tested) max HR is supplied, which always wins. Returns null if neither input is available. */
export function estimateMaxHr(age: number | null, knownMaxHr: number | null): number | null {
  if (knownMaxHr !== null && knownMaxHr > 0) return knownMaxHr;
  if (age !== null && age > 0) return 220 - age;
  return null;
}

/**
 * Converts a percent (0-100) of max HR or heart-rate reserve into a BPM
 * target. Returns null for the "hrreserve" basis when resting HR isn't
 * known -- HRR can't be computed without it, there's no reasonable default.
 */
export function bpmFromPercent(percent: number, basis: HrBasis, maxHr: number, restingHr: number | null): number | null {
  if (basis === "hrmax") return maxHr * (percent / 100);
  if (restingHr === null) return null;
  return restingHr + (percent / 100) * (maxHr - restingHr);
}
