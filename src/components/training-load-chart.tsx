"use client";

import { useState } from "react";

import { MILE_METERS } from "@/lib/race-distances";
import type { WorkoutLoadPoint } from "@/lib/training-load";

// completedAt is a full timestamp, not a bare date -- formatting it
// directly from the Date object (rather than round-tripping through
// format.ts's formatDate, which re-parses a "YYYY-MM-DD" string at forced
// local midnight) avoids misreading the calendar day for a run logged
// near midnight in the viewer's timezone.
function formatWorkoutDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 200;
const PAD_LEFT = 36;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Both series are already percentages, so -- unlike PerformanceTrendChart,
// which scales its y-axis to whatever range the data happens to span --
// they share one fixed 0-100 axis. That also makes "how big is this bar
// relative to the axis" directly comparable between the two lines, which a
// per-series auto-scaled axis would quietly misrepresent.
function yForPct(pct: number): number {
  return PAD_TOP + PLOT_HEIGHT - (pct / 100) * PLOT_HEIGHT;
}

export function TrainingLoadChart({ points }: { points: WorkoutLoadPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const dateMs = points.map((point) => new Date(point.completedAt).getTime());
  const minDateMs = Math.min(...dateMs);
  const maxDateMs = Math.max(...dateMs);
  const dateSpan = maxDateMs - minDateMs || 1;
  const xForDate = (ms: number) => PAD_LEFT + ((ms - minDateMs) / dateSpan) * PLOT_WIDTH;

  const xs = points.map((_, index) => (points.length === 1 ? PAD_LEFT + PLOT_WIDTH / 2 : xForDate(dateMs[index])));
  const glycogenPath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yForPct(points[i].glycogenDepletedPct).toFixed(1)}`).join(" ");
  const driftPath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yForPct(points[i].cardiacDriftPct).toFixed(1)}`).join(" ");

  const yTicks = [0, 50, 100];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label="Glycogen depletion and cardiac drift per workout">
        {yTicks.map((tick) => (
          <g key={tick} className="text-zinc-400 dark:text-zinc-600">
            <line x1={PAD_LEFT} x2={CHART_WIDTH - PAD_RIGHT} y1={yForPct(tick)} y2={yForPct(tick)} stroke="currentColor" strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
            <text x={PAD_LEFT - 6} y={yForPct(tick)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="currentColor">
              {tick}%
            </text>
          </g>
        ))}

        <path d={glycogenPath} fill="none" stroke="currentColor" strokeWidth={2} className="text-amber-600 dark:text-amber-400" />
        <path d={driftPath} fill="none" stroke="currentColor" strokeWidth={2} className="text-sky-600 dark:text-sky-400" />

        {xs.map((x, index) => (
          <g key={points[index].id} onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => setHoverIndex(null)} className="cursor-pointer">
            <circle cx={x} cy={yForPct(points[index].glycogenDepletedPct)} r={hoverIndex === index ? 5 : 3.5} className="fill-amber-600 dark:fill-amber-400" />
            <circle cx={x} cy={yForPct(points[index].cardiacDriftPct)} r={hoverIndex === index ? 5 : 3.5} className="fill-sky-600 dark:fill-sky-400" />
            <rect x={x - PLOT_WIDTH / Math.max(1, points.length) / 2} y={PAD_TOP} width={PLOT_WIDTH / Math.max(1, points.length)} height={PLOT_HEIGHT} fill="transparent" />
          </g>
        ))}

        <text x={PAD_LEFT} y={CHART_HEIGHT - 6} fontSize={10} className="fill-zinc-500 dark:fill-zinc-400">
          {formatWorkoutDate(points[0].completedAt)}
        </text>
        <text x={CHART_WIDTH - PAD_RIGHT} y={CHART_HEIGHT - 6} textAnchor="end" fontSize={10} className="fill-zinc-500 dark:fill-zinc-400">
          {formatWorkoutDate(points[points.length - 1].completedAt)}
        </text>
      </svg>

      <div className="mt-1 flex gap-4 text-xs text-zinc-600 dark:text-zinc-300">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-400" /> Glycogen used
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-600 dark:bg-sky-400" /> Cardiac drift
        </span>
      </div>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-zinc-800"
          style={{ left: `${(xs[hoverIndex!] / CHART_WIDTH) * 100}%`, top: `${(yForPct(Math.max(hovered.glycogenDepletedPct, hovered.cardiacDriftPct)) / CHART_HEIGHT) * 100}%` }}
        >
          <p className="font-semibold text-zinc-900 dark:text-white">{formatWorkoutDate(hovered.completedAt)}</p>
          <p className="text-zinc-600 dark:text-zinc-300">
            {(hovered.distanceM / MILE_METERS).toFixed(1)} mi in {Math.round(hovered.timeSeconds / 60)} min
          </p>
          <p className="mt-0.5 text-amber-700 dark:text-amber-400">Glycogen used: {Math.round(hovered.glycogenDepletedPct)}%</p>
          <p className="text-sky-700 dark:text-sky-400">Cardiac drift: {Math.round(hovered.cardiacDriftPct)}%</p>
          {hovered.wPrimeUsedPct >= 1 && <p className="text-zinc-500 dark:text-zinc-400">W&rsquo; used: {Math.round(hovered.wPrimeUsedPct)}%</p>}
        </div>
      )}
    </div>
  );
}
