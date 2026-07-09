import { distanceBucket } from "@/lib/coaching-engine/distance-buckets";
import type { MesocyclePhase, PaceZones, WorkoutPrescription, WorkoutType } from "@/lib/coaching-engine/types";

const LONG_RUN_SHARE_DEFAULT = 0.3;
const LONG_RUN_SHARE_PEAK = 0.35; // peak-phase long runs lean more race-specific
const TEMPO_SHARE = 0.2;
const INTERVAL_SHARE = 0.15;
// Safety margin, not currently load-bearing at today's share constants (their
// max combined claim is 0.70) -- kept so a future tuning of the shares above
// can't silently starve easy/recovery days of volume without a signal here.
const MIN_EASY_SHARE = 0.15;

const TEMPO_WARMUP_M = 1600;
const TEMPO_COOLDOWN_M = 1600;
const TEMPO_MIN_SEGMENT_M = 1600;

const VO2_WARMUP_M = 1600;
const VO2_COOLDOWN_M = 1600;
const VO2_REP_M = 800;
const VO2_RECOVERY_M = 400;
const VO2_MIN_REPS = 3;

const RACE_WEEK_SHAKEOUT_M = 3200; // ~2 miles

// Marathon-specific long-run specificity ("22 miles with the final 10 at
// marathon pace" -- Vandy Run Club guidelines): only for long-bucket goals,
// only once the cycle has moved past base building, and only once the long
// run itself is substantial enough for a race-pace finish to make sense.
// The fraction grows from build to peak, matching "training increasingly
// resembles race day" as race day approaches.
const MIN_DISTANCE_FOR_MP_SEGMENT_M = 12875; // ~8 miles
const BUILD_MP_FRACTION = 0.2;
const PEAK_MP_FRACTION = 0.3;

function round100(meters: number): number {
  return Math.round(meters / 100) * 100;
}

function buildTempoPrescription(distanceM: number, paceZones: PaceZones): WorkoutPrescription {
  const tempoM = Math.max(TEMPO_MIN_SEGMENT_M, distanceM - TEMPO_WARMUP_M - TEMPO_COOLDOWN_M);
  return {
    kind: "tempo",
    warmupM: TEMPO_WARMUP_M,
    tempoM: round100(tempoM),
    cooldownM: TEMPO_COOLDOWN_M,
    paceRangeSecPerKm: paceZones.tempo,
  };
}

function buildVo2Prescription(distanceM: number, paceZones: PaceZones): WorkoutPrescription {
  const workM = Math.max(VO2_REP_M * VO2_MIN_REPS, distanceM - VO2_WARMUP_M - VO2_COOLDOWN_M);
  const reps = Math.max(VO2_MIN_REPS, Math.round(workM / VO2_REP_M));
  return {
    kind: "vo2",
    warmupM: VO2_WARMUP_M,
    reps,
    repM: VO2_REP_M,
    recoveryM: VO2_RECOVERY_M,
    cooldownM: VO2_COOLDOWN_M,
    paceRangeSecPerKm: paceZones.interval,
  };
}

// Distributes one week's total mileage across that week's workout-type
// slots (in the same order they're given, so callers can zip the result
// back onto dated slots by index) and builds each one's structured
// prescription. Takes no dates at all -- scheduling.ts's job -- and no
// I/O, matching the rest of this engine.
export function buildWeekPrescriptions(
  slots: WorkoutType[],
  weekTotalMeters: number,
  paceZones: PaceZones,
  phase: MesocyclePhase,
  goalDistanceM: number,
): WorkoutPrescription[] {
  // Race week: the race itself is fixed at the goal distance, not a share
  // of weekTotalMeters -- everything else that week is a short shakeout,
  // deliberately not drawn from weekTotalMeters either.
  if (slots.includes("race")) {
    return slots.map((kind): WorkoutPrescription => {
      if (kind === "race") return { kind: "race", distanceM: goalDistanceM };
      return { kind: "recovery", distanceM: RACE_WEEK_SHAKEOUT_M, paceRangeSecPerKm: paceZones.easy };
    });
  }

  const longShare = phase === "peak" ? LONG_RUN_SHARE_PEAK : LONG_RUN_SHARE_DEFAULT;
  const hasTempo = slots.includes("tempo");
  const hasVo2 = slots.includes("vo2");
  const easySlotCount = slots.filter((kind) => kind === "easy" || kind === "recovery").length;

  const claimedShare = longShare + (hasTempo ? TEMPO_SHARE : 0) + (hasVo2 ? INTERVAL_SHARE : 0);
  const scale = easySlotCount > 0 && 1 - claimedShare < MIN_EASY_SHARE ? (1 - MIN_EASY_SHARE) / claimedShare : 1;

  const scaledLongShare = longShare * scale;
  const scaledTempoShare = TEMPO_SHARE * scale;
  const scaledIntervalShare = INTERVAL_SHARE * scale;
  const remainingShare = Math.max(
    0,
    1 - scaledLongShare - (hasTempo ? scaledTempoShare : 0) - (hasVo2 ? scaledIntervalShare : 0),
  );
  const easyShareEach = easySlotCount > 0 ? remainingShare / easySlotCount : 0;

  return slots.map((kind): WorkoutPrescription => {
    switch (kind) {
      case "long": {
        const longDistanceM = round100(weekTotalMeters * scaledLongShare);
        const mpFraction = phase === "peak" ? PEAK_MP_FRACTION : phase === "build" ? BUILD_MP_FRACTION : 0;
        if (mpFraction > 0 && distanceBucket(goalDistanceM) === "long" && longDistanceM >= MIN_DISTANCE_FOR_MP_SEGMENT_M) {
          return {
            kind: "long",
            distanceM: longDistanceM,
            paceRangeSecPerKm: paceZones.easy,
            marathonPaceSegment: {
              distanceM: round100(longDistanceM * mpFraction),
              paceRangeSecPerKm: paceZones.steady,
            },
          };
        }
        return {
          kind: "long",
          distanceM: longDistanceM,
          paceRangeSecPerKm: paceZones.steady,
        };
      }
      case "tempo":
        return buildTempoPrescription(round100(weekTotalMeters * scaledTempoShare), paceZones);
      case "vo2":
        return buildVo2Prescription(round100(weekTotalMeters * scaledIntervalShare), paceZones);
      case "easy":
        return {
          kind: "easy",
          distanceM: round100(weekTotalMeters * easyShareEach),
          paceRangeSecPerKm: paceZones.easy,
        };
      case "recovery":
        return {
          kind: "recovery",
          distanceM: round100(weekTotalMeters * easyShareEach),
          paceRangeSecPerKm: paceZones.easy,
        };
      default:
        // "race" is handled above; "strength" is never emitted by
        // templates.ts in v1 -- reaching either here is a bug in this
        // module's own template tables, not a possible user input.
        throw new Error(`buildWeekPrescriptions: unexpected workout type "${kind}" in a non-race week`);
    }
  });
}
