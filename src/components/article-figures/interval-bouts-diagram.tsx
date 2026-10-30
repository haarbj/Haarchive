"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 300;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 56;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Every number quoted directly from "Same Effort, Very Different Cost"
// (Research Library, Seiler & Sylta, International Journal of Sports
// Physiology and Performance, 2017): four sets of 4-minute intervals
// produced 12.7 mmol/L blood lactate versus 4.7 mmol/L for the 16-minute
// version, and pushed 61% of sessions to a peak RPE of 19-20, compared to
// 8% for the longer intervals -- at an equal perceived "maximal session
// effort" for both.
const BOUTS = [
  { id: "4min", label: "4-minute intervals", lactate: 12.7, rpeShare: 61 },
  { id: "16min", label: "16-minute intervals", lactate: 4.7, rpeShare: 8 },
] as const;
const LACTATE_MAX = 14;
const BAR_WIDTH = 72;
const GROUP_GAP = 120;
const group0X = PAD_LEFT + PLOT_WIDTH / 2 - GROUP_GAP / 2 - BAR_WIDTH / 2;
const group1X = PAD_LEFT + PLOT_WIDTH / 2 + GROUP_GAP / 2 - BAR_WIDTH / 2;
const barX = [group0X, group1X];
const yScale = scaleLinear([0, LACTATE_MAX], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

const SWEEP_DURATION_MS = 900;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function IntervalBoutsDiagram() {
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
        alt="A bar chart comparing four sets of 4-minute intervals against four sets of 16-minute intervals at equal perceived maximal session effort. The 4-minute intervals produced 12.7 millimoles per liter of blood lactate and pushed 61% of sessions to a peak rating of perceived exertion of 19 to 20, versus 4.7 millimoles per liter and just 8% of sessions for the 16-minute intervals."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            {[0, 4, 8, 12].map((t) => (
              <text key={t} x={PAD_LEFT - 8} y={yScale(t) + 4} textAnchor="end" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
                {t}
              </text>
            ))}
            <text x={16} y={PAD_TOP + 4} className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
              mmol/L
            </text>

            {BOUTS.map((bout, i) => {
              const barHeight = PAD_TOP + PLOT_HEIGHT - yScale(bout.lactate);
              return (
                <g key={bout.id}>
                  <rect
                    x={barX[i]}
                    y={yScale(bout.lactate)}
                    width={BAR_WIDTH}
                    height={barHeight}
                    rx="3"
                    className={i === 0 ? "fill-[var(--accent-warning)] opacity-90" : "fill-[var(--accent-tip)] opacity-90"}
                  />
                  <text x={barX[i] + BAR_WIDTH / 2} y={yScale(bout.lactate) - 10} textAnchor="middle" className="fill-zinc-700 text-[13px] font-semibold dark:fill-zinc-200">
                    {bout.lactate} mmol/L
                  </text>
                  <text x={barX[i] + BAR_WIDTH / 2} y={PAD_TOP + PLOT_HEIGHT + 22} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
                    {bout.label}
                  </text>
                  <text x={barX[i] + BAR_WIDTH / 2} y={PAD_TOP + PLOT_HEIGHT + 40} textAnchor="middle" className="fill-zinc-400 text-[11px] dark:fill-zinc-500">
                    {bout.rpeShare}% hit RPE 19&ndash;20
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </Diagram>

      {!staticFallback ? (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the interval bouts animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Both protocols matched for perceived &ldquo;maximal session effort.&rdquo; Seiler &amp; Sylta, International
        Journal of Sports Physiology and Performance, 2017.
      </p>
    </div>
  );
}
