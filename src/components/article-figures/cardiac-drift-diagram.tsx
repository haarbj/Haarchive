"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

// A flatter viewBox than a plain 640x300 would suggest -- see
// race-pace-curve-diagram.tsx's own comment above its CHART_HEIGHT for
// the full reasoning: Diagram's "wide" box's padded content area is
// narrower than 21:9 once the fixed p-4 padding is subtracted at phone
// width, so a 640x300 viewBox overflows vertically there and
// overflow-hidden crops it. 640x230 stays safely inside that padded area
// at every width this site renders at.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// A 30-minute time trial, the page's own DIY threshold protocol. Pace held
// flat; heart rate drifts upward over the session. The page states heart
// rate "can climb 10 to 15 percent over 30 to 60 minutes of steady effort
// with no actual rise in oxygen consumption" -- the midpoint of that
// stated range (12.5%) sets the curve's total rise, same convention as
// the crossover diagram's fed-penalty value: a representative point
// inside a real cited range, not an invented one.
const TIME_MIN = 0;
const TIME_MAX = 30; // minutes
const xScale = scaleLinear([TIME_MIN, TIME_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([50, 92], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

const HR_START = 60; // relative units, arbitrary baseline
const DRIFT_FRACTION = 0.125; // midpoint of the page's stated 10-15% range
const HR_END = HR_START * (1 + DRIFT_FRACTION);
const PACE_LEVEL = 87; // held flat throughout -- the point of the diagram; placed well above the heart-rate cluster so its own line and label have clear room

function heartRateAt(minute: number): number {
  // A smooth, continuously accelerating drift -- the page attributes it to
  // rising core temperature and declining stroke volume building over the
  // session, not a linear or sudden change.
  const t = minute / TIME_MAX;
  return HR_START + (HR_END - HR_START) * t * t;
}

const SAMPLE_COUNT = 61;
function heartRatePath(): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const minute = (i * TIME_MAX) / (SAMPLE_COUNT - 1);
    const x = xScale(minute);
    const y = yScale(heartRateAt(minute));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function average(from: number, to: number): number {
  const steps = 200;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    sum += heartRateAt(from + ((to - from) * i) / steps);
  }
  return sum / (steps + 1);
}

const FULL_AVERAGE = average(0, 30);
const FINAL_TEN_AVERAGE = average(20, 30);

const SWEEP_DURATION_MS = 1100;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function CardiacDriftDiagram() {
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
        alt="A chart of a 30-minute time trial showing pace held perfectly flat while heart rate climbs steadily over the session, illustrating cardiac drift. A shaded band over the final 10 minutes shows that averaging only that window, rather than the full 30 minutes, produces a lower, more accurate threshold heart rate estimate."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* The final-10-minutes averaging window */}
            <rect
              x={xScale(20)}
              y={PAD_TOP}
              width={xScale(30) - xScale(20)}
              height={PLOT_HEIGHT}
              className="fill-[var(--accent-tip)] opacity-[0.08]"
            />
            <text x={xScale(25)} y={PAD_TOP + 14} textAnchor="middle" className="fill-zinc-400 text-[10px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
              final 10 min
            </text>

            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            {/* The last tick (30min) sits at xScale(TIME_MAX), the plot's
                own right edge -- center-anchoring its label there put its
                right half past the viewBox's right edge (PAD_RIGHT is only
                12px, less than half the label's own ~35.5px width), and
                SVG's default overflow:hidden clipped it (confirmed via
                Playwright getBBox at both 390px and 1280px). Right-anchoring
                just that one tick inside the viewBox's right edge fixes it
                without moving the tick mark or any other label. */}
            {[0, 10, 20, 30].map((t) => (
              <g key={t}>
                <line x1={xScale(t)} y1={PAD_TOP + PLOT_HEIGHT} x2={xScale(t)} y2={PAD_TOP + PLOT_HEIGHT + 5} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
                <text
                  x={t === TIME_MAX ? CHART_WIDTH - 4 : xScale(t)}
                  y={PAD_TOP + PLOT_HEIGHT + 17}
                  textAnchor={t === TIME_MAX ? "end" : "middle"}
                  className="fill-zinc-500 text-[12px] dark:fill-zinc-400"
                >
                  {t}min
                </text>
              </g>
            ))}

            {/* Naive average of the full 30 minutes -- overestimates
                threshold heart rate because of the drift. */}
            <line
              x1={PAD_LEFT}
              y1={yScale(FULL_AVERAGE)}
              x2={PAD_LEFT + PLOT_WIDTH}
              y2={yScale(FULL_AVERAGE)}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              className="stroke-zinc-400 dark:stroke-zinc-500"
            />
            {/* The actual protocol: average of only the final 10 minutes. */}
            <line
              x1={xScale(20)}
              y1={yScale(FINAL_TEN_AVERAGE)}
              x2={xScale(30)}
              y2={yScale(FINAL_TEN_AVERAGE)}
              strokeWidth="2.5"
              className="stroke-[var(--accent-tip)]"
              strokeLinecap="round"
            />

            <path d={heartRatePath()} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-research)]" strokeLinecap="round" />

            {/* Both average-line labels live in one fixed legend block,
                not inline on their own lines -- the two averages are only
                ~2.8 relative units apart (a real consequence of a modest
                10-15% drift), so inline labels sat on top of each other.
                A stacked legend in the open space above the curve's early
                climb stays legible regardless of how close the two lines
                actually are. */}
            <text x={PAD_LEFT + 4} y={PAD_TOP + 42} className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
              &ndash; &ndash; average of all 30 min (overestimates)
            </text>
            <text x={PAD_LEFT + 4} y={PAD_TOP + 56} className="fill-[var(--accent-tip)] text-[10.5px] font-semibold">
              &mdash; average of final 10 min (the actual protocol)
            </text>
            <text x={xScale(29)} y={yScale(heartRateAt(29)) - 10} textAnchor="end" className="fill-[var(--accent-research)] text-[11px] font-semibold">
              Heart rate
            </text>

            <line
              x1={PAD_LEFT}
              y1={yScale(PACE_LEVEL)}
              x2={PAD_LEFT + PLOT_WIDTH}
              y2={yScale(PACE_LEVEL)}
              strokeWidth="2"
              strokeDasharray="2 3"
              className="stroke-zinc-400 dark:stroke-zinc-600"
            />
            <text x={PAD_LEFT + 4} y={yScale(PACE_LEVEL) - 8} className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
              Pace (held steady)
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Illustrative curve shape, not measured data &mdash; the page states heart rate can climb 10&ndash;15% over
          30&ndash;60 minutes of steady effort with no rise in oxygen consumption at all, which is why the standard
          30-minute time trial protocol averages only the final 10 minutes rather than the full 30.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the cardiac drift animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
