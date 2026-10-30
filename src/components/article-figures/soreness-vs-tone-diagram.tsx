"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

// Same flatter viewBox convention as the rest of this directory's most
// recent batch.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;
const PAD_LEFT = 16;
const PAD_RIGHT = 16;
const PAD_TOP = 20;
const PAD_BOTTOM = 40;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// No existing figure on the site draws this distinction (checked: none of
// Exercise Physiology's 7 figures cover "Soreness Arrives Late, Tone Moves
// Fast", the section the Recovery page itself links to for the mechanism).
// This figure is deliberately the Recovery-page APPLICATION of that
// mechanism, not a duplicate of a hypothetical Exercise Physiology clock
// figure: it pairs the two curve shapes with the two concrete tools this
// page actually recommends (the easy jog, and cross-friction massage for
// tone specifically).
//
// Every number below is the Recovery page's own:
// - Soreness peaks 24-48h, fades within a few days ("Telling soreness from
//   something worse" callout).
// - Tone "can climb or drop within hours" ("Muscle Tone vs. Muscle
//   Soreness").
// - The easy jog the day after a hard effort is shown at hour 24 ("Jog
//   Through Soreness, Don't Wait It Out": "a slow, easy jog the day after
//   a hard effort").
// Both curves are illustrative shapes (0-100 "relative level"), the same
// "not a measured unit" convention as intensity-domains-diagram.tsx's
// lactate curve -- the SHAPE (smooth multi-day hill vs. jagged hour-scale
// swings) is the point, not any single plotted value.
const HOURS_MIN = 0;
const HOURS_MAX = 96;
const JOG_HOUR = 24;
const SORENESS_PEAK_RANGE: [number, number] = [24, 48];

const xScale = scaleLinear([HOURS_MIN, HOURS_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0, 100], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

// Soreness: a smooth, slow hill. Rises from the session, peaks inside the
// page's own 24-48h window, fades over the following few days -- a single
// bump, no jaggedness, because the underlying process is structural repair
// on its own biological clock.
function sorenessCurve(h: number): number {
  const peakCenter = 36; // midpoint of the page's own 24-48h peak window
  const spread = 26;
  return 78 * Math.exp(-((h - peakCenter) ** 2) / (2 * spread * spread));
}

// Tone: hour-scale, nervous-system-driven swings -- starts elevated from
// the hard session, oscillates on an hours-long period, and visibly steps
// down right after the easy jog at hour 24 (the page's own claim: the jog
// "is also one of the more reliable ways to bring elevated tone back down
// before the next hard session"). Jagged by construction, in deliberate
// visual contrast with soreness's smooth hill.
function toneCurve(h: number): number {
  const baseline = 55 + 18 * Math.sin(h / 5.5);
  const postJogDrop = h >= JOG_HOUR ? 26 * (1 - Math.exp(-(h - JOG_HOUR) / 7)) : 0;
  return Math.max(8, baseline - postJogDrop);
}

const SAMPLE_COUNT = 49; // every 2 hours across 0-96
function curvePath(fn: (h: number) => number): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const h = HOURS_MIN + i * 2;
    const x = xScale(h);
    const y = yScale(fn(h));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const SWEEP_DURATION_MS = 1100;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

// A one-shot clip-path sweep left to right along the hours axis -- same
// composite-only technique as intensity-domains-diagram.tsx and
// fueling-window-diagram.tsx, valid here for the same reason: both curves
// are read left to right as time passes, so a single sweep reveals the
// soreness hill, the tone zigzag, and the jog marker's effect on tone in
// the same order a reader would reason through the 4-day window.
export function SorenessVsToneDiagram() {
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
  const sorenessPath = curvePath(sorenessCurve);
  const tonePath = curvePath(toneCurve);
  const peakX0 = xScale(SORENESS_PEAK_RANGE[0]);
  const peakX1 = xScale(SORENESS_PEAK_RANGE[1]);
  const jogX = xScale(JOG_HOUR);

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="Two recovery curves over 96 hours after a hard effort. Soreness is a smooth hill: it rises, peaks within the page's own 24-to-48-hour window, and fades over the following few days. Muscle tone is jagged: it swings on an hours-long cycle because it's driven mostly by nervous-system activity rather than structural damage, and it visibly steps down after an easy jog at the 24-hour mark, the same jog the page recommends the day after a hard effort."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* Soreness peak window: the page's own 24-48h band */}
            <rect x={peakX0} y={PAD_TOP} width={peakX1 - peakX0} height={PLOT_HEIGHT} className="fill-[var(--accent-warning)] opacity-[0.08]" />
            <text x={(peakX0 + peakX1) / 2} y={PAD_TOP + 14} textAnchor="middle" className="fill-[var(--accent-warning)] text-[10.5px] font-semibold">
              Soreness peaks 24&ndash;48h
            </text>

            {/* Axes */}
            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            {[0, 24, 48, 72, 96].map((h) => (
              <g key={h}>
                <line x1={xScale(h)} y1={PAD_TOP + PLOT_HEIGHT} x2={xScale(h)} y2={PAD_TOP + PLOT_HEIGHT + 5} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
                <text x={xScale(h)} y={PAD_TOP + PLOT_HEIGHT + 20} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
                  {h}h
                </text>
              </g>
            ))}

            {/* Jog marker at hour 24 -- the page's own "easy jog the day
                after" recommendation, shown as the point that visibly bends
                the tone curve down */}
            <line x1={jogX} y1={PAD_TOP} x2={jogX} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1.5" strokeDasharray="4 3" className="stroke-zinc-500 dark:stroke-zinc-400" />
            <text x={jogX} y={PAD_TOP - 6} textAnchor="middle" className="fill-zinc-600 text-[10.5px] font-semibold dark:fill-zinc-300">
              Easy jog (day after)
            </text>

            {/* Soreness: smooth hill */}
            <path d={sorenessPath} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-warning)]" strokeLinecap="round" />
            {/* Tone: jagged, hour-scale swings */}
            <path d={tonePath} fill="none" strokeWidth="2" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />

            {/* Legend */}
            <g>
              <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT + 32} x2={PAD_LEFT + 20} y2={PAD_TOP + PLOT_HEIGHT + 32} strokeWidth="2.5" className="stroke-[var(--accent-warning)]" />
              <text x={PAD_LEFT + 26} y={PAD_TOP + PLOT_HEIGHT + 36} className="fill-zinc-600 text-[11px] dark:fill-zinc-300">
                Soreness &mdash; structural, days
              </text>
              <line x1={PAD_LEFT + 190} y1={PAD_TOP + PLOT_HEIGHT + 32} x2={PAD_LEFT + 210} y2={PAD_TOP + PLOT_HEIGHT + 32} strokeWidth="2" className="stroke-[var(--accent-tip)]" />
              <text x={PAD_LEFT + 216} y={PAD_TOP + PLOT_HEIGHT + 36} className="fill-zinc-600 text-[11px] dark:fill-zinc-300">
                Tone &mdash; nervous system, hours
              </text>
            </g>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Illustrative curve shapes, not measured data. The ~90% figure on this page (most &ldquo;heavy legs&rdquo;
          is tone, not unresolved damage) is Bakken&rsquo;s own self-tested estimate; cross-friction massage has
          pilot evidence as a tone-specific tool, distinct from a general relaxation massage.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the soreness versus tone animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
