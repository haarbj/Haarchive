"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

// Same flatter viewBox convention as the rest of this directory's most
// recent batch -- see race-pace-curve-diagram.tsx's own comment.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const TRACK_X0 = 190;
const TRACK_X1 = 600;
const ROW_Y = { glucoseOnly: 50, oneToOne: 110, twoToOne: 170 };

// The glucose-only ceiling is the page's own quoted number: "Glucose-only
// fueling tends to plateau around 1.0-1.1 g/min of exogenous carbohydrate
// oxidation" (Why Fueling Mixes Glucose and Fructose) -- 1.0-1.1 g/min x 60
// = roughly 60-66 g/h. That conversion (g/min -> g/h) is arithmetic on the
// page's own number, not a new claim. The page states combining glucose
// with fructose "pushes that ceiling higher" via a second transporter
// (GLUT5) but never gives a specific combined ceiling number, so the
// combined bars below are drawn reaching their full target with no capped
// line, never a specific "this is the new ceiling" figure.
const GLUCOSE_ONLY_CEILING = 63; // midpoint of the page's own 60-66 g/h conversion
const SCALE_MAX = 100;
const xScale = scaleLinear([0, SCALE_MAX], [TRACK_X0, TRACK_X1]);

type Target = "under" | "over";

// Two example intakes, both drawn from the page's own text:
// - 40 g/h sits inside the "well under that ceiling" range the page
//   describes ("For most runners well under that ceiling... ratio doesn't
//   matter as much"), and both the 1:1 (table sugar) and 2:1 ratios are
//   named explicitly on the page.
// - 90 g/h sits inside the page's own "90-120 g/h Era" section (Kipchoge
//   reportedly near 100 g/h) -- an intake only reachable past the
//   glucose-only ceiling, which is exactly where the page says the ratio
//   starts to matter.
const TARGET_GH: Record<Target, number> = { under: 40, over: 90 };
const TARGET_LABEL: Record<Target, string> = {
  under: "40 g/h (well under the ceiling)",
  over: "90 g/h (past the glucose-only ceiling)",
};

const SWEEP_DURATION_MS = 1000;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function CarbCeilingDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<Target>("under");
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
  const targetGh = TARGET_GH[target];
  // Glucose-only can never deliver more than the ceiling, regardless of how
  // high the target is set -- the bar clips at the ceiling, it doesn't
  // reach the target past that point.
  const glucoseOnlyDelivered = Math.min(targetGh, GLUCOSE_ONLY_CEILING);
  const isCapped = targetGh > GLUCOSE_ONLY_CEILING;

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A comparison of how much carbohydrate per hour glucose-only fueling, a 1:1 glucose-to-fructose ratio (table sugar), and a 2:1 ratio can each actually deliver, at two example intakes: 40 grams an hour and 90 grams an hour. At 40 g/h, all three reach the target equally, since that's well under the glucose-only ceiling. At 90 g/h, glucose-only is capped at roughly 60 to 66 grams an hour (its own single-transporter limit), while the two combined ratios reach the full 90 because they use a second transporter for fructose."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* Glucose-only ceiling line, always drawn -- the mechanism the
                whole figure hinges on */}
            <line
              x1={xScale(GLUCOSE_ONLY_CEILING)}
              y1={20}
              x2={xScale(GLUCOSE_ONLY_CEILING)}
              y2={200}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              className="stroke-[var(--accent-warning)]"
            />
            <text x={xScale(GLUCOSE_ONLY_CEILING)} y={14} textAnchor="middle" className="fill-[var(--accent-warning)] text-[10.5px] font-semibold">
              ~60&ndash;66 g/h ceiling
            </text>

            {/* Glucose-only row */}
            <g>
              <text x={16} y={ROW_Y.glucoseOnly - 14} className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400">
                Glucose only
              </text>
              <line x1={TRACK_X0} y1={ROW_Y.glucoseOnly} x2={TRACK_X1} y2={ROW_Y.glucoseOnly} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <rect
                x={TRACK_X0}
                y={ROW_Y.glucoseOnly - 8}
                width={xScale(glucoseOnlyDelivered) - TRACK_X0}
                height="16"
                rx="4"
                className={isCapped ? "fill-[var(--accent-warning)]" : "fill-zinc-500 dark:fill-zinc-400"}
                style={{ transition: "width 500ms ease-out" }}
              />
              <text
                x={xScale(glucoseOnlyDelivered) + 8}
                y={ROW_Y.glucoseOnly + 4}
                className="fill-zinc-600 text-[10.5px] font-semibold dark:fill-zinc-300"
                style={{ transition: "x 500ms ease-out" }}
              >
                {isCapped ? "stuck at the ceiling" : `delivers ${glucoseOnlyDelivered} g/h`}
              </text>
            </g>

            {/* 1:1 (table sugar) row */}
            <g>
              <text x={16} y={ROW_Y.oneToOne - 14} className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400">
                1:1 (table sugar)
              </text>
              <line x1={TRACK_X0} y1={ROW_Y.oneToOne} x2={TRACK_X1} y2={ROW_Y.oneToOne} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <rect
                x={TRACK_X0}
                y={ROW_Y.oneToOne - 8}
                width={xScale(targetGh) - TRACK_X0}
                height="16"
                rx="4"
                className="fill-[var(--accent-tip)]"
                style={{ transition: "width 500ms ease-out" }}
              />
              <text x={xScale(targetGh) + 8} y={ROW_Y.oneToOne + 4} className="fill-zinc-600 text-[10.5px] font-semibold dark:fill-zinc-300" style={{ transition: "x 500ms ease-out" }}>
                delivers {targetGh} g/h
              </text>
            </g>

            {/* 2:1 row */}
            <g>
              <text x={16} y={ROW_Y.twoToOne - 14} className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400">
                2:1 glucose:fructose
              </text>
              <line x1={TRACK_X0} y1={ROW_Y.twoToOne} x2={TRACK_X1} y2={ROW_Y.twoToOne} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <rect
                x={TRACK_X0}
                y={ROW_Y.twoToOne - 8}
                width={xScale(targetGh) - TRACK_X0}
                height="16"
                rx="4"
                className="fill-[var(--accent-research)]"
                style={{ transition: "width 500ms ease-out" }}
              />
              <text x={xScale(targetGh) + 8} y={ROW_Y.twoToOne + 4} className="fill-zinc-600 text-[10.5px] font-semibold dark:fill-zinc-300" style={{ transition: "x 500ms ease-out" }}>
                delivers {targetGh} g/h
              </text>
            </g>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Example carbohydrate intake target">
          {(["under", "over"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTarget(t)} className={segmentedButtonClass(target === t)}>
              {TARGET_LABEL[t]}
            </button>
          ))}
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the carb ceiling animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        The ~60&ndash;66 g/h ceiling converts the page&rsquo;s own quoted glucose-only plateau (&ldquo;around 1.0&ndash;1.1
        g/min&rdquo;) to grams per hour. The page never gives a specific ceiling number for the combined ratios, only
        that mixing glucose and fructose &ldquo;pushes that ceiling higher&rdquo; via a second transporter &mdash; so
        neither combined bar is drawn against a capped line.
      </p>
    </div>
  );
}
