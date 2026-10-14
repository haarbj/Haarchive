import type { createClient } from "@/lib/db/server";
import { derivePaceZones, predictRaceTime, type PaceZoneKey } from "@/lib/coaching-engine";
import { metersFor } from "@/lib/race-distances";
import { MILE_METERS } from "@/lib/race-distances";
import { formatClock } from "@/lib/running-format";
import { formatDate } from "@/lib/format";

// A coach picks a NAMED pace instead of typing a raw number -- resolved
// live, at read time, from the athlete's own most recent race result,
// every time it's displayed. Never baked into a stored number: the
// reference itself is the persisted value (see the pace_reference
// migration's own comment). This is deliberately unrelated to
// athlete_metrics/@athlete.<key> variable substitution
// (resolveAthleteVariables in schedule/actions.ts), which resolves once
// and bakes the result into stored text at save time -- a fundamentally
// different (and much older) mechanism in this codebase; don't conflate
// the two.
//
// Both the zone-based four (easy/steady/tempo/interval) and the
// race-equivalent four (5k/10k/half/marathon) anchor on the athlete's most
// recent RACE RESULT, not their goal race -- a deliberate choice (recent
// fitness evidence, not future ambition), even though derivePaceZones is
// only ever called with a goal race elsewhere in this codebase
// (plan-generator.ts, the AI adapt-workout route). Confirmed explicitly;
// this is why an athlete's coach-resolved "Easy Pace" can differ from
// paces shown elsewhere in the self-serve product.
export type PaceReferenceKey = PaceZoneKey | "5k" | "10k" | "half" | "marathon";

export const PACE_REFERENCE_KEYS: PaceReferenceKey[] = ["easy", "steady", "tempo", "interval", "5k", "10k", "half", "marathon"];

export const PACE_REFERENCE_LABELS: Record<PaceReferenceKey, string> = {
  easy: "Easy Pace",
  steady: "Steady Pace",
  tempo: "Tempo Pace",
  interval: "Interval Pace",
  "5k": "5K Pace",
  "10k": "10K Pace",
  half: "Half Marathon Pace",
  marathon: "Marathon Pace",
};

const ZONE_KEYS: readonly PaceZoneKey[] = ["easy", "steady", "tempo", "interval"];
function isZoneReference(reference: PaceReferenceKey): reference is PaceZoneKey {
  return (ZONE_KEYS as readonly string[]).includes(reference);
}

export type AthleteMostRecentRace = {
  id: string;
  raceName: string;
  raceDate: string; // ISO date
  distanceM: number;
  finishTimeS: number;
};

type RaceResultRow = { id: string; race_name: string; race_date: string; distance_m: number; finish_time_s: number };

// The athlete's single most recent race result -- coach-readable via
// race_results' own coaches_this_athlete RLS policy (coach cannot write
// this table, only read it). Ties on the same race_date break on
// created_at (arbitrary but deterministic) -- there's no existing
// precedent for this tiebreak in the codebase since getAthleteGoalRace's
// own "closest to today" rule doesn't apply here.
export async function getAthleteMostRecentRace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
): Promise<AthleteMostRecentRace | null> {
  const { data } = await supabase
    .from("race_results")
    .select("id, race_name, race_date, distance_m, finish_time_s")
    .eq("user_id", athleteId)
    .order("race_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RaceResultRow>();

  if (!data) return null;
  return { id: data.id, raceName: data.race_name, raceDate: data.race_date, distanceM: data.distance_m, finishTimeS: data.finish_time_s };
}

export type ResolvedPaceReference = {
  minSPerMi: number;
  /** Null for a race-equivalent reference -- an exact prediction, not a range. */
  maxSPerMi: number | null;
  /** e.g. "Peachtree 10K · Jul 4, 2026" -- the "shown transparently" requirement. */
  sourceLabel: string;
};

const SEC_PER_KM_TO_SEC_PER_MI = MILE_METERS / 1000;

// Null race -> null always (the caller renders "no race on file yet" --
// never a fabricated pace). Zone-based references convert derivePaceZones'
// own sec/km output straight to sec/mile. Race-equivalent references
// project the known race onto the target distance via predictRaceTime and
// report a single point value -- no banding, an exact prediction.
export function resolvePaceReference(reference: PaceReferenceKey, race: AthleteMostRecentRace | null): ResolvedPaceReference | null {
  if (!race) return null;
  const sourceLabel = `${race.raceName} · ${formatDate(race.raceDate)}`;

  if (isZoneReference(reference)) {
    const zones = derivePaceZones(race.distanceM, race.finishTimeS);
    const [fastSecPerKm, slowSecPerKm] = zones[reference];
    return {
      minSPerMi: Math.round(fastSecPerKm * SEC_PER_KM_TO_SEC_PER_MI),
      maxSPerMi: Math.round(slowSecPerKm * SEC_PER_KM_TO_SEC_PER_MI),
      sourceLabel,
    };
  }

  const targetMeters = metersFor(reference);
  const predictedS = predictRaceTime(race.distanceM, race.finishTimeS, targetMeters);
  const paceSPerMi = Math.round(predictedS / (targetMeters / MILE_METERS));
  return { minSPerMi: paceSPerMi, maxSPerMi: null, sourceLabel };
}

// The one place this wording lives -- used by both describeWorkoutDetail
// (workout-status.ts) and summarizeStep (steps.ts) so they can't
// independently drift into different phrasing for the same reference.
export function formatResolvedPaceText(resolved: ResolvedPaceReference | null, label: string): string {
  if (!resolved) return `${label} — no race on file yet`;
  const range =
    resolved.maxSPerMi != null && resolved.maxSPerMi !== resolved.minSPerMi
      ? `${formatClock(resolved.minSPerMi)}–${formatClock(resolved.maxSPerMi)}/mi`
      : `${formatClock(resolved.minSPerMi)}/mi`;
  return `${range} (${label})`;
}
