// An athlete's own, self-reported CURRENT fitness estimate (e.g. "I think
// I could run a 15:57 5K right now") -- see athlete_fitness_estimates'
// migration comment for the full distinction from race_results (a
// completed, dated race). Resolved live, at read time, exactly like
// pace_reference already is (getAthleteMostRecentRace/resolvePaceReference)
// -- never baked into a stored number, so an athlete updating their
// estimate mid-plan is reflected in every not-yet-completed pace-percent
// workout the next time it's read, without touching anything already
// completed.

import type { createClient } from "@/lib/db/server";
import { computeProgramPaceTarget, type ProgramAthleteReferenceInputs } from "@/lib/private-coaching/program-generation";
import { PACE_REFERENCE_LABELS, type PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import { MILE_METERS, metersFor } from "@/lib/race-distances";
import { formatClock } from "@/lib/running-format";
import { formatDate } from "@/lib/format";

export type AthleteFitnessEstimate = { referenceKey: PaceReferenceKey; estimatedTimeS: number; updatedAt: string };

type EstimateRow = { reference_key: PaceReferenceKey; estimated_time_s: number; updated_at: string };

// One row per reference_key -- "your current 5K estimate," not a history
// list (see the table's own migration comment) -- so this is a plain
// fetch-and-key, not a most-recent-wins reduction the way
// getAthleteMostRecentRace's own race_results query needs.
export async function getAthleteFitnessEstimates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
): Promise<Partial<Record<PaceReferenceKey, AthleteFitnessEstimate>>> {
  const { data } = await supabase
    .from("athlete_fitness_estimates")
    .select("reference_key, estimated_time_s, updated_at")
    .eq("athlete_id", athleteId)
    .returns<EstimateRow[]>();

  const byKey: Partial<Record<PaceReferenceKey, AthleteFitnessEstimate>> = {};
  for (const row of data ?? []) {
    byKey[row.reference_key] = { referenceKey: row.reference_key, estimatedTimeS: row.estimated_time_s, updatedAt: row.updated_at };
  }
  return byKey;
}

// A total time (e.g. a 5K estimate's 15:57) is not the same unit
// computeProgramPaceTarget expects (seconds PER MILE) -- converted once,
// here, for every key that has a real distance (the 4 race-equivalent
// keys). A zone key (easy/steady/tempo/interval) has no fixed race
// distance to convert against, so it's simply never populated -- none of
// this platform's pace-percent prescriptions reference one anyway (see
// assign-program-actions.ts's own RACE_EQUIVALENT_KEYS comment).
function toReferenceSecondsByKey(estimates: Partial<Record<PaceReferenceKey, AthleteFitnessEstimate>>): ProgramAthleteReferenceInputs {
  const out: ProgramAthleteReferenceInputs = {};
  for (const [key, estimate] of Object.entries(estimates) as [PaceReferenceKey, AthleteFitnessEstimate][]) {
    let meters: number;
    try {
      meters = metersFor(key);
    } catch {
      continue;
    }
    out[key] = estimate.estimatedTimeS / (meters / MILE_METERS);
  }
  return out;
}

export type ResolvedPacePercent = { minSPerMi: number; maxSPerMi: number; sourceLabel: string };

// The pace_percent_basis/min/max counterpart of resolvePaceReference --
// same shape, same "null means nothing to resolve yet" contract, so every
// consumer of a resolved pace (workout cards, the day view, step summaries)
// can treat a percent-of-estimate prescription and a named zone/race
// reference identically once resolved.
export function resolvePacePercent(
  basis: PaceReferenceKey,
  percentMin: number,
  percentMax: number,
  estimates: Partial<Record<PaceReferenceKey, AthleteFitnessEstimate>>,
): ResolvedPacePercent | null {
  const estimate = estimates[basis];
  if (!estimate) return null;
  const resolved = computeProgramPaceTarget(basis, percentMin, percentMax, toReferenceSecondsByKey(estimates));
  if (!resolved) return null;
  const percentText = percentMin === percentMax ? `${percentMin}%` : `${percentMin}-${percentMax}%`;
  const sourceLabel = `${percentText} ${PACE_REFERENCE_LABELS[basis]} (est. ${formatClock(estimate.estimatedTimeS)}, updated ${formatDate(estimate.updatedAt)})`;
  return { minSPerMi: Math.round(resolved.min), maxSPerMi: Math.round(resolved.max), sourceLabel };
}
