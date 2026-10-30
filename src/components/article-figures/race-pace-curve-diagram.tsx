"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

// A flatter viewBox than the rest of this directory's 640x300 convention,
// on purpose: Diagram's "wide" box is a 21:9 CSS aspect-ratio applied to
// the OUTER box, but the inner padded content area (where the SVG
// actually renders, at p-4) has a measurably different, narrower aspect
// ratio once that fixed 16px padding is subtracted -- about 2.7:1 at a
// 390px phone width versus 2.33:1 (21:9) at the box level. A 640x300
// viewBox (2.13:1) is flatter than the box but TALLER than that padded
// content ratio, so it overflows vertically and overflow-hidden silently
// crops whatever sits near the top/bottom edge -- confirmed empirically
// against this same Diagram box (measured via Playwright at 390px: inner
// content 310x114.6px against an SVG that wants to render at 310x145px).
// 640x230 (2.78:1) sits on the flat side of that padded ratio at every
// width this site renders at, so content never clips; it only ever
// letterboxes with a little empty vertical space, which is harmless.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Real, cited figures -- "Racing Pace as a Percentage of Threshold Pace"
// quotes these nine values directly (Janssen, Training Lactate Pulse-Rate,
// 1987, cited in Livingstone, Healthy Intelligent Training). Not a single
// number here is invented or interpolated; this is the page's own table,
// drawn as a chart.
const RACE_PACES: { label: string; percent: number }[] = [
  { label: "Marathon", percent: 95 },
  { label: "Half", percent: 99 },
  { label: "15K", percent: 101 },
  { label: "10K", percent: 104 },
  { label: "5K", percent: 109 },
  { label: "3K", percent: 113 },
  { label: "2000m", percent: 119 },
  { label: "1500m", percent: 122 },
  { label: "800m", percent: 133 },
];

const PERCENT_MIN = 90;
const PERCENT_MAX = 135;
const BAR_WIDTH = 28;
// Inset the first/last bar centers by half a bar width plus a little air,
// so no bar's edge crosses the y-axis line or the right padding -- a
// plain edge-to-edge scaleLinear() put the first bar's left edge past the
// axis, clipping its "95%" label.
const X_INSET = BAR_WIDTH / 2 + 6;
const xScale = scaleLinear([0, RACE_PACES.length - 1], [PAD_LEFT + X_INSET, PAD_LEFT + PLOT_WIDTH - X_INSET]);
const yScale = scaleLinear([PERCENT_MIN, PERCENT_MAX], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

const SWEEP_DURATION_MS = 1200;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function RacePaceCurveDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  function reveal() {
    const el = sweepRef.current;
    if (!el) return;
    el.style.transition = `clip-path ${SWEEP_DURATION_MS}ms ${SWEEP_EASE}`;
    el.style.clipPath = REVEALED_CLIP;
  }

  function handleReplay() {
    const el = sweepRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.clipPath = HIDDEN_CLIP;
    el.offsetHeight; // eslint-disable-line @typescript-eslint/no-unused-expressions -- force a reflow before re-triggering
    requestAnimationFrame(reveal);
  }

  useEffect(() => {
    if (reducedMotion || hasPlayedOnce) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasPlayedOnce(true);
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, hasPlayedOnce]);

  const staticFallback = reducedMotion;
  const linePath = RACE_PACES.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(p.percent).toFixed(1)}`).join(" ");

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A bar chart of race pace as a percentage of threshold pace across nine distances: 95% for the marathon, 99% half marathon, 101% 15K, 104% 10K, 109% 5K, 113% 3K, 119% 2000m, 122% 1500m, and 133% 800m. The gap between consecutive bars grows sharply below 5K, showing each further percentage point above threshold costs disproportionately more as distance shortens."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            <line
              x1={PAD_LEFT}
              y1={yScale(100)}
              x2={PAD_LEFT + PLOT_WIDTH}
              y2={yScale(100)}
              strokeWidth="1"
              strokeDasharray="4 3"
              className="stroke-zinc-400 dark:stroke-zinc-500"
            />
            <text x={PAD_LEFT + PLOT_WIDTH} y={yScale(100) - 6} textAnchor="end" className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
              threshold pace (100%)
            </text>

            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />

            {RACE_PACES.map((p, i) => {
              const barX = xScale(i) - BAR_WIDTH / 2;
              const barY = yScale(p.percent);
              const barHeight = PAD_TOP + PLOT_HEIGHT - barY;
              return (
                <g key={p.label}>
                  <rect x={barX} y={barY} width={BAR_WIDTH} height={barHeight} rx="2" className="fill-[var(--accent-tip)] opacity-[0.85]" />
                  <text x={xScale(i)} y={barY - 8} textAnchor="middle" className="fill-zinc-700 text-[11px] font-semibold dark:fill-zinc-200">
                    {p.percent}%
                  </text>
                  <text x={xScale(i)} y={PAD_TOP + PLOT_HEIGHT + 16} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
                    {p.label}
                  </text>
                </g>
              );
            })}

            <path d={linePath} fill="none" strokeWidth="1.5" strokeDasharray="3 3" className="stroke-zinc-400 dark:stroke-zinc-500" />
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Real figures, quoted directly from the page (Janssen, <em>Training Lactate Pulse-Rate</em>, 1987, cited in
          Livingstone, <em>Healthy Intelligent Training</em>): the jump from marathon to half marathon is small, and
          the jump from 5K to 3K and below steepens fast.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the race pace curve animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
