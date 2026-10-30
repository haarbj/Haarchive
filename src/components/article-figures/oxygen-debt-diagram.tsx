"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 680;
const CHART_HEIGHT = 320;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 48;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Every number quoted directly from "The math behind the corrected 4-liter
// ceiling" (Exercise Physiology): a 70kg runner covering 5,000m in 16
// minutes needs 4.31L of oxygen; at a 3.5 L/min Steady State, debt
// accrues at 0.81 L/min and the ~4L ceiling arrives at about 5 minutes;
// raised to a 4.06 L/min Steady State, debt accrues at 0.25 L/min and the
// same pace is sustainable for the full 16 minutes. 0.81*5 = 4.05 and
// 0.25*16 = 4.0, both consistent with "the corrected ceiling closer to 4
// liters" the page states.
const TIME_MAX = 16;
const DEBT_MAX = 4.6;
const CEILING = 4;
const UNTRAINED_RATE = 0.81;
const TRAINED_RATE = 0.25;
const UNTRAINED_CEILING_T = CEILING / UNTRAINED_RATE; // ~4.94 min
const TRAINED_CEILING_T = TIME_MAX; // sustains the full race

const xScale = scaleLinear([0, TIME_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0, DEBT_MAX], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

function linePath(rate: number, untilT: number): string {
  const steps = 20;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (untilT * i) / steps;
    const x = xScale(t);
    const y = yScale(Math.min(rate * t, DEBT_MAX));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const SWEEP_DURATION_MS = 1300; // longer than UI-chrome budget on purpose: this is the explanatory/marketing-content duration bucket STANDARDS.md names, not a UI-chrome transition, and the extra length lets a reader actually watch the two debt rates diverge over "time" rather than snap into place
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function OxygenDebtDiagram() {
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
  const ceilingY = yScale(CEILING);
  const untrainedPath = linePath(UNTRAINED_RATE, UNTRAINED_CEILING_T);
  const trainedPath = linePath(TRAINED_RATE, TRAINED_CEILING_T);

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A chart showing oxygen debt accumulating over 16 minutes for a 70kg runner racing 5,000m. At a 3.5 liters-per-minute Steady State, debt accrues at 0.81 liters per minute and hits the roughly 4-liter ceiling at about 5 minutes. At a trained 4.06 liters-per-minute Steady State, debt accrues at only 0.25 liters per minute and never reaches the ceiling across the full 16-minute race."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* The ~4L oxygen-debt ceiling */}
            <line x1={PAD_LEFT} y1={ceilingY} x2={PAD_LEFT + PLOT_WIDTH} y2={ceilingY} strokeWidth="1.5" strokeDasharray="5 4" className="stroke-[var(--accent-warning)]" />
            <text x={PAD_LEFT + PLOT_WIDTH} y={ceilingY - 6} textAnchor="end" className="fill-[var(--accent-warning)] text-[11px] font-semibold">
              ~4L ceiling
            </text>

            {/* Axes */}
            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            {[0, 4, 8, 12, 16].map((t) => (
              <text key={t} x={xScale(t)} y={PAD_TOP + PLOT_HEIGHT + 20} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
                {t}min
              </text>
            ))}
            <text x={PAD_LEFT + PLOT_WIDTH / 2} y={CHART_HEIGHT - 6} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              Time into the 16-minute 5,000m
            </text>

            {/* Untrained: 0.81 L/min, hits the ceiling ~5 min */}
            <path d={untrainedPath} fill="none" strokeWidth="2.5" className="stroke-zinc-400 dark:stroke-zinc-500" strokeLinecap="round" />
            <circle cx={xScale(UNTRAINED_CEILING_T)} cy={ceilingY} r="4" className="fill-zinc-400 dark:fill-zinc-500" />
            <text x={xScale(UNTRAINED_CEILING_T)} y={ceilingY - 14} textAnchor="middle" className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400">
              3.5 L/min: ceiling at ~5 min
            </text>

            {/* Trained: 0.25 L/min, sustains the full race */}
            <path d={trainedPath} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />
            <text x={xScale(TRAINED_CEILING_T) - 4} y={yScale(TRAINED_RATE * TRAINED_CEILING_T) - 10} textAnchor="end" className="fill-[var(--accent-tip)] text-[11px] font-semibold">
              4.06 L/min: full 16 min
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Worked example from this page&rsquo;s own text: a 70kg runner, 5,000m in 16:00, needing 4.31L of oxygen.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the oxygen debt animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
