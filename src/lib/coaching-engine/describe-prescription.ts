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
