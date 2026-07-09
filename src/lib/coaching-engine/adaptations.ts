import type { PaceZones, WorkoutPrescription } from "@/lib/coaching-engine/types";

// Phase 5's three named adaptation functions (see the architecture doc's
// §09): compressWorkout, substituteForSurface, insertRecoveryDay. Pure,
// zero-I/O, same as the rest of this engine -- these compute a *proposed*
// prescription; writing it to the database happens only after the athlete
// confirms it, one layer up.

export type AdaptationResult =
  | { ok: true; prescription: WorkoutPrescription }
  | { ok: false; reason: string };

const MIN_EASY_DISTANCE_M = 1600; // 1 mile floor -- below this isn't a real run
const MIN_TEMPO_SEGMENT_M = 1600;
const MIN_VO2_REPS = 3;
const COMPRESSED_WARMUP_M = 800;
const COMPRESSED_COOLDOWN_M = 800;
const MIN_COMPRESSION_RATIO = 0.3; // never propose cutting below 30% of the original
const RECOVERY_DISTANCE_M = 3200; // ~2 miles, matches the race-week shakeout distance

function paceMidpointSecPerKm([fast, slow]: [number, number]): number {
  return (fast + slow) / 2;
}

// Rough estimate of a prescription's total time, in minutes -- good enough
// to decide "does this fit in the time available," not meant to be
// precise. Warmup/cooldown/recovery jogs are assumed noticeably easier
// than the workout's own main-effort pace.
function estimateMinutes(prescription: WorkoutPrescription): number | null {
  switch (prescription.kind) {
    case "easy":
    case "recovery":
    case "long": {
      const pace = paceMidpointSecPerKm(prescription.paceRangeSecPerKm);
      return (prescription.distanceM / 1000) * (pace / 60);
    }
    case "tempo": {
      const pace = paceMidpointSecPerKm(prescription.paceRangeSecPerKm);
      const easyPace = pace * 1.3;
      const tempoMinutes = (prescription.tempoM / 1000) * (pace / 60);
      const easyMinutes = ((prescription.warmupM + prescription.cooldownM) / 1000) * (easyPace / 60);
      return tempoMinutes + easyMinutes;
    }
    case "vo2": {
      const pace = paceMidpointSecPerKm(prescription.paceRangeSecPerKm);
      const easyPace = pace * 1.5;
      const workMinutes = ((prescription.reps * prescription.repM) / 1000) * (pace / 60);
      const recoveryMinutes = ((prescription.reps * prescription.recoveryM) / 1000) * (easyPace / 60);
      const easyMinutes = ((prescription.warmupM + prescription.cooldownM) / 1000) * (easyPace / 60);
      return workMinutes + recoveryMinutes + easyMinutes;
    }
    case "race":
      return null;
  }
}

function round100(meters: number): number {
  return Math.round(meters / 100) * 100;
}

// Shortens a prescription to fit within availableMinutes, scaling every
// component by the same ratio (never below MIN_COMPRESSION_RATIO of the
// original) rather than reasoning about warmup/cooldown time separately --
// simpler, and just as defensible for a rough real-time adaptation.
export function compressWorkout(prescription: WorkoutPrescription, availableMinutes: number): AdaptationResult {
  if (prescription.kind === "race") {
    return { ok: false, reason: "Race day isn't something to compress -- that one's worth talking through with your coach directly." };
  }
  if (availableMinutes <= 0) {
    return { ok: false, reason: "That's not enough time for any version of this workout." };
  }

  const originalMinutes = estimateMinutes(prescription);
  if (originalMinutes === null) {
    return { ok: false, reason: "Couldn't estimate this workout's length." };
  }
  if (availableMinutes >= originalMinutes) {
    return { ok: false, reason: "You already have enough time for this workout as scheduled." };
  }

  const ratio = Math.max(MIN_COMPRESSION_RATIO, availableMinutes / originalMinutes);

  switch (prescription.kind) {
    case "easy":
    case "recovery":
    case "long": {
      const newDistance = Math.max(MIN_EASY_DISTANCE_M, round100(prescription.distanceM * ratio));
      if (newDistance >= prescription.distanceM) {
        return { ok: false, reason: "You already have enough time for this workout as scheduled." };
      }
      // A marathon-pace finish only makes sense at the original distance --
      // compressing for time simplifies back to a plain easy-paced long run
      // rather than trying to preserve a shorter race-pace segment inside it.
      if (prescription.kind === "long" && prescription.marathonPaceSegment) {
        return {
          ok: true,
          prescription: { kind: "long", distanceM: newDistance, paceRangeSecPerKm: prescription.paceRangeSecPerKm },
        };
      }
      return { ok: true, prescription: { ...prescription, distanceM: newDistance } };
    }
    case "tempo": {
      const tempoM = Math.max(MIN_TEMPO_SEGMENT_M, round100(prescription.tempoM * ratio));
      return {
        ok: true,
        prescription: {
          ...prescription,
          warmupM: COMPRESSED_WARMUP_M,
          tempoM,
          cooldownM: COMPRESSED_COOLDOWN_M,
        },
      };
    }
    case "vo2": {
      const reps = Math.max(MIN_VO2_REPS, Math.round(prescription.reps * ratio));
      return {
        ok: true,
        prescription: {
          ...prescription,
          warmupM: COMPRESSED_WARMUP_M,
          reps,
          cooldownM: COMPRESSED_COOLDOWN_M,
        },
      };
    }
  }
}

// Converts today's workout into a short, easy recovery effort -- for a
// missed day, general fatigue, or anything that calls for backing off
// rather than pushing through as scheduled.
export function insertRecoveryDay(prescription: WorkoutPrescription, paceZones: PaceZones): AdaptationResult {
  if (prescription.kind === "race") {
    return { ok: false, reason: "Race day stays as scheduled -- if you're feeling this rough that close to race day, that's worth flagging to your coach directly, not swapping for a recovery jog." };
  }
  if (prescription.kind === "recovery" && prescription.distanceM <= RECOVERY_DISTANCE_M) {
    return { ok: false, reason: "Today's already a recovery-level day." };
  }

  return {
    ok: true,
    prescription: { kind: "recovery", distanceM: RECOVERY_DISTANCE_M, paceRangeSecPerKm: paceZones.easy },
  };
}

// Same 4-tier flag model already used by the Heat Tracker (Australian BOM
// outdoor WBGT approximation, ACSM-aligned thresholds) -- reimplemented
// here rather than imported, matching this project's existing pattern of
// duplicating small formulas across independent features rather than
// reaching into one component from another, but deliberately using the
// identical formula and cutoffs so heat guidance reads the same everywhere
// in the app.
export type HeatZone = "green" | "yellow" | "red" | "black";

export function estimateWBGT(tempC: number, relativeHumidityPct: number): number {
  const vaporPressure =
    (relativeHumidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return 0.567 * tempC + 0.393 * vaporPressure + 3.94;
}

export function heatZoneFor(wbgtC: number): HeatZone {
  if (wbgtC < 18) return "green";
  if (wbgtC < 23) return "yellow";
  if (wbgtC < 28) return "red";
  return "black";
}

const YELLOW_SLOWDOWN = 0.05; // "ease off pace targets"
const RED_EASY_SLOWDOWN = 0.1; // easy/long/recovery days in red conditions

function scalePace([fast, slow]: [number, number], factor: number): [number, number] {
  return [fast * (1 + factor), slow * (1 + factor)];
}

// Distance-only total, ignoring recovery-jog meters for vo2 (bonus volume,
// not core work) -- matches how prescriptions.ts already treats it.
function coreDistanceOf(prescription: WorkoutPrescription): number {
  switch (prescription.kind) {
    case "easy":
    case "recovery":
    case "long":
      return prescription.distanceM;
    case "tempo":
      return prescription.warmupM + prescription.tempoM + prescription.cooldownM;
    case "vo2":
      return prescription.warmupM + prescription.reps * prescription.repM + prescription.cooldownM;
    case "race":
      return prescription.distanceM;
  }
}

// Adjusts (or refuses to adjust) today's workout for forecast heat, using
// the same WBGT-based flag tiers as the Heat Tracker. Green needs no
// change; yellow eases pace targets; red converts quality work (tempo/vo2)
// to easy effort at the same rough distance rather than just a smaller
// slowdown, matching the Heat Tracker's own "run easy by effort only"
// guidance for that tier; black refuses outright -- heat stroke risk at
// that level isn't something to solve by adjusting a workout at all.
export function adjustForHeat(
  prescription: WorkoutPrescription,
  wbgtC: number,
  paceZones: PaceZones,
): AdaptationResult {
  if (prescription.kind === "race") {
    return {
      ok: false,
      reason: "Race-day pacing isn't something to adjust ahead of time for weather -- if conditions look genuinely dangerous, that's worth a direct conversation with your coach, not an automatic change.",
    };
  }

  const zone = heatZoneFor(wbgtC);

  if (zone === "green") {
    return { ok: false, reason: "Conditions look fine for today's workout as scheduled -- no heat adjustment needed." };
  }

  if (zone === "black") {
    return {
      ok: false,
      reason: "Conditions are in the black-flag range -- move this indoors or to a much cooler part of the day rather than adjusting the outdoor version. Heat stroke risk is too high to just slow down and push through.",
    };
  }

  if (zone === "red" && (prescription.kind === "tempo" || prescription.kind === "vo2")) {
    return {
      ok: true,
      prescription: {
        kind: "easy",
        distanceM: round100(coreDistanceOf(prescription)),
        paceRangeSecPerKm: paceZones.easy,
      },
    };
  }

  // A marathon-pace finish is race-effort intensity -- in red-flag heat it
  // gets dropped the same way a tempo/vo2 session does above, not just
  // slowed down, since "run easy by effort only" applies to it too.
  if (zone === "red" && prescription.kind === "long" && prescription.marathonPaceSegment) {
    return {
      ok: true,
      prescription: { kind: "long", distanceM: prescription.distanceM, paceRangeSecPerKm: paceZones.easy },
    };
  }

  const slowdown = zone === "yellow" ? YELLOW_SLOWDOWN : RED_EASY_SLOWDOWN;
  if (prescription.kind === "long" && prescription.marathonPaceSegment) {
    return {
      ok: true,
      prescription: {
        ...prescription,
        paceRangeSecPerKm: scalePace(prescription.paceRangeSecPerKm, slowdown),
        marathonPaceSegment: {
          ...prescription.marathonPaceSegment,
          paceRangeSecPerKm: scalePace(prescription.marathonPaceSegment.paceRangeSecPerKm, slowdown),
        },
      },
    };
  }
  return {
    ok: true,
    prescription: { ...prescription, paceRangeSecPerKm: scalePace(prescription.paceRangeSecPerKm, slowdown) },
  };
}

export type SurfaceGuidance = { ok: true; guidance: string } | { ok: false; reason: string };

// Doesn't change the stored prescription -- an interval session run on a
// road or trail instead of a track is still the same workout, just paced
// by time and feel instead of exact track distances. This exists so the
// model has a deterministic, correct time-per-effort conversion to ground
// its answer in, rather than inventing one.
export function substituteForSurface(prescription: WorkoutPrescription): SurfaceGuidance {
  if (prescription.kind !== "vo2") {
    return { ok: false, reason: "This workout doesn't need a track, so there's nothing to substitute." };
  }

  const pace = paceMidpointSecPerKm(prescription.paceRangeSecPerKm);
  const repMinutes = (prescription.repM / 1000) * (pace / 60);
  const repSeconds = Math.round(repMinutes * 60);
  const recoveryMinutes = Math.round((prescription.recoveryM / 1000) * (pace * 1.5 / 60) * 60) / 60;

  return {
    ok: true,
    guidance: `No track needed -- run ${prescription.reps} efforts of about ${repSeconds} seconds at your interval effort, with roughly ${recoveryMinutes.toFixed(1)} minutes of easy jogging between each, on any flat road or trail.`,
  };
}
