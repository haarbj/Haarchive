// Normalizes the three independent pace-prediction models' outputs (the
// Pace & Heart Rate Calculator's Riegel formula, the Tinman Running
// Calculator's reverse-engineered fatigue curve, and the Threshold/CV/VO2max
// statistical model) onto one shared row/zone layout, for the interactive
// comparison table on choosing-a-pace-calculator. Every number here comes
// from calling that model's own existing, tested math module with the same
// (distance, time) input the standalone calculator would use -- this file
// does no prediction of its own, only alignment and an agreement/divergence
// read, so the comparison can never drift from what a visitor would see by
// opening the three calculators separately.
//
// Zone alignment across the three models (see choosing-a-pace-calculator's
// own explanation of why they don't share one zone system):
//   Easy             -- Riegel's "Easy" range, Tinman's "Easy" zone. The
//                        statistical model has no easy-pace output at all.
//   Marathon         -- Riegel-only: neither Tinman's 13-zone system nor the
//                        statistical model names a marathon-specific zone.
//   Tempo / Threshold -- Riegel's single "Tempo/Threshold" value, Tinman's
//                        "MLSS/Threshold" zone (not its separate "Tempo"
//                        zone -- "Threshold" is the term all three tools
//                        actually share; Tinman's own, slightly easier
//                        "Tempo" zone has no counterpart here and isn't
//                        represented), and the statistical model's
//                        "Threshold" output.
//   CV               -- Tinman's "CV" zone and the statistical model's "CV"
//                        output. Riegel has no critical-velocity concept.
//   VO2max           -- Riegel's "VO2-oriented reps" value, Tinman's "VO2
//                        max" zone, the statistical model's "VO2 Max"
//                        output.

import {
  calculateTinmanFitness,
  calculateTrainingPaces,
  calculateVVO2,
  TRAINING_PACE_COLUMNS,
  type TrainingPaceRow,
  type TrainingZone,
} from "@/lib/tinman-calculator-math";
import { calculatePaceCalculatorTrainingPaces, type Course } from "@/lib/pace-calculator-math";
import { predictSpeeds, speedInModelRange, uncertaintyRangeMS, type CvPiecesModel } from "@/lib/cv-threshold-math";
import { MILE_METERS } from "@/lib/race-distances";

export const MODEL_IDS = ["riegel", "tinman", "statistical"] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export const MODEL_LABELS: Record<ModelId, string> = {
  riegel: "Pace & Heart Rate Calculator",
  tinman: "Tinman Running Calculator",
  statistical: "Threshold, CV & VO2 Max Calculator",
};

export const MODEL_HREFS: Record<ModelId, string> = {
  riegel: "/pace-calculator",
  tinman: "/tinman-calculator",
  statistical: "/cv-threshold-calculator",
};

export const COMPARISON_ZONES = ["Easy", "Marathon", "Tempo / Threshold", "CV", "VO2max"] as const;
export type ComparisonZone = (typeof COMPARISON_ZONES)[number];

/** A single model's pace cell for one zone -- null renders as "—", matching the Tinman table's own convention for a zone/distance combination that model doesn't produce. fast/slow are equal for a model (Riegel's Tempo/VO2 values) that returns one number instead of a range. */
export type ComparisonCell = { fastSecPerMile: number; slowSecPerMile: number } | null;

export type Agreement = "agree" | "diverge" | "insufficient";

export type ComparisonRow = {
  zone: ComparisonZone;
  cells: Record<ModelId, ComparisonCell>;
  /** "insufficient" when fewer than two models produce this zone -- there's nothing to agree or disagree about. */
  agreement: Agreement;
  /** Spread between the widest-apart model midpoints, in sec/mile -- null when agreement is "insufficient." */
  spreadSecPerMile: number | null;
};

// Within this many sec/mile, treated as agreement -- per this tool's own
// product spec, not a statistically derived tolerance.
export const AGREEMENT_THRESHOLD_SEC_PER_MILE = 5;

function cellFromRange(fastSeconds: number, slowSeconds: number): ComparisonCell {
  return { fastSecPerMile: fastSeconds, slowSecPerMile: slowSeconds };
}

function cellFromSingle(seconds: number): ComparisonCell {
  return { fastSecPerMile: seconds, slowSecPerMile: seconds };
}

function midpoint(cell: ComparisonCell): number | null {
  return cell ? (cell.fastSecPerMile + cell.slowSecPerMile) / 2 : null;
}

// The Pace & Heart Rate Calculator's own default course/difficulty
// ("Average hills and footing," the standalone tool's own default
// xcDifficultyIndex) -- this comparison has no course selector of its own
// (a single distance+time input, like the other two models), so it assumes
// the same track/road default course the standalone tool itself defaults a
// non-XC entry to, rather than inventing a fourth input just for this table.
const RIEGEL_COURSE: Course = "track";
const RIEGEL_DEFAULT_XC_ADJUSTMENT = 0.95;

function riegelCells(distanceMeters: number, raceSeconds: number): Record<ComparisonZone, ComparisonCell> {
  const paces = calculatePaceCalculatorTrainingPaces(distanceMeters, raceSeconds, RIEGEL_COURSE, RIEGEL_DEFAULT_XC_ADJUSTMENT);
  return {
    Easy: cellFromRange(paces.easyPaceRange[0], paces.easyPaceRange[1]),
    Marathon: cellFromRange(paces.marathonPaceRange[0], paces.marathonPaceRange[1]),
    "Tempo / Threshold": cellFromSingle(paces.tempoThresholdPaceSecPerMile),
    CV: null,
    VO2max: cellFromSingle(paces.vo2OrientedPaceSecPerMile),
  };
}

const TINMAN_ZONE_FOR: Partial<Record<ComparisonZone, TrainingZone>> = {
  Easy: "Easy",
  "Tempo / Threshold": "MLSS/Threshold",
  CV: "CV",
  VO2max: "VO2 max",
};

// Training-pace columns are reported per rep distance (Mile, 1600m, ...);
// the Mile column is the one genuinely continuous running pace among them
// (see TRAINING_PACE_COLUMNS[0]), so it's the one comparable to the other
// two models' sec/mile output.
const MILE_COLUMN_INDEX = TRAINING_PACE_COLUMNS.findIndex((c) => c.label === "Mile");

function tinmanCells(distanceMeters: number, raceSeconds: number): Record<ComparisonZone, ComparisonCell> {
  const time3kSeconds = calculateTinmanFitness(distanceMeters, raceSeconds);
  const vvo2 = calculateVVO2(time3kSeconds);
  const rows: TrainingPaceRow[] = calculateTrainingPaces(vvo2);
  const rowByZone = new Map(rows.map((r) => [r.zone, r]));

  const cells = {} as Record<ComparisonZone, ComparisonCell>;
  for (const zone of COMPARISON_ZONES) {
    const tinmanZone = TINMAN_ZONE_FOR[zone];
    const row = tinmanZone ? rowByZone.get(tinmanZone) : undefined;
    const cell = row ? row.cells[MILE_COLUMN_INDEX] : null;
    // Tinman's own low/high convention is {low: slower, high: faster} (see
    // tinman-calculator.tsx's own display order) -- flipped here into this
    // module's fast-first convention, matching how every pace range on
    // this site is displayed (fast end first).
    cells[zone] = cell ? cellFromRange(cell.high, cell.low) : null;
  }
  return cells;
}

const STATISTICAL_ZONE_TO_OUTCOME: Partial<Record<ComparisonZone, "threshold" | "cv" | "vo2max">> = {
  "Tempo / Threshold": "threshold",
  CV: "cv",
  VO2max: "vo2max",
};

// Matches cv-threshold-calculator.tsx's own default range width.
const STATISTICAL_RANGE_LEVEL = 90 as const;

function statisticalCells(
  model: CvPiecesModel,
  distanceMeters: number,
  raceSeconds: number,
): Record<ComparisonZone, ComparisonCell> {
  const prediction = predictSpeeds(model, distanceMeters, raceSeconds);
  const ranges = uncertaintyRangeMS(prediction, STATISTICAL_RANGE_LEVEL);
  // The standalone calculator's single-number "safe"/"median" mode
  // (selectTrainingPaces) is deliberately unused here -- see this module's
  // header: a range is shown honestly, never collapsed to a point, for a
  // model whose whole point is that two equal-time runners can have
  // different threshold/CV/VO2max paces.

  const cells = {} as Record<ComparisonZone, ComparisonCell>;
  for (const zone of COMPARISON_ZONES) {
    const outcome = STATISTICAL_ZONE_TO_OUTCOME[zone];
    if (!outcome) {
      cells[zone] = null;
      continue;
    }
    const range = ranges[outcome];
    // fastMS (higher speed) is the faster pace -- fewer seconds per mile.
    cells[zone] = cellFromRange(MILE_METERS / range.fastMS, MILE_METERS / range.slowMS);
  }
  return cells;
}

function computeAgreement(cellsByModel: Record<ModelId, ComparisonCell>): { agreement: Agreement; spreadSecPerMile: number | null } {
  const midpoints = MODEL_IDS.map((id) => midpoint(cellsByModel[id])).filter((v): v is number => v !== null);
  if (midpoints.length < 2) return { agreement: "insufficient", spreadSecPerMile: null };
  const spread = Math.max(...midpoints) - Math.min(...midpoints);
  return { agreement: spread <= AGREEMENT_THRESHOLD_SEC_PER_MILE ? "agree" : "diverge", spreadSecPerMile: spread };
}

/**
 * Builds the full comparison table for one race performance. `cvModel` is
 * null until the statistical model's data file has loaded client-side (see
 * the comparison component) or when the race's implied speed falls outside
 * that model's supported range (speedInModelRange) -- either way, the
 * statistical column simply renders "—" rather than a wrong number.
 */
export function buildPaceModelComparison(distanceMeters: number, raceSeconds: number, cvModel: CvPiecesModel | null): ComparisonRow[] {
  const raceSpeedMS = raceSeconds > 0 ? distanceMeters / raceSeconds : 0;
  const statistical =
    cvModel && speedInModelRange(raceSpeedMS) ? statisticalCells(cvModel, distanceMeters, raceSeconds) : null;

  const riegel = riegelCells(distanceMeters, raceSeconds);
  const tinman = tinmanCells(distanceMeters, raceSeconds);

  return COMPARISON_ZONES.map((zone) => {
    const cells: Record<ModelId, ComparisonCell> = {
      riegel: riegel[zone],
      tinman: tinman[zone],
      statistical: statistical ? statistical[zone] : null,
    };
    const { agreement, spreadSecPerMile } = computeAgreement(cells);
    return { zone, cells, agreement, spreadSecPerMile };
  });
}
