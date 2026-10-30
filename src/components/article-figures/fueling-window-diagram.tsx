"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

// Same flatter viewBox convention as the rest of this directory's most
// recent batch (race-pace-curve-diagram.tsx, three-prediction-models-diagram.tsx,
// prediction-error-widening-diagram.tsx).
const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const PAD_LEFT = 16;
const PAD_RIGHT = 16;
const PAD_TOP = 20;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const TRACK_Y = 96;

// Every number below is the nutrition-and-fueling page's own, not invented
// for this figure:
// - "under an hour, most runners need little or none" and "60-120 minutes
//   calls for roughly 30-60 grams an hour" (How Much Carbohydrate a Session
//   Actually Needs) sets the two bands and where the 60-minute line falls.
// - "20-25 grams every 30 minutes from a gel" (Small and Frequent Beats One
//   Big Dose) sets the dose size and the cadence used for the two gel
//   markers below. A 120-minute example session is chosen (rather than the
//   80-minute one originally sketched for this figure) specifically
//   because it's the shortest session long enough to show that real,
//   quoted 30-minute cadence twice -- an 80-minute session would only fit
//   one real gel inside the fueling band, which can't show a "cadence" at
//   all. The page gives no rule for a cutoff before the finish, so none is
//   drawn here.
const DURATION_MIN = 0;
const DURATION_MAX = 120;
const NO_FUEL_END = 60;
const GEL_TIMES = [60, 90];

const xScale = scaleLinear([DURATION_MIN, DURATION_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);

const SWEEP_DURATION_MS = 1000;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

// A one-shot clip-path sweep left to right along the duration axis -- the
// same composite-only technique as intensity-domains-diagram.tsx, chosen
// for the same reason: the content is monotonic in x (duration only moves
// forward), so a single sweep reveals the "no fuel needed" band, then the
// 60-minute line, then both gel markers, in the same order a reader would
// reason through the timeline themselves.
export function FuelingWindowDiagram() {
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
  const noFuelX0 = xScale(DURATION_MIN);
  const noFuelX1 = xScale(NO_FUEL_END);
  const fuelX1 = xScale(DURATION_MAX);

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A 120-minute run's fueling timeline. For the first 60 minutes, little or no carbohydrate is needed. Past the 60-minute mark, the session enters the 60-to-120-minute bracket, where roughly 30 to 60 grams an hour is the target, met here with two 20-to-25-gram gels spaced 30 minutes apart, at minute 60 and minute 90 -- the page's own real cadence for how most runners fuel a race from a gel."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* No-fuel band: under an hour, most runners need little or none */}
            <rect x={noFuelX0} y={PAD_TOP} width={noFuelX1 - noFuelX0} height={48} className="fill-zinc-400 opacity-[0.06] dark:fill-zinc-500" />
            <text x={(noFuelX0 + noFuelX1) / 2} y={PAD_TOP + 18} textAnchor="middle" className="fill-zinc-500 text-[12px] font-semibold dark:fill-zinc-400">
              Little or none needed
            </text>

            {/* Fueling band: 60-120 min, roughly 30-60 g/h */}
            <rect x={noFuelX1} y={PAD_TOP} width={fuelX1 - noFuelX1} height={48} className="fill-[var(--accent-tip)] opacity-[0.08]" />
            <text x={(noFuelX1 + fuelX1) / 2} y={PAD_TOP + 18} textAnchor="middle" className="fill-[var(--accent-tip)] text-[12px] font-semibold">
              Roughly 30&ndash;60 g/h
            </text>

            {/* 60-minute threshold line -- the actual boundary the page draws */}
            <line x1={noFuelX1} y1={PAD_TOP} x2={noFuelX1} y2={TRACK_Y + 14} strokeWidth="1.5" strokeDasharray="4 3" className="stroke-zinc-500 dark:stroke-zinc-400" />

            {/* Timeline track */}
            <line x1={PAD_LEFT} y1={TRACK_Y} x2={PAD_LEFT + PLOT_WIDTH} y2={TRACK_Y} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />

            {/* Start / 60 / end ticks */}
            {[0, 60, 90, 120].map((t) => (
              <g key={t}>
                <line x1={xScale(t)} y1={TRACK_Y - 5} x2={xScale(t)} y2={TRACK_Y + 5} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
                <text x={xScale(t)} y={TRACK_Y + 24} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
                  {t} min
                </text>
              </g>
            ))}

            {/* Gel markers -- 20-25g, every 30 minutes, the page's own quoted cadence */}
            {GEL_TIMES.map((t) => (
              <g key={t}>
                <circle cx={xScale(t)} cy={TRACK_Y} r="7" className="fill-[var(--accent-tip)] stroke-white dark:stroke-zinc-900" strokeWidth="2" />
                <text x={xScale(t)} y={TRACK_Y - 16} textAnchor="middle" className="fill-zinc-700 text-[11px] font-semibold dark:fill-zinc-200">
                  ~20&ndash;25g gel
                </text>
              </g>
            ))}

            <text x={PAD_LEFT + PLOT_WIDTH / 2} y={CHART_HEIGHT - 6} textAnchor="middle" className="fill-zinc-400 text-[10.5px] italic dark:fill-zinc-500">
              one real-world example inside the page&rsquo;s own 60&ndash;120 minute bracket
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          The 60-minute line and the 30&ndash;60 g/h target are the page&rsquo;s own duration brackets; the two gel
          markers use its own quoted cadence (&ldquo;20&ndash;25 grams every 30 minutes from a gel&rdquo;). The page
          gives no rule for a cutoff before the finish, so none is shown here.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the fueling window animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
