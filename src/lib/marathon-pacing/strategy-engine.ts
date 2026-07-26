// Turns a named pacing strategy into a target EFFORT curve (fraction of
// critical speed, over race fraction 0-1) -- not a pace table. Converting
// that curve into actual paces, mile by mile, is mile-cost-model.ts and
// physiology-engine.ts's job (a later milestone wires them together); this
// module only decides *how hard to aim to run, and when*.
//
// Two things this deliberately does differently from FindMyMarathon (see
// docs/marathon-pacing-calculator-design.md Phase 1):
//
//   1. Split-strategy magnitude is driven by a RiskLevel, not a fixed
//      preset. This also means "Negative Split" and "Aggressive Negative
//      Split" collapse into ONE strategy definition parametrized by risk,
//      rather than needing separate hand-authored entries -- same for
//      Positive Split. FindMyMarathon's own live-probed output showed the
//      split as a constant step at the halfway point; buildSplitStrategy
//      below deliberately does NOT copy that -- it builds a genuinely
//      continuous three-phase curve (conservative/elevated start, flat
//      cruise, progressive finish over the last 10K) with every
//      transition already a ramp, not a step, matching common marathon
//      coaching guidance (Hansons, Pfitzinger, Daniels, McMillan) over a
//      literal instant pace change a runner can't actually execute.
//   2. "Boston Strategy" is course-adaptive, not a hand-authored Boston-
//      specific mile table: it reads the course's OWN early-segment grade
//      (net downhill start -> hold back, protecting against the eccentric-
//      damage risk a fast downhill start creates) and its OWN back-half
//      climbs (a significant late climb -> hold steady through it, then a
//      controlled release after), so it generalizes to any course with a
//      similar downhill-start / late-climb shape, not just Boston itself.
//      Unlike the split strategies, its transitions genuinely are
//      terrain-triggered steps (the grade really does change at a specific
//      point), so they're built as steps and smoothed via smoothSteps
//      below into a short ramp, rather than built continuous from the start.
//
// Every curve is normalized so its distance-weighted average across the
// full race equals the runner's goal effort exactly -- the same "total
// time is always preserved, strategy only redistributes it" invariant
// FindMyMarathon's own output showed.

import type { CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";

export type RiskLevel = "low" | "moderate" | "high";

export type EffortCurvePoint = {
  /** Position in the race, 0 (start) to 1 (finish). */
  raceFraction: number;
  /** Target effort, as a fraction of critical speed. */
  targetEffortFraction: number;
};

export type StrategyId = "even-effort" | "negative-split" | "positive-split" | "boston-strategy";

export type StrategyInput = {
  course: CourseAnalysis;
  /** The runner's overall goal effort, as a fraction of critical speed (goalSpeedMS / criticalSpeedMS). */
  goalEffortFraction: number;
  risk: RiskLevel;
};

export type PacingStrategy = {
  id: StrategyId;
  label: string;
  description: string;
  buildEffortCurve(input: StrategyInput): EffortCurvePoint[];
};

type RiskConfig = {
  /** Ceiling on effort during the first half, as a fraction of critical speed -- the line past which going out faster stops being a strategy choice and starts being a blow-up risk. */
  firstHalfEffortCeiling: number;
  /** How large a split-strategy swing (as a fraction of goal effort) this risk tolerance permits. */
  splitSwingFraction: number;
  /** How much of the race's final stretch (meters) a negative/positive split's progressive finish spans -- longer for more risk tolerance, so a bigger kick also starts earlier. */
  progressivePortionMeters: number;
  /** How much effort reduction Boston Strategy applies through a significant late climb. */
  hillCautionFraction: number;
  /** How much of a controlled release Boston Strategy grants after clearing a significant late climb, if durability allows. */
  releaseFraction: number;
};

const RISK_CONFIG: Record<RiskLevel, RiskConfig> = {
  low: { firstHalfEffortCeiling: 0.88, splitSwingFraction: 0.03, progressivePortionMeters: 8000, hillCautionFraction: 0.04, releaseFraction: 0.02 },
  moderate: { firstHalfEffortCeiling: 0.93, splitSwingFraction: 0.05, progressivePortionMeters: 10000, hillCautionFraction: 0.06, releaseFraction: 0.04 },
  high: { firstHalfEffortCeiling: 0.97, splitSwingFraction: 0.08, progressivePortionMeters: 13000, hillCautionFraction: 0.08, releaseFraction: 0.07 },
};

const EARLY_SEGMENT_RACE_FRACTION = 0.15;
const LATE_CLIMB_MIN_GAIN_M = 30; // "significant" enough to warrant caution, not every minor rise
const RELEASE_START_RACE_FRACTION = 0.85;
const NET_DOWNHILL_START_GRADE_THRESHOLD = -0.01;

// "First 3-4 miles" conservative settle-in period, common to most marathon
// coaching guidance (Hansons, Pfitzinger, Daniels, McMillan all converge on
// some version of it) regardless of risk tolerance -- this window is about
// avoiding early adrenaline-fueled overpacing and crowd congestion, not a
// risk preference, so unlike the progressive finish it doesn't scale by risk.
const CONSERVATIVE_PORTION_METERS = 5633; // ~3.5 miles

// Half-width (as a race fraction) of the ramp each hard transition gets
// smoothed into -- roughly 3 miles of total transition width on a
// marathon. Real negative/positive splits and terrain-driven effort
// changes shift gradually over a few miles; an instant step produces an
// unrealistic single-mile pace jump (e.g. a ~37s/mi swing landing entirely
// on the one mile straddling halfway) that a runner obviously can't
// execute as a literal discontinuity.
const TRANSITION_HALF_WIDTH = 0.06;

/**
 * Replaces every hard step (two consecutive points at the same
 * raceFraction) with a short linear ramp straddling it. Each ramp's
 * half-width is capped by its distance to the nearest neighboring point,
 * so ramps around closely-spaced transitions (e.g. a short late climb)
 * never cross into an adjacent plateau or ramp -- in the worst case two
 * ramps sharing a gap each claim at most half of it and meet exactly in
 * the middle, never overlapping.
 *
 * A linear ramp centered on the original step, reaching the same
 * before/after plateau values, integrates to exactly the same area as the
 * step it replaces (a symmetric trapezoid over [x-h, x+h] covers the same
 * area as two h-wide rectangles at the same two values) -- so this never
 * needs to be re-normalized after smoothing.
 */
function smoothSteps(points: EffortCurvePoint[]): EffortCurvePoint[] {
  const result: EffortCurvePoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const previous = points[i - 1];
    const next = points[i + 1];

    if (previous && previous.raceFraction === current.raceFraction) {
      continue; // the second half of a step already emitted below -- skip
    }

    if (next && next.raceFraction === current.raceFraction) {
      const afterNext = points[i + 2];
      const beforeGap = previous ? current.raceFraction - previous.raceFraction : Infinity;
      const afterGap = afterNext ? afterNext.raceFraction - next.raceFraction : Infinity;
      const halfWidth = Math.min(TRANSITION_HALF_WIDTH, beforeGap / 2, afterGap / 2);
      const start = Math.max(0, current.raceFraction - halfWidth);
      const end = Math.min(1, next.raceFraction + halfWidth);
      result.push({ raceFraction: start, targetEffortFraction: current.targetEffortFraction });
      result.push({ raceFraction: end, targetEffortFraction: next.targetEffortFraction });
      continue;
    }

    result.push(current);
  }
  return result;
}

function integrateEffortCurve(points: EffortCurvePoint[]): number {
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const width = b.raceFraction - a.raceFraction;
    area += (width * (a.targetEffortFraction + b.targetEffortFraction)) / 2;
  }
  return area; // points span raceFraction [0, 1], so the integral IS the average
}

/** Rescales every point so the curve's distance-weighted average matches the target exactly, preserving the runner's overall goal time. */
function normalizeToAverage(points: EffortCurvePoint[], targetAverage: number): EffortCurvePoint[] {
  const currentAverage = integrateEffortCurve(points);
  if (currentAverage <= 0) return points;
  const scale = targetAverage / currentAverage;
  return points.map((p) => ({ ...p, targetEffortFraction: p.targetEffortFraction * scale }));
}

function averageGradeOverMileRange(course: CourseAnalysis, fromMileIdx: number, toMileIdx: number): number {
  const slice = course.perMileGrade.slice(Math.max(0, fromMileIdx), Math.min(course.perMileGrade.length, toMileIdx));
  if (slice.length === 0) return 0;
  return slice.reduce((sum, g) => sum + g, 0) / slice.length;
}

const evenEffortStrategy: PacingStrategy = {
  id: "even-effort",
  label: "Even Effort",
  description: "Holds one constant target effort for the whole race, letting terrain and conditions determine the resulting pace mile to mile.",
  buildEffortCurve({ goalEffortFraction }) {
    return [
      { raceFraction: 0, targetEffortFraction: goalEffortFraction },
      { raceFraction: 1, targetEffortFraction: goalEffortFraction },
    ];
  },
};

/**
 * Both split strategies are three phases -- conservative/elevated start,
 * flat cruise at goal effort, progressive finish -- with every transition
 * a continuous linear ramp already built directly into the curve, not a
 * plateau-to-plateau step. Real negative/positive splits shift gradually:
 * a runner settling into pace over the first few miles, or picking it up
 * progressively across the final 10K, not snapping to a new pace and
 * holding it flat for 10+ miles (an earlier version of this strategy did
 * exactly that, and it produced an unrealistic ~37s/mi jump concentrated
 * on the single mile straddling halfway -- a real report, not a
 * hypothetical). This shape also matches common marathon coaching
 * guidance (Hansons, Pfitzinger, Daniels, McMillan): settle in
 * conservatively for the first few miles, hold goal pace through the
 * bulk of the race, then gradually pick it up over the last 10K if goal
 * pace still feels controlled.
 */
function buildSplitStrategy(id: StrategyId, label: string, description: string, direction: "negative" | "positive"): PacingStrategy {
  return {
    id,
    label,
    description,
    buildEffortCurve({ course, goalEffortFraction, risk }) {
      const config = RISK_CONFIG[risk];
      const swing = config.splitSwingFraction;

      // Bounded against the actual course length, so a shorter-than-
      // marathon course can't produce overlapping or inverted phases.
      const progressiveStartFraction = Math.max(0.5, 1 - config.progressivePortionMeters / course.totalDistanceM);
      const conservativeEndFraction = Math.min(CONSERVATIVE_PORTION_METERS / course.totalDistanceM, progressiveStartFraction / 2);

      if (direction === "negative") {
        const raw: EffortCurvePoint[] = [
          { raceFraction: 0, targetEffortFraction: goalEffortFraction * (1 - swing) },
          { raceFraction: conservativeEndFraction, targetEffortFraction: goalEffortFraction },
          { raceFraction: progressiveStartFraction, targetEffortFraction: goalEffortFraction },
          { raceFraction: 1, targetEffortFraction: goalEffortFraction * (1 + swing) },
        ];
        return normalizeToAverage(raw, goalEffortFraction);
      }

      // Positive split: elevated effort held from the gun (no separate
      // settle-in dip -- starting fast is the whole point), then a
      // progressive fade over the final stretch as fatigue catches up.
      // The elevated opening is the one part of this shape that can run
      // into the risk ceiling; if it does, don't renormalize back up to
      // the goal average afterward -- that would push the clamped value
      // past the ceiling it was just clamped to, defeating it. A clamped
      // curve's honestly lower average is the correct signal that this
      // goal isn't safely reachable with this strategy/risk combination.
      const naiveElevatedEffort = goalEffortFraction * (1 + swing);
      const elevatedEffort = Math.min(naiveElevatedEffort, config.firstHalfEffortCeiling);
      const wasClamped = elevatedEffort < naiveElevatedEffort;

      const raw: EffortCurvePoint[] = [
        { raceFraction: 0, targetEffortFraction: elevatedEffort },
        { raceFraction: progressiveStartFraction, targetEffortFraction: elevatedEffort },
        { raceFraction: 1, targetEffortFraction: goalEffortFraction * (1 - swing) },
      ];
      return wasClamped ? raw : normalizeToAverage(raw, goalEffortFraction);
    },
  };
}

const bostonStrategy: PacingStrategy = {
  id: "boston-strategy",
  label: "Boston Strategy",
  description:
    "Course-adaptive, not Boston-specific: holds back through a net-downhill start (protecting against eccentric damage from overstriding), stays controlled through any significant late climb, and allows a modest release after it -- degrades to Even Effort on a course without that shape.",
  buildEffortCurve({ course, goalEffortFraction, risk }) {
    const config = RISK_CONFIG[risk];
    const mileCount = course.perMileGrade.length;

    const earlyMileCount = Math.max(1, Math.round(mileCount * EARLY_SEGMENT_RACE_FRACTION));
    const earlyGrade = averageGradeOverMileRange(course, 0, earlyMileCount);
    const earlyIsNetDownhill = earlyGrade < NET_DOWNHILL_START_GRADE_THRESHOLD;

    const lateClimb = course.climbs.find((c) => c.startDistanceM > course.totalDistanceM * 0.5 && c.gainM >= LATE_CLIMB_MIN_GAIN_M);

    const earlyEffort = earlyIsNetDownhill ? goalEffortFraction * (1 - config.hillCautionFraction) : goalEffortFraction;

    if (!lateClimb) {
      // No significant late climb -- Boston Strategy's only real
      // adaptation left is the downhill-start caution, if any.
      const raw: EffortCurvePoint[] = [
        { raceFraction: 0, targetEffortFraction: earlyEffort },
        { raceFraction: EARLY_SEGMENT_RACE_FRACTION, targetEffortFraction: earlyEffort },
        { raceFraction: EARLY_SEGMENT_RACE_FRACTION, targetEffortFraction: goalEffortFraction },
        { raceFraction: 1, targetEffortFraction: goalEffortFraction },
      ];
      return smoothSteps(normalizeToAverage(raw, goalEffortFraction));
    }

    const climbStartFraction = lateClimb.startDistanceM / course.totalDistanceM;
    const climbEndFraction = lateClimb.endDistanceM / course.totalDistanceM;
    const climbEffort = goalEffortFraction * (1 - config.hillCautionFraction);
    const releaseEffort = goalEffortFraction * (1 + config.releaseFraction);

    const raw: EffortCurvePoint[] = [
      { raceFraction: 0, targetEffortFraction: earlyEffort },
      { raceFraction: EARLY_SEGMENT_RACE_FRACTION, targetEffortFraction: earlyEffort },
      { raceFraction: EARLY_SEGMENT_RACE_FRACTION, targetEffortFraction: goalEffortFraction },
      { raceFraction: climbStartFraction, targetEffortFraction: goalEffortFraction },
      { raceFraction: climbStartFraction, targetEffortFraction: climbEffort },
      { raceFraction: climbEndFraction, targetEffortFraction: climbEffort },
      { raceFraction: climbEndFraction, targetEffortFraction: goalEffortFraction },
      { raceFraction: RELEASE_START_RACE_FRACTION, targetEffortFraction: goalEffortFraction },
      { raceFraction: RELEASE_START_RACE_FRACTION, targetEffortFraction: releaseEffort },
      { raceFraction: 1, targetEffortFraction: releaseEffort },
    ];
    return smoothSteps(normalizeToAverage(raw, goalEffortFraction));
  },
};

export const PACING_STRATEGIES: Record<StrategyId, PacingStrategy> = {
  "even-effort": evenEffortStrategy,
  "negative-split": buildSplitStrategy(
    "negative-split",
    "Negative Split",
    "Settles in below goal effort for the first few miles, holds goal effort through the bulk of the race, then gradually picks it up over the final 10K -- a continuous ramp, not a jump to a faster pace held flat.",
    "negative",
  ),
  "positive-split": buildSplitStrategy(
    "positive-split",
    "Positive Split",
    "Holds an elevated effort (capped so it can't exceed a genuinely risky ceiling) through most of the race, then gradually fades over the final 10K as fatigue catches up -- a continuous decline, not a sudden drop.",
    "positive",
  ),
  "boston-strategy": bostonStrategy,
};

/** Linear interpolation of an effort curve at any race fraction -- what the split generator calls per mile. */
export function effortAtRaceFraction(curve: EffortCurvePoint[], raceFraction: number): number {
  if (raceFraction <= curve[0].raceFraction) return curve[0].targetEffortFraction;
  const last = curve[curve.length - 1];
  if (raceFraction >= last.raceFraction) return last.targetEffortFraction;

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (raceFraction >= a.raceFraction && raceFraction <= b.raceFraction) {
      if (b.raceFraction === a.raceFraction) return b.targetEffortFraction; // a vertical step -- take the post-step value
      const t = (raceFraction - a.raceFraction) / (b.raceFraction - a.raceFraction);
      return a.targetEffortFraction + (b.targetEffortFraction - a.targetEffortFraction) * t;
    }
  }
  return last.targetEffortFraction;
}
