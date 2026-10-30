"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

// Same flatter viewBox convention as the rest of this directory's most
// recent batch -- see race-pace-curve-diagram.tsx's own comment above its
// CHART_HEIGHT for the full root-cause writeup.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const TRACK_X0 = 190;
const TRACK_X1 = 600;
const TRACK_CENTER = (TRACK_X0 + TRACK_X1) / 2;
const ROW_Y = { riegel: 64, stat: 120, tinman: 176 };

type Gap = "close" | "moderate" | "far";

// Only the statistical model's row actually changes with the selected
// gap, and only its WIDTH -- illustrating the page's own claim that "the
// statistical model's own accuracy is better expressed by the width of
// its percentile range" than by a single error number, and the page's
// general point (made explicitly about VDOT, but true of any single-point
// extrapolation) that a prediction gets less certain the further apart
// the known and target distances are. No specific width number is ever
// claimed to be real; the three widths below are illustrative only.
const STAT_HALF_WIDTH: Record<Gap, number> = {
  close: 26,
  moderate: 60,
  far: 110,
};

const GAP_LABEL: Record<Gap, string> = {
  close: "Close (e.g. 5K → 10K)",
  moderate: "Moderate (e.g. 5K → half)",
  far: "Far (e.g. mile → marathon)",
};

const SWEEP_DURATION_MS = 1000;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function PredictionErrorWideningDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [gap, setGap] = useState<Gap>("close");
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
  const half = STAT_HALF_WIDTH[gap];

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="Three models' predictions as the gap between a known race result and a target distance grows from close to far. The statistical model's own percentile range visibly widens as the gap grows, illustrating that its range width is itself an honest expression of rising uncertainty. Riegel's formula has no published accuracy figure on this site at any gap, since it was fit once to world records and never validated here against ordinary runners. The Tinman curve's own validation (median error under 0.2 seconds, worst case about one second, across roughly 3,400 predictions from 100 meters to the marathon) stays the same regardless of the selected gap, since that validation was never measured as a function of distance gap in the first place."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* Riegel: no published accuracy figure here at all, at any gap --
                shown as a flat hatched "unknown" band, not a curve. */}
            <g>
              <text x={16} y={ROW_Y.riegel - 16} className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400">
                Riegel (world records)
              </text>
              <line x1={TRACK_X0} y1={ROW_Y.riegel} x2={TRACK_X1} y2={ROW_Y.riegel} strokeWidth="1" strokeDasharray="2 4" className="stroke-zinc-300 dark:stroke-zinc-700" />
              <text x={TRACK_CENTER} y={ROW_Y.riegel - 2} textAnchor="middle" className="fill-zinc-400 text-[10.5px] italic dark:fill-zinc-500">
                no published accuracy figure here, at any gap
              </text>
            </g>

            {/* Statistical model: range width grows with the selected gap */}
            <g>
              <text x={16} y={ROW_Y.stat - 16} className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400">
                Statistical model (ordinary runners)
              </text>
              <line x1={TRACK_X0} y1={ROW_Y.stat} x2={TRACK_X1} y2={ROW_Y.stat} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <rect
                x={TRACK_CENTER - half}
                y={ROW_Y.stat - 9}
                width={half * 2}
                height="18"
                rx="9"
                className="fill-[var(--accent-research)] opacity-[0.7]"
                style={{ transition: "x 500ms ease-out, width 500ms ease-out" }}
              />
              <text x={TRACK_CENTER} y={ROW_Y.stat - 2} textAnchor="middle" className="fill-white text-[10px] font-semibold">
                range width = its own accuracy statement
              </text>
            </g>

            {/* Tinman: fixed, real validated figures -- not gap-dependent */}
            <g>
              <text x={16} y={ROW_Y.tinman - 16} className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400">
                Tinman (reverse-engineered)
              </text>
              <line x1={TRACK_X0} y1={ROW_Y.tinman} x2={TRACK_X1} y2={ROW_Y.tinman} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <rect x={TRACK_CENTER - 16} y={ROW_Y.tinman - 7} width="32" height="14" rx="7" className="fill-[var(--accent-navy)]" />
              <text x={TRACK_CENTER} y={ROW_Y.tinman - 2} textAnchor="middle" className="fill-zinc-500 text-[10px] dark:fill-zinc-400">
                validated 100m&ndash;marathon, median &lt;0.2s &mdash; not measured by gap size
              </text>
            </g>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Gap between known result and target distance">
          {(["close", "moderate", "far"] as const).map((g) => (
            <button key={g} type="button" onClick={() => setGap(g)} className={segmentedButtonClass(gap === g)}>
              {GAP_LABEL[g]}
            </button>
          ))}
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the prediction error widening animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        The statistical model&rsquo;s widening range is illustrative, not measured width data. Riegel and Tinman
        don&rsquo;t have a gap-dependent error figure on this page at all &mdash; Riegel was never validated here
        against ordinary runners, and Tinman&rsquo;s real validation (median error under 0.2s, worst case about 1s,
        across roughly 3,400 predictions spanning 100m to the marathon) was measured against its own source tool,
        not as a function of distance gap.
      </p>
    </div>
  );
}
