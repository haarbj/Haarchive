"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 300;
const PAD_LEFT = 110;
const PAD_RIGHT = 20;
const PAD_TOP = 54;
const PAD_BOTTOM = 56;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Training Through the Decades's own list item (sections.ts): "Recovery
// spacing between hard efforts needs to widen with age, not just stay the
// same length: a runner who needed a day or two between quality sessions in
// their 20s may need 2-3 days by their 40s, and 4-5 days by their 50s,
// doing the identical relative-effort workout, just less frequently." Only
// these three named decades and exactly these three ranges are drawn --
// deliberately not smoothed into a continuous curve and no 30s/60s+ range
// is invented, since the page names neither.
const DAYS_MIN = 0;
const DAYS_MAX = 6;
const ROWS: { decade: string; range: [number, number] }[] = [
  { decade: "20s", range: [1, 2] },
  { decade: "40s", range: [2, 3] },
  { decade: "50s", range: [4, 5] },
];
const ROW_HEIGHT = 56;
const ROW_GAP = (PLOT_HEIGHT - ROWS.length * ROW_HEIGHT) / (ROWS.length - 1);
const BAR_THICKNESS = 22;

const xScale = scaleLinear([DAYS_MIN, DAYS_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);

function rowY(index: number): number {
  return PAD_TOP + index * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
}

const SWEEP_DURATION_MS = 900;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

// Single one-shot clip-path sweep, left to right, revealing all three
// decade ranges at once as "days needed" increases -- same technique and
// rationale as intensity-domains-diagram.tsx's pilot sweep (composite-only,
// cheap, and the data here is also monotonic left-to-right across the three
// rows, so one sweep reads correctly for every row simultaneously).
export function RecoverySpacingByDecadeDiagram() {
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
        alt="A horizontal chart showing recovery days needed between hard efforts widening with age, for the identical relative-effort workout: roughly 1-2 days in a runner's 20s, 2-3 days by their 40s, and 4-5 days by their 50s."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            <text x={CHART_WIDTH / 2} y={22} textAnchor="middle" className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
              Recovery spacing widens with age
            </text>
            <text x={CHART_WIDTH / 2} y={40} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
              The identical relative-effort workout, just less frequently
            </text>

            {/* Axis */}
            <line
              x1={PAD_LEFT}
              y1={PAD_TOP - 8}
              x2={PAD_LEFT}
              y2={PAD_TOP + PLOT_HEIGHT + 8}
              strokeWidth="1"
              className="stroke-zinc-300 dark:stroke-zinc-700"
            />
            {Array.from({ length: DAYS_MAX - DAYS_MIN + 1 }, (_, i) => DAYS_MIN + i).map((tick) => (
              <line
                key={tick}
                x1={xScale(tick)}
                y1={PAD_TOP - 8}
                x2={xScale(tick)}
                y2={PAD_TOP + PLOT_HEIGHT + 8}
                strokeWidth="1"
                className="stroke-zinc-100 dark:stroke-zinc-900"
              />
            ))}

            {ROWS.map((row, i) => {
              const y = rowY(i);
              const x0 = xScale(row.range[0]);
              const x1 = xScale(row.range[1]);
              return (
                <g key={row.decade}>
                  <text x={PAD_LEFT - 16} y={y + 4} textAnchor="end" className="fill-zinc-600 text-[13px] font-semibold dark:fill-zinc-200">
                    {row.decade}
                  </text>
                  <rect
                    x={x0}
                    y={y - BAR_THICKNESS / 2}
                    width={x1 - x0}
                    height={BAR_THICKNESS}
                    rx="6"
                    className="fill-[var(--accent-tip)] opacity-[0.85]"
                  />
                  <text x={(x0 + x1) / 2} y={y + 4} textAnchor="middle" className="fill-white text-[10.5px] font-semibold">
                    {row.range[0]}&ndash;{row.range[1]}d
                  </text>
                </g>
              );
            })}

            <line
              x1={PAD_LEFT}
              y1={PAD_TOP + PLOT_HEIGHT + 8}
              x2={PAD_LEFT + PLOT_WIDTH}
              y2={PAD_TOP + PLOT_HEIGHT + 8}
              strokeWidth="1"
              className="stroke-zinc-300 dark:stroke-zinc-700"
            />
            {Array.from({ length: DAYS_MAX - DAYS_MIN + 1 }, (_, i) => DAYS_MIN + i).map((tick) => (
              <g key={tick}>
                <line
                  x1={xScale(tick)}
                  y1={PAD_TOP + PLOT_HEIGHT + 8}
                  x2={xScale(tick)}
                  y2={PAD_TOP + PLOT_HEIGHT + 14}
                  strokeWidth="1"
                  className="stroke-zinc-300 dark:stroke-zinc-700"
                />
                <text x={xScale(tick)} y={PAD_TOP + PLOT_HEIGHT + 30} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
                  {tick}
                </text>
              </g>
            ))}
            <text x={PAD_LEFT + PLOT_WIDTH / 2} y={CHART_HEIGHT - 6} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
              Days between hard efforts
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Exactly the page&rsquo;s own named ranges &mdash; 20s/40s/50s, not smoothed into a continuous curve.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the recovery spacing animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
