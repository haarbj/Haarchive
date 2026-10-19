"use client";

// A small, hand-built inline SVG elevation profile -- same convention the
// rest of this codebase uses for charts (no charting library; see
// training-load-chart.tsx and performance-trend-chart.tsx for the sibling
// pattern this mirrors: a fixed viewBox, padded plot area, and a filled
// area under a line). Deliberately simpler than those two (no hover
// tooltip) since this chart's whole job is a side-by-side visual shape
// comparison, not a per-point lookup.

const CHART_WIDTH = 320;
const CHART_HEIGHT = 140;
const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

export function CourseElevationChart({
  label,
  miles,
  colorClassName = "text-zinc-900 dark:text-white",
}: {
  label: string;
  /** Cumulative elevation (ft) at the end of each mile, starting implicitly from 0 at the start line. */
  miles: { mile: number; cumulativeElevationFt: number }[];
  colorClassName?: string;
}) {
  const points: { distanceMiles: number; elevationFt: number }[] = [
    { distanceMiles: 0, elevationFt: 0 },
    ...miles.map((m) => ({ distanceMiles: m.mile, elevationFt: m.cumulativeElevationFt })),
  ];

  const maxDistance = points[points.length - 1].distanceMiles || 1;
  const elevations = points.map((p) => p.elevationFt);
  const minElevation = Math.min(0, ...elevations);
  const maxElevation = Math.max(0, ...elevations);
  // A flat course has minElevation === maxElevation === 0, which would
  // divide by zero below -- pad the span so the line still renders as a
  // flat mid-chart line instead of collapsing.
  const span = maxElevation - minElevation || 100;

  const xFor = (distanceMiles: number) => PAD_LEFT + (distanceMiles / maxDistance) * PLOT_WIDTH;
  const yFor = (elevationFt: number) => PAD_TOP + PLOT_HEIGHT - ((elevationFt - minElevation) / span) * PLOT_HEIGHT;

  const coords = points.map((p) => ({ x: xFor(p.distanceMiles), y: yFor(p.elevationFt) }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const baselineY = yFor(0);
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${baselineY.toFixed(1)} L${coords[0].x.toFixed(1)},${baselineY.toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label={`${label}'s elevation profile, ${Math.round(maxElevation - minElevation)}ft of total relief`}>
      <line x1={PAD_LEFT} x2={CHART_WIDTH - PAD_RIGHT} y1={baselineY} y2={baselineY} stroke="currentColor" strokeWidth={1} strokeDasharray="3,3" className="text-zinc-300 dark:text-zinc-700" />
      <path d={areaPath} fill="currentColor" opacity={0.12} className={colorClassName} />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} className={colorClassName} />
      <text x={PAD_LEFT} y={CHART_HEIGHT - 4} fontSize={9} className="fill-zinc-500 dark:fill-zinc-400">
        0mi
      </text>
      <text x={CHART_WIDTH - PAD_RIGHT} y={CHART_HEIGHT - 4} textAnchor="end" fontSize={9} className="fill-zinc-500 dark:fill-zinc-400">
        {maxDistance.toFixed(1)}mi
      </text>
      <text x={PAD_LEFT - 4} y={PAD_TOP + 8} textAnchor="end" fontSize={9} className="fill-zinc-500 dark:fill-zinc-400">
        {Math.round(maxElevation)}ft
      </text>
      <text x={PAD_LEFT - 4} y={PAD_TOP + PLOT_HEIGHT} textAnchor="end" fontSize={9} className="fill-zinc-500 dark:fill-zinc-400">
        {Math.round(minElevation)}ft
      </text>
    </svg>
  );
}
