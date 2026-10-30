"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

// Same flatter viewBox convention as the rest of this directory's most
// recent batch (race-pace-curve-diagram.tsx, dfa-alpha1-diagram.tsx,
// cardiac-drift-diagram.tsx) -- see race-pace-curve-diagram.tsx's own
// comment above its CHART_HEIGHT for the full root-cause writeup.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const PAD_LEFT = 16;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 40;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// The page's own real, quoted numbers (what-a-race-result-can-tell-you,
// "Same Race Time, Different Runner"): an 18:00 5K runner's average real
// threshold pace is roughly 6:08/mile, and at that exact pace any
// individual runner at that performance level has "close to a 50/50
// chance of actually being at or under threshold" -- i.e. the average
// pace sits at the distribution's own median, which is what justifies
// drawing a single symmetric curve centered there. This site's statistical
// model then defaults to a conservative "safe estimate" at roughly the
// 10th percentile of the threshold-SPEED distribution, a number "slow
// enough that most runners... are genuinely below threshold at it."
//
// The page gives no distribution SHAPE and no actual spread/SD -- only
// the average and the fact that the safe estimate sits at the 10th
// percentile. So the curve below is illustrative (a generic symmetric
// bell), and the 10th-percentile mark's horizontal position uses the
// standard normal distribution's own 10th-percentile z-score (-1.2816)
// purely to place it plausibly along that illustrative curve -- a
// statistical convention, not a claim about the real population's actual
// shape or spread. No number other than "6:08/mile" (the page's own
// quoted average) is ever rendered as text.
const Z_10TH_PERCENTILE = -1.2816;
const X_MIN = -2.6;
const X_MAX = 2.6;
const xScale = scaleLinear([X_MIN, X_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0, 1], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

function gaussian(z: number): number {
  return Math.exp(-(z * z) / 2);
}

const SAMPLE_COUNT = 81;
function curvePath(): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const z = X_MIN + (i * (X_MAX - X_MIN)) / (SAMPLE_COUNT - 1);
    const x = xScale(z);
    const y = yScale(gaussian(z));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function areaPath(zFrom: number, zTo: number): string {
  const steps = 40;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const z = zFrom + ((zTo - zFrom) * i) / steps;
    points.push(`${i === 0 ? "M" : "L"}${xScale(z).toFixed(1)},${yScale(gaussian(z)).toFixed(1)}`);
  }
  points.push(`L${xScale(zTo).toFixed(1)},${(PAD_TOP + PLOT_HEIGHT).toFixed(1)}`);
  points.push(`L${xScale(zFrom).toFixed(1)},${(PAD_TOP + PLOT_HEIGHT).toFixed(1)}`);
  points.push("Z");
  return points.join(" ");
}

const SWEEP_DURATION_MS = 1000;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function RaceTimeDistributionDiagram() {
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
  const safeZ = Z_10TH_PERCENTILE;

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A symmetric bell-curve distribution of real threshold pace among 18:00 5K runners, centered on the group's average pace of roughly 6:08 per mile. The left half of the curve is shaded to show that the average pace is also the distribution's median: any individual runner at this performance level has close to a 50/50 chance of truly being at or under threshold there. A second, smaller shaded region marks the 10th percentile of the threshold-speed distribution, on the slower side, labeled as this site's conservative safe estimate: a pace slow enough that most runners at this level are genuinely below their real threshold at it, not just typically."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* 50/50 half: area left of the average/median -- illustrates
                "close to a 50/50 chance of actually being at or under
                threshold" at the average pace itself. */}
            <path d={areaPath(X_MIN, 0)} className="fill-[var(--accent-tip)] opacity-[0.1]" />
            {/* The 10th-percentile safe-estimate tail, on the slow side. */}
            <path d={areaPath(X_MIN, safeZ)} className="fill-[var(--accent-warning)] opacity-[0.22]" />

            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />

            <path d={curvePath()} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />

            {/* Average / median marker */}
            <line x1={xScale(0)} y1={PAD_TOP} x2={xScale(0)} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1.5" strokeDasharray="4 3" className="stroke-zinc-500 dark:stroke-zinc-400" />
            <text x={xScale(0)} y={PAD_TOP + PLOT_HEIGHT + 18} textAnchor="middle" className="fill-zinc-700 text-[12px] font-semibold dark:fill-zinc-200">
              avg: ~6:08/mile
            </text>
            <text x={xScale(0)} y={PAD_TOP + 14} textAnchor="middle" className="fill-[var(--accent-tip)] text-[10.5px] font-semibold">
              50/50 here
            </text>

            {/* Safe-estimate marker */}
            <line x1={xScale(safeZ)} y1={PAD_TOP} x2={xScale(safeZ)} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="2" className="stroke-[var(--accent-warning)]" />
            <circle cx={xScale(safeZ)} cy={yScale(gaussian(safeZ))} r="4" className="fill-[var(--accent-warning)]" />
            <text x={xScale(safeZ)} y={PAD_TOP + PLOT_HEIGHT + 18} textAnchor="middle" className="fill-zinc-700 text-[11px] font-semibold dark:fill-zinc-200">
              10th pct.
            </text>
            <text x={xScale(safeZ)} y={PAD_TOP + PLOT_HEIGHT + 32} textAnchor="middle" className="fill-zinc-500 text-[10px] dark:fill-zinc-400">
              (this site&rsquo;s safe estimate)
            </text>

            {/* Faster / slower axis orientation */}
            <text x={PAD_LEFT} y={PAD_TOP + PLOT_HEIGHT + 18} textAnchor="start" className="fill-zinc-400 text-[10.5px] uppercase tracking-wide dark:fill-zinc-500">
              faster
            </text>
            <text x={PAD_LEFT + PLOT_WIDTH} y={PAD_TOP + PLOT_HEIGHT + 18} textAnchor="end" className="fill-zinc-400 text-[10.5px] uppercase tracking-wide dark:fill-zinc-500">
              slower
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Curve shape is illustrative; only the 6:08/mile average is a real, quoted number. The 10th-percentile mark
          is positioned using the standard normal distribution&rsquo;s own 10th-percentile point, to place it
          plausibly on the curve &mdash; the page does not state the population&rsquo;s real spread.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the race time distribution animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
