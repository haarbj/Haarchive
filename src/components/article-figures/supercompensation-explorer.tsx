"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 280;
const PAD_LEFT = 16;
const PAD_RIGHT = 16;
const PAD_TOP = 20;
const PAD_BOTTOM = 36;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
const BASELINE = 50;

// Illustrative only -- "The Adaptation Curve" (The Aerobic Base) describes
// this mechanism with no specific numbers to plot ("training success =
// moderate stress + adequate rest... push too hard or rest too little and
// the curve never gets the chance to rebound"). The shape is the entire
// point, same convention as the approved pilot's lactate curve: a real
// dip-then-rebound-above-baseline for "moderate stress + adequate rest,"
// and two distinct failure shapes (no rebound at all) for the two named
// failure modes.
const xScale = scaleLinear([0, 100], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0, 100], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

type Mode = "normal" | "too-much-stress" | "too-little-rest";

function curve(mode: Mode, t: number): number {
  if (mode === "normal") {
    if (t < 30) return BASELINE - (15 * t) / 30;
    if (t < 80) return 35 + (25 * (t - 30)) / 50; // rebounds to 60, above baseline
    return 60;
  }
  if (mode === "too-much-stress") {
    if (t < 30) return BASELINE - (35 * t) / 30; // dips much deeper
    return 15 + (25 * (t - 30)) / 70; // only a slow, partial, below-baseline recovery
  }
  // too-little-rest: a second stress lands before the first dip recovers
  if (t < 30) return BASELINE - (15 * t) / 30;
  if (t < 50) return 35 + (10 * (t - 30)) / 20; // recovery begins...
  if (t < 65) return 45 - (20 * (t - 50)) / 15; // ...interrupted by the next session
  return 25 + (10 * (t - 65)) / 35; // ends below baseline, no rebound
}

const SAMPLE_COUNT = 51;
function pathFor(mode: Mode): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const t = (i * 100) / (SAMPLE_COUNT - 1);
    const x = xScale(t);
    const y = yScale(curve(mode, t));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const MODES: { id: Mode; label: string }[] = [
  { id: "normal", label: "Moderate stress + rest" },
  { id: "too-much-stress", label: "Too much stress" },
  { id: "too-little-rest", label: "Too little rest" },
];

const SWEEP_DURATION_MS = 1100;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function SupercompensationExplorer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("normal");
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
  const baselineY = yScale(BASELINE);

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A chart showing fitness dipping after a stress and rebounding above baseline with moderate stress and adequate rest. Switching to 'too much stress' shows a much deeper dip that only partially recovers below baseline. Switching to 'too little rest' shows a second stress landing before the first dip recovers, also ending below baseline. In neither failure mode does the curve rebound above its starting point."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            <line x1={PAD_LEFT} y1={baselineY} x2={PAD_LEFT + PLOT_WIDTH} y2={baselineY} strokeWidth="1.5" strokeDasharray="5 4" className="stroke-zinc-400 dark:stroke-zinc-600" />
            <text x={PAD_LEFT + PLOT_WIDTH} y={baselineY - 8} textAnchor="end" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
              baseline
            </text>

            <path d={pathFor(mode)} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />

            <text x={PAD_LEFT} y={CHART_HEIGHT - 6} className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              Stress
            </text>
            <text x={PAD_LEFT + PLOT_WIDTH} y={CHART_HEIGHT - 6} textAnchor="end" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              Recovery
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Stress and rest scenario">
          {MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)} className={segmentedButtonClass(mode === m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the supercompensation animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Illustrative shape only &mdash; the page describes this mechanism qualitatively, with no stated numbers to plot.
      </p>
    </div>
  );
}
