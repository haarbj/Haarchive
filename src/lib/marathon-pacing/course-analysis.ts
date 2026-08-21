// Turns a parsed GPX/TCX/FIT/Strava route into course-level pacing inputs:
// individual climbs/descents (not just totals), a grade distribution, and a
// per-mile grade series the terrain-cost model can consume directly.
//
// Deliberately distinguishes "1000ft in one climb" from "1000ft across 80
// rollers" -- both have the same net elevationGainM in route-summary.ts's
// output, but very different pacing implications -- by segmenting the
// smoothed elevation profile into individual monotonic climb/descent legs
// (a turning-point/zigzag scan, the same family of technique used for
// "significant swing" detection in noisy time series) rather than only
// summing totals.

import { bearingDeg, haversineDistanceM } from "@/lib/route-import/route-summary";
import { STEEP_DOWNHILL_GRADE_THRESHOLD, gradeAddedCostJPerKgM } from "@/lib/grade-pace-physics";
import type { ParsedRoute } from "@/lib/route-import/types";

const METERS_PER_MILE = 1609.344;

export type ClimbSegment = {
  startDistanceM: number;
  endDistanceM: number;
  distanceM: number;
  gainM: number;
  avgGrade: number;
  maxGrade: number;
};

export type DescentSegment = {
  startDistanceM: number;
  endDistanceM: number;
  distanceM: number;
  lossM: number;
  /** Negative decimal grade (e.g. -0.06 for a 6% descent). */
  avgGrade: number;
  /** The single steepest (most negative) grade within this descent. */
  maxGrade: number;
};

export type GradeHistogramBucket = {
  bucketLowGrade: number;
  bucketHighGrade: number;
  distanceM: number;
};

export type CourseAnalysis = {
  totalDistanceM: number;
  totalClimbM: number;
  totalDescentM: number;
  /** Net grade from start to finish (decimal). */
  avgGrade: number;
  gradeHistogram: GradeHistogramBucket[];
  climbs: ClimbSegment[];
  descents: DescentSegment[];
  longestClimb: ClimbSegment | null;
  steepestClimb: ClimbSegment | null;
  longestDescent: DescentSegment | null;
  steepestDescent: DescentSegment | null;
  /** Climbs per mile -- a "choppiness" index. A single long climb scores low; frequent rollers score high, even at equal total gain. */
  rollingIndex: number;
  /**
   * Distance-weighted exposure to grades steeper than
   * STEEP_DOWNHILL_GRADE_THRESHOLD (the same -8% threshold grade-pace-physics.ts
   * already flags as where downhill running's eccentric-damage risk rises
   * sharply), in grade-meters. Not a physiological unit on its own -- a
   * relative index for comparing how much of a course's descent is "steep
   * enough to hurt" versus gentle.
   */
  downhillSeverityScore: number;
  /** Net grade for each full mile of the course, in order. */
  perMileGrade: number[];
  /**
   * True physics-based terrain energy cost (J/kg) for each full mile,
   * from applying Minetti's polynomial to the smoothed grid's own local
   * grade at every ~20m step and summing within each mile -- unlike
   * perMileGrade (a mile's net start-to-finish grade), this doesn't erase
   * a mile's real climbing and descending when they roughly cancel out
   * (e.g. a rolling mile that climbs 25m and drops 20m nets a ~1% grade,
   * but actually cost far more than a steady 1% grade would). This is
   * what elevation-cost consumers (precise-elevation-engine.ts) should
   * sum for adjustmentSeconds; perMileGrade remains for narrative/display
   * ("net uphill this mile") and pacing-strategy uses that genuinely want
   * the net trend.
   */
  perMileTerrainCostJPerKg: number[];
  /**
   * Distance-weighted circular-mean true bearing the runner heads toward
   * during each full mile -- null for a mile with no net directional GPS
   * signal (e.g. a tight out-and-back within that mile). Feeds per-mile
   * wind cost, which is genuinely local (unlike heat/humidity).
   */
  perMileHeadingDeg: (number | null)[];
  /**
   * Average ABSOLUTE altitude (meters above sea level) for each full
   * mile, from the same smoothed elevation grid perMileGrade and
   * perMileTerrainCostJPerKg use. Distinct from elevation gain/loss above:
   * this is "how high up was the runner," not "how much vertical ground
   * was covered" -- a route that climbs from 2,100m to 2,600m and a route
   * that stays flat at 2,350m the whole way have the same total climb
   * (500m) but very different altitude profiles. Feeds
   * precise-altitude-engine.ts, which costs each mile at its own real
   * altitude instead of assuming one constant altitude for the whole
   * effort.
   */
  perMileAltitudeM: number[];
};

export type CourseAnalysisOptions = {
  /** Spacing of the resampled elevation grid used for all downstream math. */
  resampleIntervalM?: number;
  /** Moving-average smoothing window applied before climb/descent detection. */
  smoothingWindowM?: number;
  /** Minimum net elevation swing (m) for a reversal to count as a new leg rather than GPS/barometric noise. */
  minSwingM?: number;
  /** Grade-histogram bucket width, as a decimal grade (0.02 = 2 percentage points). */
  histogramBucketWidth?: number;
  /** Grade-histogram range, as a decimal grade; grades beyond this collapse into the edge buckets. */
  histogramRange?: number;
};

const DEFAULT_RESAMPLE_INTERVAL_M = 20;
const DEFAULT_SMOOTHING_WINDOW_M = 100;
const DEFAULT_MIN_SWING_M = 10;
const DEFAULT_HISTOGRAM_BUCKET_WIDTH = 0.02;
const DEFAULT_HISTOGRAM_RANGE = 0.2;

type RawSample = { distanceM: number; elevationM: number };
type GridPoint = { distanceM: number; elevationM: number };

function buildRawSamples(route: ParsedRoute): RawSample[] {
  const samples: RawSample[] = [];
  let cumulativeDistanceM = 0;
  let previousPoint: { lat: number; lon: number } | null = null;
  let lastKnownElevationM: number | null = null;

  for (const point of route.points) {
    if (point.lat === null || point.lon === null) continue;
    if (previousPoint) {
      cumulativeDistanceM += haversineDistanceM(previousPoint.lat, previousPoint.lon, point.lat, point.lon);
    }
    previousPoint = { lat: point.lat, lon: point.lon };
    if (point.elevationM !== null) lastKnownElevationM = point.elevationM;
    if (lastKnownElevationM !== null) {
      samples.push({ distanceM: cumulativeDistanceM, elevationM: lastKnownElevationM });
    }
  }

  return samples;
}

function resampleAndSmooth(samples: RawSample[], resampleIntervalM: number, smoothingWindowM: number): GridPoint[] {
  const totalDistanceM = samples[samples.length - 1].distanceM;
  const stepCount = Math.max(1, Math.floor(totalDistanceM / resampleIntervalM));

  const resampled: GridPoint[] = [];
  let sampleIdx = 0;
  for (let i = 0; i <= stepCount; i++) {
    const targetDistanceM = i === stepCount ? totalDistanceM : i * resampleIntervalM;
    while (sampleIdx < samples.length - 2 && samples[sampleIdx + 1].distanceM < targetDistanceM) sampleIdx++;
    const a = samples[sampleIdx];
    const b = samples[Math.min(sampleIdx + 1, samples.length - 1)];
    const span = b.distanceM - a.distanceM;
    const t = span > 0 ? (targetDistanceM - a.distanceM) / span : 0;
    resampled.push({ distanceM: targetDistanceM, elevationM: a.elevationM + (b.elevationM - a.elevationM) * t });
  }

  const windowSamples = Math.max(1, Math.round(smoothingWindowM / resampleIntervalM));
  if (windowSamples <= 1) return resampled;

  return resampled.map((point, i) => {
    const lo = Math.max(0, i - Math.floor(windowSamples / 2));
    const hi = Math.min(resampled.length - 1, i + Math.floor(windowSamples / 2));
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += resampled[j].elevationM;
    return { distanceM: point.distanceM, elevationM: sum / (hi - lo + 1) };
  });
}

/**
 * A "significant swing" (zigzag) scan: walks the smoothed grid tracking the
 * current trend's running extreme, and only confirms a reversal -- turning
 * the running extreme into a committed turning point -- once the elevation
 * has moved back by at least `minSwingM` from it. This is what filters GPS
 * and barometric noise out of the climb/descent list without a fixed
 * elevation-delta-per-point threshold, which would either miss gentle-but-
 * long climbs or over-count noisy short ones.
 */
function findTurningPointIndices(grid: GridPoint[], minSwingM: number): number[] {
  const indices = [0];
  let direction: -1 | 0 | 1 = 0;
  let extremeIdx = 0;

  for (let i = 1; i < grid.length; i++) {
    const extremeElevation = grid[extremeIdx].elevationM;
    const delta = grid[i].elevationM - extremeElevation;

    if (direction === 0) {
      if (Math.abs(delta) >= minSwingM) {
        direction = delta > 0 ? 1 : -1;
        extremeIdx = i;
      }
      continue;
    }

    if (direction === 1) {
      if (grid[i].elevationM >= extremeElevation) {
        extremeIdx = i;
      } else if (extremeElevation - grid[i].elevationM >= minSwingM) {
        indices.push(extremeIdx);
        direction = -1;
        extremeIdx = i;
      }
    } else {
      if (grid[i].elevationM <= extremeElevation) {
        extremeIdx = i;
      } else if (grid[i].elevationM - extremeElevation >= minSwingM) {
        indices.push(extremeIdx);
        direction = 1;
        extremeIdx = i;
      }
    }
  }

  const lastIdx = grid.length - 1;
  if (indices[indices.length - 1] !== lastIdx) indices.push(lastIdx);
  return indices;
}

function legExtremeGrade(grid: GridPoint[], startIdx: number, endIdx: number, isClimb: boolean): number {
  let extreme = 0;
  for (let i = startIdx; i < endIdx; i++) {
    const dDist = grid[i + 1].distanceM - grid[i].distanceM;
    if (dDist <= 0) continue;
    const grade = (grid[i + 1].elevationM - grid[i].elevationM) / dDist;
    if (isClimb ? grade > extreme : grade < extreme) extreme = grade;
  }
  return extreme;
}

function buildLegs(
  grid: GridPoint[],
  turningIndices: number[],
  minSwingM: number,
): { climbs: ClimbSegment[]; descents: DescentSegment[] } {
  const climbs: ClimbSegment[] = [];
  const descents: DescentSegment[] = [];

  for (let k = 0; k < turningIndices.length - 1; k++) {
    const startIdx = turningIndices[k];
    const endIdx = turningIndices[k + 1];
    const startPoint = grid[startIdx];
    const endPoint = grid[endIdx];
    const distanceM = endPoint.distanceM - startPoint.distanceM;
    const elevationDeltaM = endPoint.elevationM - startPoint.elevationM;
    if (distanceM <= 0 || elevationDeltaM === 0) continue;
    // Every leg except the last is a confirmed reversal (delta >= minSwingM
    // by construction). The trailing leg from the last confirmed extreme to
    // the course's actual endpoint isn't a confirmed reversal -- it's just
    // wherever the route happens to finish -- so it's held to the same
    // noise floor rather than always being reported as a climb/descent.
    const isTrailingLeg = k === turningIndices.length - 2;
    if (isTrailingLeg && Math.abs(elevationDeltaM) < minSwingM) continue;

    const avgGrade = elevationDeltaM / distanceM;
    if (elevationDeltaM > 0) {
      climbs.push({
        startDistanceM: startPoint.distanceM,
        endDistanceM: endPoint.distanceM,
        distanceM,
        gainM: elevationDeltaM,
        avgGrade,
        maxGrade: legExtremeGrade(grid, startIdx, endIdx, true),
      });
    } else {
      descents.push({
        startDistanceM: startPoint.distanceM,
        endDistanceM: endPoint.distanceM,
        distanceM,
        lossM: -elevationDeltaM,
        avgGrade,
        maxGrade: legExtremeGrade(grid, startIdx, endIdx, false),
      });
    }
  }

  return { climbs, descents };
}

function buildGradeHistogram(grid: GridPoint[], bucketWidth: number, range: number): GradeHistogramBucket[] {
  const bucketCount = Math.round((range * 2) / bucketWidth);
  const buckets: GradeHistogramBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({ bucketLowGrade: -range + i * bucketWidth, bucketHighGrade: -range + (i + 1) * bucketWidth, distanceM: 0 });
  }

  for (let i = 0; i < grid.length - 1; i++) {
    const dDist = grid[i + 1].distanceM - grid[i].distanceM;
    if (dDist <= 0) continue;
    const grade = (grid[i + 1].elevationM - grid[i].elevationM) / dDist;
    const clamped = Math.min(range - 1e-9, Math.max(-range, grade));
    const bucketIdx = Math.min(bucketCount - 1, Math.max(0, Math.floor((clamped + range) / bucketWidth)));
    buckets[bucketIdx].distanceM += dDist;
  }

  return buckets;
}

function buildPerMileGrade(grid: GridPoint[], totalDistanceM: number): number[] {
  const mileCount = Math.floor(totalDistanceM / METERS_PER_MILE);
  const grades: number[] = [];
  let gridIdx = 0;

  function elevationAtDistance(targetDistanceM: number): number {
    while (gridIdx < grid.length - 2 && grid[gridIdx + 1].distanceM < targetDistanceM) gridIdx++;
    const a = grid[gridIdx];
    const b = grid[Math.min(gridIdx + 1, grid.length - 1)];
    const span = b.distanceM - a.distanceM;
    const t = span > 0 ? (targetDistanceM - a.distanceM) / span : 0;
    return a.elevationM + (b.elevationM - a.elevationM) * t;
  }

  let previousElevationM = elevationAtDistance(0);
  for (let mile = 1; mile <= mileCount; mile++) {
    const elevationM = elevationAtDistance(mile * METERS_PER_MILE);
    grades.push((elevationM - previousElevationM) / METERS_PER_MILE);
    previousElevationM = elevationM;
  }

  return grades;
}

/**
 * The real terrain-cost counterpart to buildPerMileGrade: instead of one
 * net grade per mile, walks the same fine-grained smoothed grid pairwise
 * (the same local-grade calculation buildGradeHistogram and
 * computeDownhillSeverityScore already use) and costs each ~20m step with
 * Minetti's polynomial directly, binning the result into whichever mile
 * that step falls in. A mile that climbs and then descends by comparable
 * amounts still costs real energy on both legs, even though its net grade
 * (and therefore its flat-equivalent-distance/GAP-style estimate) would
 * read as nearly zero.
 */
function buildPerMileTerrainCostJPerKg(grid: GridPoint[], totalDistanceM: number): number[] {
  const mileCount = Math.floor(totalDistanceM / METERS_PER_MILE);
  const costs = new Array(mileCount).fill(0);

  for (let i = 0; i < grid.length - 1; i++) {
    const dDist = grid[i + 1].distanceM - grid[i].distanceM;
    if (dDist <= 0) continue;
    const grade = (grid[i + 1].elevationM - grid[i].elevationM) / dDist;
    const mileIdx = Math.floor(grid[i].distanceM / METERS_PER_MILE);
    if (mileIdx >= mileCount) continue;
    costs[mileIdx] += gradeAddedCostJPerKgM(grade) * dDist;
  }

  return costs;
}

/**
 * Average absolute altitude for each full mile -- see CourseAnalysis's own
 * comment on perMileAltitudeM for why this is a distinct quantity from
 * grade/terrain-cost above (those describe vertical change WITHIN a mile;
 * this describes how high up that mile actually was).
 */
function buildPerMileAltitude(grid: GridPoint[], totalDistanceM: number): number[] {
  const mileCount = Math.floor(totalDistanceM / METERS_PER_MILE);
  const sums = new Array(mileCount).fill(0);
  const counts = new Array(mileCount).fill(0);

  for (const point of grid) {
    const mileIdx = Math.min(mileCount - 1, Math.floor(point.distanceM / METERS_PER_MILE));
    if (mileIdx < 0 || mileIdx >= mileCount) continue;
    sums[mileIdx] += point.elevationM;
    counts[mileIdx] += 1;
  }

  return sums.map((sum, i) => (counts[i] > 0 ? sum / counts[i] : 0));
}

/**
 * Bins each raw GPS segment's true bearing into the mile it falls within,
 * combining them with a distance-weighted circular mean (summing unit
 * vectors rather than raw degrees, so e.g. 350deg and 10deg average to
 * 0deg instead of 180deg). Uses the raw, unsmoothed points directly rather
 * than the resampled elevation grid, since that grid dropped lat/lon.
 */
function buildPerMileHeading(route: ParsedRoute, mileCount: number): (number | null)[] {
  const sinSums = new Array(mileCount).fill(0);
  const cosSums = new Array(mileCount).fill(0);
  const weights = new Array(mileCount).fill(0);

  let cumulativeDistanceM = 0;
  let previousPoint: { lat: number; lon: number } | null = null;

  for (const point of route.points) {
    if (point.lat === null || point.lon === null) continue;
    if (previousPoint) {
      const segmentDistanceM = haversineDistanceM(previousPoint.lat, previousPoint.lon, point.lat, point.lon);
      if (segmentDistanceM > 0) {
        const bearing = bearingDeg(previousPoint.lat, previousPoint.lon, point.lat, point.lon);
        const midDistanceM = cumulativeDistanceM + segmentDistanceM / 2;
        const mileIdx = Math.floor(midDistanceM / METERS_PER_MILE);
        if (mileIdx < mileCount) {
          const rad = (bearing * Math.PI) / 180;
          sinSums[mileIdx] += Math.sin(rad) * segmentDistanceM;
          cosSums[mileIdx] += Math.cos(rad) * segmentDistanceM;
          weights[mileIdx] += segmentDistanceM;
        }
        cumulativeDistanceM += segmentDistanceM;
      }
    }
    previousPoint = { lat: point.lat, lon: point.lon };
  }

  return sinSums.map((sinSum, i) =>
    weights[i] > 0 ? ((Math.atan2(sinSum, cosSums[i]) * 180) / Math.PI + 360) % 360 : null,
  );
}

function computeDownhillSeverityScore(grid: GridPoint[]): number {
  let score = 0;
  for (let i = 0; i < grid.length - 1; i++) {
    const dDist = grid[i + 1].distanceM - grid[i].distanceM;
    if (dDist <= 0) continue;
    const grade = (grid[i + 1].elevationM - grid[i].elevationM) / dDist;
    if (grade < STEEP_DOWNHILL_GRADE_THRESHOLD) {
      score += (STEEP_DOWNHILL_GRADE_THRESHOLD - grade) * dDist;
    }
  }
  return score;
}

export function analyzeCourse(route: ParsedRoute, options: CourseAnalysisOptions = {}): CourseAnalysis {
  const resampleIntervalM = options.resampleIntervalM ?? DEFAULT_RESAMPLE_INTERVAL_M;
  const smoothingWindowM = options.smoothingWindowM ?? DEFAULT_SMOOTHING_WINDOW_M;
  const minSwingM = options.minSwingM ?? DEFAULT_MIN_SWING_M;
  const histogramBucketWidth = options.histogramBucketWidth ?? DEFAULT_HISTOGRAM_BUCKET_WIDTH;
  const histogramRange = options.histogramRange ?? DEFAULT_HISTOGRAM_RANGE;

  const samples = buildRawSamples(route);
  if (samples.length < 2) {
    throw new Error("analyzeCourse requires at least two route points with GPS and elevation data.");
  }

  const grid = resampleAndSmooth(samples, resampleIntervalM, smoothingWindowM);
  const totalDistanceM = grid[grid.length - 1].distanceM;

  const turningIndices = findTurningPointIndices(grid, minSwingM);
  const { climbs, descents } = buildLegs(grid, turningIndices, minSwingM);

  const totalClimbM = climbs.reduce((sum, c) => sum + c.gainM, 0);
  const totalDescentM = descents.reduce((sum, d) => sum + d.lossM, 0);
  const avgGrade = totalDistanceM > 0 ? (grid[grid.length - 1].elevationM - grid[0].elevationM) / totalDistanceM : 0;

  const longestClimb = climbs.reduce<ClimbSegment | null>((best, c) => (!best || c.distanceM > best.distanceM ? c : best), null);
  const steepestClimb = climbs.reduce<ClimbSegment | null>((best, c) => (!best || c.maxGrade > best.maxGrade ? c : best), null);
  const longestDescent = descents.reduce<DescentSegment | null>((best, d) => (!best || d.distanceM > best.distanceM ? d : best), null);
  const steepestDescent = descents.reduce<DescentSegment | null>((best, d) => (!best || d.maxGrade < best.maxGrade ? d : best), null);

  const milesCount = totalDistanceM / METERS_PER_MILE;
  const rollingIndex = milesCount > 0 ? climbs.length / milesCount : 0;
  const perMileGrade = buildPerMileGrade(grid, totalDistanceM);

  return {
    totalDistanceM,
    totalClimbM,
    totalDescentM,
    avgGrade,
    gradeHistogram: buildGradeHistogram(grid, histogramBucketWidth, histogramRange),
    climbs,
    descents,
    longestClimb,
    steepestClimb,
    longestDescent,
    steepestDescent,
    rollingIndex,
    downhillSeverityScore: computeDownhillSeverityScore(grid),
    perMileGrade,
    perMileTerrainCostJPerKg: buildPerMileTerrainCostJPerKg(grid, totalDistanceM),
    perMileHeadingDeg: buildPerMileHeading(route, perMileGrade.length),
    perMileAltitudeM: buildPerMileAltitude(grid, totalDistanceM),
  };
}
