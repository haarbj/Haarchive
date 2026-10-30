"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

// Same flatter viewBox convention as the rest of this directory's most
// recent batch -- see race-pace-curve-diagram.tsx's own comment above its
// CHART_HEIGHT for the full root-cause writeup.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;

// The page states plainly that three genuinely different models exist
// (Riegel's power law fit once to world records, this site's statistical
// model fit to a large population of ordinary runners and returning a
// range, and the independently reverse-engineered Tinman curve) and that
// "there's no reason to expect three independent approaches to converge
// on the same number every time." It never runs one example race time
// through all three and reports the three resulting numbers, so this
// diagram deliberately carries NO numeric axis and NO computed values --
// only relative track positions, chosen to make the point/range contrast
// visible without implying a specific, real input/output pair. VDOT is
// explicitly left out: the page treats it as a separate idea that
// established the "one result in, a coherent set of paces out" shape,
// not a fourth model behind this site's own calculators.
const TRACK_X0 = 150;
const TRACK_X1 = 560;
const RIEGEL_X = TRACK_X0 + (TRACK_X1 - TRACK_X0) * 0.34;
const STAT_X0 = TRACK_X0 + (TRACK_X1 - TRACK_X0) * 0.46;
const STAT_X1 = TRACK_X0 + (TRACK_X1 - TRACK_X0) * 0.78;
const TINMAN_X = TRACK_X0 + (TRACK_X1 - TRACK_X0) * 0.62;

const INPUT_X = 60;
const INPUT_Y = 30;
const ROW_Y = { riegel: 78, stat: 128, tinman: 178 };

const SWEEP_DURATION_MS = 1100;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function ThreePredictionModelsDiagram() {
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
        alt="One race result feeds into three genuinely different prediction models. Riegel's power law, fit once to world records, returns a single point prediction. This site's statistical model, fit across a large population of ordinary runners, returns a range instead of one number. The independently reverse-engineered Tinman curve returns its own single point prediction, in a different place than Riegel's. None of the three positions is a real computed number; the diagram only shows that a point estimate and a range are different kinds of answer to the same question."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* Input chip */}
            <rect x={INPUT_X - 50} y={INPUT_Y - 16} width="100" height="32" rx="16" className="fill-zinc-200 dark:fill-zinc-800" />
            <text x={INPUT_X} y={INPUT_Y + 4} textAnchor="middle" className="fill-zinc-700 text-[11px] font-semibold dark:fill-zinc-200">
              One race result
            </text>

            {/* Fan-out connector lines from the input to each row's track start */}
            {[ROW_Y.riegel, ROW_Y.stat, ROW_Y.tinman].map((y) => (
              <path
                key={y}
                d={`M${INPUT_X},${INPUT_Y + 16} C${INPUT_X},${(INPUT_Y + y) / 2} ${TRACK_X0 - 30},${(INPUT_Y + y) / 2} ${TRACK_X0 - 10},${y}`}
                fill="none"
                strokeWidth="1.25"
                className="stroke-zinc-300 dark:stroke-zinc-700"
              />
            ))}

            {/* Riegel: one equation, fit once to world records -- a single point */}
            <g>
              <text x={16} y={ROW_Y.riegel - 14} className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400">
                Riegel (world records)
              </text>
              <line x1={TRACK_X0} y1={ROW_Y.riegel} x2={TRACK_X1} y2={ROW_Y.riegel} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <circle cx={RIEGEL_X} cy={ROW_Y.riegel} r="6" className="fill-[var(--accent-tip)]" />
              <text x={RIEGEL_X} y={ROW_Y.riegel - 14} textAnchor="middle" className="fill-[var(--accent-tip)] text-[10.5px] font-semibold">
                a single number
              </text>
            </g>

            {/* Statistical model: fit across ordinary runners -- returns a range */}
            <g>
              <text x={16} y={ROW_Y.stat - 14} className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400">
                Statistical model (ordinary runners)
              </text>
              <line x1={TRACK_X0} y1={ROW_Y.stat} x2={TRACK_X1} y2={ROW_Y.stat} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <rect x={STAT_X0} y={ROW_Y.stat - 7} width={STAT_X1 - STAT_X0} height="14" rx="7" className="fill-[var(--accent-research)] opacity-[0.7]" />
              <text x={(STAT_X0 + STAT_X1) / 2} y={ROW_Y.stat - 14} textAnchor="middle" className="fill-[var(--accent-research)] text-[10.5px] font-semibold">
                a range, not a point
              </text>
            </g>

            {/* Tinman: independently reverse-engineered -- its own single point */}
            <g>
              <text x={16} y={ROW_Y.tinman - 14} className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400">
                Tinman (reverse-engineered)
              </text>
              <line x1={TRACK_X0} y1={ROW_Y.tinman} x2={TRACK_X1} y2={ROW_Y.tinman} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <circle cx={TINMAN_X} cy={ROW_Y.tinman} r="6" className="fill-[var(--accent-navy)]" />
              <text x={TINMAN_X} y={ROW_Y.tinman - 14} textAnchor="middle" className="fill-[var(--accent-navy)] text-[10.5px] font-semibold">
                a different single number
              </text>
            </g>

            <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 6} textAnchor="middle" className="fill-zinc-400 text-[10px] italic dark:fill-zinc-500">
              illustrative positions -- not a real computed example
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          The page states these three approaches have &ldquo;no reason to expect [to] converge on the same number
          every time&rdquo; and doesn&rsquo;t run one example through all three, so the positions above are
          illustrative only &mdash; the point is point-vs-range, not any specific number.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the three prediction models animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
