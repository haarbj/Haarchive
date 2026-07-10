import { formatClock } from "@/lib/format";
import type { WorkoutPrescription } from "@/lib/coaching-engine/types";

// Shared between the plan UI (WorkoutCard) and the AI layer (tool results
// need a clean, correct description to narrate from, not raw JSON) -- one
// formatter, so a fix or refinement never has to happen twice.
const METERS_PER_MILE = 1609.34;
const METERS_PER_KM = 1000;

function miles(meters: number): string {
  return `${(meters / METERS_PER_MILE).toFixed(1)} mi`;
}

function paceRange([fastSecPerKm, slowSecPerKm]: [number, number]): string {
  const fastSecPerMi = fastSecPerKm * (METERS_PER_MILE / METERS_PER_KM);
  const slowSecPerMi = slowSecPerKm * (METERS_PER_MILE / METERS_PER_KM);
  return `${formatClock(fastSecPerMi)}–${formatClock(slowSecPerMi)}/mi`;
}

// A rough duration estimate (minutes), self-serve only -- coach-authored
// group sessions (Stage E) show the coach's own literal description and an
// optional pace, never a computed duration, since there's no algorithmic
// prescription behind them to compute one from. Applies each segment's own
// pace range to its own distance and sums; some inputs approximate more
// than others (e.g. vo2 recovery jogs run at the same rep pace here, since
// the schema doesn't carry a separate recovery pace) -- always a range,
// never claimed as exact. Returns null for "race" (no pace data at all).
export function estimatedDurationRangeMin(prescription: WorkoutPrescription): [number, number] | null {
  const segments: { meters: number; paceRangeSecPerKm: [number, number] }[] = [];

  switch (prescription.kind) {
    case "easy":
    case "recovery":
      segments.push({ meters: prescription.distanceM, paceRangeSecPerKm: prescription.paceRangeSecPerKm });
      break;
    case "long": {
      const easyM = prescription.marathonPaceSegment
        ? prescription.distanceM - prescription.marathonPaceSegment.distanceM
        : prescription.distanceM;
      segments.push({ meters: easyM, paceRangeSecPerKm: prescription.paceRangeSecPerKm });
      if (prescription.marathonPaceSegment) {
        segments.push({
          meters: prescription.marathonPaceSegment.distanceM,
          paceRangeSecPerKm: prescription.marathonPaceSegment.paceRangeSecPerKm,
        });
      }
      break;
    }
    case "tempo":
      segments.push({
        meters: prescription.warmupM + prescription.tempoM + prescription.cooldownM,
        paceRangeSecPerKm: prescription.paceRangeSecPerKm,
      });
      break;
    case "vo2": {
      const totalM =
        prescription.warmupM +
        prescription.reps * prescription.repM +
        Math.max(0, prescription.reps - 1) * prescription.recoveryM +
        prescription.cooldownM;
      segments.push({ meters: totalM, paceRangeSecPerKm: prescription.paceRangeSecPerKm });
      break;
    }
    case "race":
      return null;
  }

  let fastTotalSec = 0;
  let slowTotalSec = 0;
  for (const { meters, paceRangeSecPerKm } of segments) {
    const km = meters / METERS_PER_KM;
    fastTotalSec += km * paceRangeSecPerKm[0];
    slowTotalSec += km * paceRangeSecPerKm[1];
  }

  return [Math.round(fastTotalSec / 60), Math.round(slowTotalSec / 60)];
}

export function describePrescription(prescription: WorkoutPrescription): string {
  switch (prescription.kind) {
    case "easy":
    case "recovery":
      return `${miles(prescription.distanceM)} · ${paceRange(prescription.paceRangeSecPerKm)}`;
    case "long": {
      const base = !prescription.marathonPaceSegment
        ? `${miles(prescription.distanceM)} long · ${paceRange(prescription.paceRangeSecPerKm)}`
        : (() => {
            const easyM = prescription.distanceM - prescription.marathonPaceSegment.distanceM;
            return `${miles(prescription.distanceM)} long: ${miles(easyM)} easy + ${miles(prescription.marathonPaceSegment.distanceM)} @ marathon pace (${paceRange(prescription.marathonPaceSegment.paceRangeSecPerKm)})`;
          })();
      if (!prescription.suggestedShakeout) return base;
      return `${base} + optional ${miles(prescription.suggestedShakeout.distanceM)} shakeout later`;
    }
    case "tempo":
      return `${miles(prescription.warmupM)} warmup + ${miles(prescription.tempoM)} tempo @ ${paceRange(prescription.paceRangeSecPerKm)} + ${miles(prescription.cooldownM)} cooldown`;
    case "vo2":
      return `${miles(prescription.warmupM)} warmup + ${prescription.reps}×${prescription.repM}m @ ${paceRange(prescription.paceRangeSecPerKm)} w/ ${prescription.recoveryM}m jog + ${miles(prescription.cooldownM)} cooldown`;
    case "race":
      return `${miles(prescription.distanceM)} — this is race day`;
  }
}
