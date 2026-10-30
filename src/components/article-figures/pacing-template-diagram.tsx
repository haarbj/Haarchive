"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 280;
const PAD_LEFT = 16;
const PAD_RIGHT = 16;
const PAD_TOP = 20;
const PAD_BOTTOM = 36;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Entirely illustrative -- "Where the Two Camps Actually Converge" (Exercise
// Physiology) describes this relationship only qualitatively (a race that
// "falls apart in the middle and then, mysteriously, finish[es] with a fast
// last lap" as "effort finally catches back down to what the template
// expected"). No numbers are stated or invented here; only the SHAPE is the
// point, same convention as the pilot's lactate curve.
const xScale = scaleLinear([0, 100], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0, 100], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

function template(progress: number): number {
  return 30 + 0.5 * progress;
}
function felt(progress: number): number {
  // Tracks the template early, overshoots through a mid-race "fall apart"
  // bulge, then converges back onto it for a fast final stretch -- the
  // shape the page's text describes.
  const bulge = 26 * Math.exp(-((progress - 55) ** 2) / (2 * 18 ** 2));
  const reconverge = progress > 90 ? -10 * ((progress - 90) / 10) : 0;
  return template(progress) + bulge + reconverge;
}

const SAMPLE_COUNT = 51;
function pathFor(fn: (p: number) => number): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const progress = (i * 100) / (SAMPLE_COUNT - 1);
    const x = xScale(progress);
    const y = yScale(fn(progress));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const SWEEP_DURATION_MS = 1200;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function PacingTemplateDiagram() {
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

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A chart showing felt effort across a race rising smoothly alongside an expected pacing template through the first half, bulging well above the template around the midpoint as the race 'falls apart,' then converging back onto the template near the finish, producing a fast final stretch as effort finally catches back down to what was expected."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            <path d={pathFor(template)} fill="none" strokeWidth="1.5" strokeDasharray="5 4" className="stroke-zinc-400 dark:stroke-zinc-600" />
            <text x={PAD_LEFT + 2} y={yScale(template(2)) - 8} className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              Expected template
            </text>

            <path d={pathFor(felt)} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />
            <text x={xScale(55)} y={yScale(felt(55)) - 10} textAnchor="middle" className="fill-[var(--accent-tip)] text-[11px] font-semibold">
              falls apart mid-race
            </text>
            <text x={xScale(94)} y={yScale(felt(94)) - 10} textAnchor="middle" className="fill-[var(--accent-tip)] text-[11px] font-semibold">
              fast last lap
            </text>

            <text x={PAD_LEFT} y={CHART_HEIGHT - 6} className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              Start
            </text>
            <text x={PAD_LEFT + PLOT_WIDTH} y={CHART_HEIGHT - 6} textAnchor="end" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              Finish
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Illustrative shape only &mdash; the page describes this pattern qualitatively, with no stated numbers to plot.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the pacing template animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
