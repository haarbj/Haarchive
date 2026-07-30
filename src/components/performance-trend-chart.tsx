"use client";

import { useState } from "react";

import { formatDate, formatDistance } from "@/lib/format";
import { formatClock } from "@/lib/running-format";
import { parseIsoDateLocal, type TrendPoint } from "@/lib/performance-trend";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 200;
const PAD_LEFT = 52;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

export function PerformanceTrendChart({ points, targetLabel }: { points: TrendPoint[]; targetLabel: string }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const dateMs = points.map((point) => parseIsoDateLocal(point.raceDate).getTime());
  const values = points.map((point) => point.equivalentSeconds);
  const minDateMs = Math.min(...dateMs);
  const maxDateMs = Math.max(...dateMs);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  // A flat or single-point series would divide by zero in the scale
  // functions below -- pad the value range so the line still renders
  // (centered) instead of collapsing onto one edge of the chart.
  const valueSpan = maxValue - minValue || Math.max(1, minValue * 0.05);
  const dateSpan = maxDateMs - minDateMs || 1;

  const xForDate = (ms: number) => PAD_LEFT + ((ms - minDateMs) / dateSpan) * PLOT_WIDTH;
  const yForValue = (value: number) => PAD_TOP + PLOT_HEIGHT - ((value - (minValue - valueSpan * 0.1)) / (valueSpan * 1.2)) * PLOT_HEIGHT;

  const coords = points.map((point, index) => ({
    x: points.length === 1 ? PAD_LEFT + PLOT_WIDTH / 2 : xForDate(dateMs[index]),
    y: yForValue(point.equivalentSeconds),
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  const yTicks = [minValue - valueSpan * 0.1, minValue + valueSpan * 0.4, maxValue + valueSpan * 0.1];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const hoveredCoord = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label={`Equivalent ${targetLabel} time over time`}>
        {yTicks.map((tick, i) => (
          <g key={i} className="text-zinc-400 dark:text-zinc-600">
            <line x1={PAD_LEFT} x2={CHART_WIDTH - PAD_RIGHT} y1={yForValue(tick)} y2={yForValue(tick)} stroke="currentColor" strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
            <text x={PAD_LEFT - 8} y={yForValue(tick)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="currentColor">
              {formatClock(tick)}
            </text>
          </g>
        ))}

        <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} className="text-zinc-900 dark:text-white" />

        {coords.map((coord, index) => (
          <circle
            key={points[index].id}
            cx={coord.x}
            cy={coord.y}
            r={hoverIndex === index ? 5 : 3.5}
            className="cursor-pointer fill-zinc-900 dark:fill-white"
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
          />
        ))}

        <text x={PAD_LEFT} y={CHART_HEIGHT - 6} fontSize={10} className="fill-zinc-500 dark:fill-zinc-400">
          {formatDate(points[0].raceDate)}
        </text>
        <text x={CHART_WIDTH - PAD_RIGHT} y={CHART_HEIGHT - 6} textAnchor="end" fontSize={10} className="fill-zinc-500 dark:fill-zinc-400">
          {formatDate(points[points.length - 1].raceDate)}
        </text>
      </svg>

      {hovered && hoveredCoord && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-zinc-800"
          style={{ left: `${(hoveredCoord.x / CHART_WIDTH) * 100}%`, top: `${(hoveredCoord.y / CHART_HEIGHT) * 100}%` }}
        >
          <p className="font-semibold text-zinc-900 dark:text-white">{hovered.raceName}</p>
          <p className="text-zinc-600 dark:text-zinc-300">
            {formatDistance(hovered.distanceM)} in {formatClock(hovered.finishTimeS)} · {formatDate(hovered.raceDate)}
          </p>
          <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">Equivalent {targetLabel}: {formatClock(hovered.equivalentSeconds)}</p>
        </div>
      )}
    </div>
  );
}
