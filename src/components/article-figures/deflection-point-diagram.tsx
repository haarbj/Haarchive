"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 300;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 40;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Illustrative curve shapes -- "What a Trained Heart Does Differently" (The
// Aerobic Base) describes the deflection-point shift with no specific
// numbers to plot ("a rightward shift in the deflection point... after
// training, a pace that used to tip a runner into that acid spike no
// longer does"). The shift itself (BEFORE_DEFLECTION -> AFTER_DEFLECTION)
// is the entire point, same illustrative-shape convention as the pilot.
const xScale = scaleLinear([0, 100], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0, 100], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);
const BEFORE_DEFLECTION = 55;
const AFTER_DEFLECTION = 72;
const MARKER_INTENSITY = 60; // "a pace that used to tip into the acid spike"

function acidity(intensity: number, deflection: number): number {
  const t = (intensity - deflection) / 9;
  return 15 + 70 / (1 + Math.exp(-t));
}

const SAMPLE_COUNT = 51;
function pathFor(deflection: number): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const intensity = (i * 100) / (SAMPLE_COUNT - 1);
    const x = xScale(intensity);
    const y = yScale(acidity(intensity, deflection));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const SWEEP_DURATION_MS = 1100;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function DeflectionPointDiagram() {
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
  const markerY = yScale(acidity(MARKER_INTENSITY, BEFORE_DEFLECTION));
  const markerYAfter = yScale(acidity(MARKER_INTENSITY, AFTER_DEFLECTION));

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A chart showing blood acidity rising sharply with intensity, with the before-training curve's deflection point sitting at a lower intensity than the after-training curve. A marker shows a pace that used to tip a runner into the acid spike on the before curve now sitting comfortably below the after curve's deflection point."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <text x={PAD_LEFT + PLOT_WIDTH / 2} y={CHART_HEIGHT - 6} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              Intensity
            </text>
            <text
              x={14}
              y={PAD_TOP + PLOT_HEIGHT / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${PAD_TOP + PLOT_HEIGHT / 2})`}
              className="fill-zinc-500 text-[12px] dark:fill-zinc-400"
            >
              Acidity
            </text>

            <path d={pathFor(BEFORE_DEFLECTION)} fill="none" strokeWidth="2" strokeDasharray="5 4" className="stroke-zinc-400 dark:stroke-zinc-600" />
            <text x={xScale(BEFORE_DEFLECTION) - 6} y={yScale(acidity(BEFORE_DEFLECTION, BEFORE_DEFLECTION)) - 10} textAnchor="end" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
              Before training
            </text>

            <path d={pathFor(AFTER_DEFLECTION)} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />
            <text x={xScale(AFTER_DEFLECTION) + 6} y={yScale(acidity(AFTER_DEFLECTION, AFTER_DEFLECTION)) - 10} className="fill-[var(--accent-tip)] text-[11px] font-semibold">
              After training
            </text>

            <line x1={xScale(MARKER_INTENSITY)} y1={PAD_TOP} x2={xScale(MARKER_INTENSITY)} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" strokeDasharray="3 3" className="stroke-zinc-400 dark:stroke-zinc-500" />
            <circle cx={xScale(MARKER_INTENSITY)} cy={markerY} r="4" className="fill-zinc-400 dark:fill-zinc-500" />
            <circle cx={xScale(MARKER_INTENSITY)} cy={markerYAfter} r="4" className="fill-[var(--accent-tip)]" />
            <text x={xScale(MARKER_INTENSITY)} y={PAD_TOP + 12} textAnchor="middle" className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
              same pace
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Illustrative curve shapes; the deflection-point shift is the page&rsquo;s own described mechanism, with no stated numbers to plot.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the deflection point animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
