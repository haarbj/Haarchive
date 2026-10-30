"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 300;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 40;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// The crossover point itself (~60-65% VO2max) is quoted directly from "The
// Crossover Point" (Achten et al., 2002, cited on the page). The fat/carb
// curve SHAPES are illustrative -- not digitized data -- same convention as
// the approved pilot's lactate curve: what matters is the shape (fat
// declining, carb rising, crossing in the stated band), not any single
// point on it. The page gives NO specific shifted crossover number for a
// fed state, only that fasted fat-burning is "consistently higher" than
// right after a high-carb meal -- so "Fed" scales the fat curve down by a
// fixed, clearly-labeled illustrative amount rather than claiming a new,
// invented crossover percentage.
const INTENSITY_MIN = 0;
const INTENSITY_MAX = 100;
const CROSSOVER = 62; // midpoint of the page's "roughly 60-65%" range
const xScale = scaleLinear([INTENSITY_MIN, INTENSITY_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0, 100], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

function fatPercent(intensity: number, fedPenalty: number): number {
  const t = (intensity - CROSSOVER) / 18;
  const base = 100 / (1 + Math.exp(t));
  return Math.max(0, base - fedPenalty);
}

const SAMPLE_COUNT = 51;
function fatPath(fedPenalty: number): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const intensity = INTENSITY_MIN + i * ((INTENSITY_MAX - INTENSITY_MIN) / (SAMPLE_COUNT - 1));
    const x = xScale(intensity);
    const y = yScale(fatPercent(intensity, fedPenalty));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}
function carbPath(fedPenalty: number): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const intensity = INTENSITY_MIN + i * ((INTENSITY_MAX - INTENSITY_MIN) / (SAMPLE_COUNT - 1));
    const x = xScale(intensity);
    const y = yScale(100 - fatPercent(intensity, fedPenalty));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const SWEEP_DURATION_MS = 1000;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function CrossoverPointDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [fed, setFed] = useState(false);
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
  const fedPenalty = fed ? 15 : 0;

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A chart showing fat's share of fuel declining and carbohydrate's share rising as running intensity climbs from 0 to 100% of VO2max, crossing to carbohydrate-dominant around 60-65% VO2max. A Fed toggle shows fat's contribution shifted down at every intensity, illustrating that fasted fat-burning capacity is consistently higher than right after a high-carbohydrate meal, since elevated insulin suppresses lipolysis."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            <rect x={xScale(60)} y={PAD_TOP} width={xScale(65) - xScale(60)} height={PLOT_HEIGHT} className="fill-[var(--accent-tip)] opacity-[0.1]" />
            <text x={xScale(62.5)} y={PAD_TOP + 14} textAnchor="middle" className="fill-zinc-400 text-[10px] font-semibold uppercase dark:fill-zinc-500">
              crossover
            </text>

            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            {[0, 25, 50, 75, 100].map((t) => (
              <text key={t} x={xScale(t)} y={PAD_TOP + PLOT_HEIGHT + 18} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
                {t}%
              </text>
            ))}
            <text x={PAD_LEFT + PLOT_WIDTH / 2} y={CHART_HEIGHT - 4} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              Intensity (% of VO2max)
            </text>

            <path d={fatPath(fedPenalty)} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-warning)]" strokeLinecap="round" />
            <path d={carbPath(fedPenalty)} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />
            <text x={PAD_LEFT + 4} y={yScale(fatPercent(2, fedPenalty)) - 6} className="fill-[var(--accent-warning)] text-[12px] font-semibold">
              Fat
            </text>
            <text x={PAD_LEFT + 4} y={yScale(100 - fatPercent(2, fedPenalty)) + 16} className="fill-[var(--accent-tip)] text-[12px] font-semibold">
              Carb
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Fasted or fed">
          <button type="button" onClick={() => setFed(false)} className={segmentedButtonClass(!fed)}>
            Fasted
          </button>
          <button type="button" onClick={() => setFed(true)} className={segmentedButtonClass(fed)}>
            Fed
          </button>
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the crossover point animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Illustrative curve shapes; the crossover band is the page&rsquo;s own cited figure. The page gives no exact
        shifted number for &ldquo;Fed,&rdquo; only that fasted fat-burning runs consistently higher &mdash; carbohydrate
        also yields roughly 7% more ATP per liter of oxygen than fat.
      </p>
    </div>
  );
}
