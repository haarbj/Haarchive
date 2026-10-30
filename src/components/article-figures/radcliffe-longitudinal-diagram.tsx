"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 340;
const PAD_LEFT = 52;
const PAD_RIGHT = 16;
const PANEL_TOP_PAD = 14;
const PANEL_HEIGHT = 120;
const PANEL_GAP = 36;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;

// Every number quoted directly from the Radcliffe longitudinal paragraph
// (Research Library, Jones, "The Physiology of the World Record Holder
// for the Women's Marathon," International Journal of Sports Science &
// Coaching, 2006): VO2 max held flat around 70 ml/kg/min from 1992 to
// 2003, while threshold pace shifted from roughly 14-15 km/h up to
// 17.5-18.5 km/h over the same span, and the oxygen cost of running at a
// fixed 16 km/h dropped from about 205 to about 175 ml/kg/km. Both lines
// are drawn as a smooth, monotonic trend between the page's own stated
// start/end ranges (midpoints of each range), not as digitized yearly
// data points -- the page gives no intermediate-year values.
const YEAR_START = 1992;
const YEAR_END = 2003;
const VO2MAX = 70; // flat across the whole span
const THRESHOLD_START = 14.5; // midpoint of "14-15 km/h"
const THRESHOLD_END = 18; // midpoint of "17.5-18.5 km/h"
const O2_COST_START = 205;
const O2_COST_END = 175;

const xScale = scaleLinear([YEAR_START, YEAR_END], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const vo2YScale = scaleLinear([60, 80], [PANEL_TOP_PAD + PANEL_HEIGHT, PANEL_TOP_PAD]);
const thresholdYScale = scaleLinear(
  [13, 19],
  [PANEL_TOP_PAD + PANEL_HEIGHT + PANEL_GAP + PANEL_HEIGHT, PANEL_TOP_PAD + PANEL_HEIGHT + PANEL_GAP],
);

const SWEEP_DURATION_MS = 1300; // marketing/explanatory bucket: an 11-year trend, not UI chrome -- gets the longer duration STANDARDS.md names for this case
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function RadcliffeLongitudinalDiagram() {
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
        alt="Two stacked trend lines spanning 1992 to 2003 for Paula Radcliffe. The top panel shows VO2 max holding essentially flat around 70 ml/kg/min across the full span. The bottom panel shows threshold pace rising from roughly 14-15 km/h to 17.5-18.5 km/h over the same years, alongside a note that the oxygen cost of running a fixed 16 km/h dropped from about 205 to about 175 ml/kg/km."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* Panel 1: VO2 max, flat */}
            <text x={PAD_LEFT} y={PANEL_TOP_PAD - 2} className="fill-zinc-400 text-[10px] font-semibold uppercase dark:fill-zinc-500">
              VO2 max (ml/kg/min)
            </text>
            <line x1={PAD_LEFT} y1={PANEL_TOP_PAD} x2={PAD_LEFT} y2={PANEL_TOP_PAD + PANEL_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line
              x1={PAD_LEFT}
              y1={PANEL_TOP_PAD + PANEL_HEIGHT}
              x2={PAD_LEFT + PLOT_WIDTH}
              y2={PANEL_TOP_PAD + PANEL_HEIGHT}
              strokeWidth="1"
              className="stroke-zinc-300 dark:stroke-zinc-700"
            />
            <line
              x1={xScale(YEAR_START)}
              y1={vo2YScale(VO2MAX)}
              x2={xScale(YEAR_END)}
              y2={vo2YScale(VO2MAX)}
              strokeWidth="2.5"
              className="stroke-zinc-400 dark:stroke-zinc-500"
              strokeLinecap="round"
            />
            <text x={xScale(YEAR_START) + 6} y={vo2YScale(VO2MAX) - 10} className="fill-zinc-500 text-[12px] font-semibold dark:fill-zinc-400">
              ~{VO2MAX} ml/kg/min, flat for over a decade
            </text>

            {/* Panel 2: threshold pace, rising */}
            <text x={PAD_LEFT} y={PANEL_TOP_PAD + PANEL_HEIGHT + PANEL_GAP - 8} className="fill-zinc-400 text-[10px] font-semibold uppercase dark:fill-zinc-500">
              Threshold pace (km/h)
            </text>
            <line
              x1={PAD_LEFT}
              y1={PANEL_TOP_PAD + PANEL_HEIGHT + PANEL_GAP}
              x2={PAD_LEFT}
              y2={PANEL_TOP_PAD + PANEL_HEIGHT + PANEL_GAP + PANEL_HEIGHT}
              strokeWidth="1"
              className="stroke-zinc-300 dark:stroke-zinc-700"
            />
            <line
              x1={PAD_LEFT}
              y1={PANEL_TOP_PAD + PANEL_HEIGHT + PANEL_GAP + PANEL_HEIGHT}
              x2={PAD_LEFT + PLOT_WIDTH}
              y2={PANEL_TOP_PAD + PANEL_HEIGHT + PANEL_GAP + PANEL_HEIGHT}
              strokeWidth="1"
              className="stroke-zinc-300 dark:stroke-zinc-700"
            />
            <line
              x1={xScale(YEAR_START)}
              y1={thresholdYScale(THRESHOLD_START)}
              x2={xScale(YEAR_END)}
              y2={thresholdYScale(THRESHOLD_END)}
              strokeWidth="2.5"
              className="stroke-[var(--accent-tip)]"
              strokeLinecap="round"
            />
            <text x={xScale(YEAR_START) + 6} y={thresholdYScale(THRESHOLD_START) + 16} className="fill-[var(--accent-tip)] text-[12px] font-semibold">
              14&ndash;15 km/h
            </text>
            <text x={xScale(YEAR_END) - 6} y={thresholdYScale(THRESHOLD_END) - 10} textAnchor="end" className="fill-[var(--accent-tip)] text-[12px] font-semibold">
              17.5&ndash;18.5 km/h
            </text>

            <text x={xScale(YEAR_START)} y={CHART_HEIGHT - 10} className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              {YEAR_START}
            </text>
            <text x={xScale(YEAR_END)} y={CHART_HEIGHT - 10} textAnchor="end" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              {YEAR_END}
            </text>
          </svg>
        </div>
      </Diagram>

      {!staticFallback ? (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the Radcliffe longitudinal animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Jones, &ldquo;The Physiology of the World Record Holder for the Women&rsquo;s Marathon,&rdquo; 2006. Over the
        same span, running economy improved by close to 15%: the oxygen cost of a fixed 16 km/h dropped from about{" "}
        {O2_COST_START} to about {O2_COST_END} ml/kg/km.
      </p>
    </div>
  );
}
