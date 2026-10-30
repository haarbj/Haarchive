"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

// Same flatter viewBox convention as the rest of this directory's most
// recent batch (diverging-recovery-clocks-diagram.tsx, fueling-window-
// diagram.tsx). PAD_RIGHT is wide enough to hold the male row's
// open-ended arrowhead overshoot without it running into the viewBox's
// own right edge -- the exact mistake f665309 fixed elsewhere in this
// directory.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;
const PAD_LEFT = 16;
const PAD_RIGHT = 56;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const TRACK_X0 = PAD_LEFT;
const TRACK_X1 = PAD_LEFT + PLOT_WIDTH;

// Training Across the Menstrual Cycle's own numbers, from "A few of the
// underlying physiological findings are worth knowing": a roughly
// 30-minute post-exercise refueling window in women before the body
// shifts back toward fat storage, versus a window that "can extend past
// an hour" in men. The page gives no female-specific upper bound beyond
// "roughly 30 minutes" (a closed window) and no male-specific upper bound
// beyond "past an hour" (an open one) -- the two rows below are drawn with
// exactly that asymmetry: the female bar ends at a fixed tick, the male
// bar ends in an open-ended arrowhead past the 60-minute tick, the same
// "and beyond" convention diverging-recovery-clocks-diagram.tsx uses for
// bone density. Axis runs 0-60 only; the male row's arrow overshoots past
// it into PAD_RIGHT rather than extending the scale, since the page never
// gives a specific male endpoint to plot.
const AXIS_MIN = 0;
const AXIS_MAX = 60;
const FEMALE_WINDOW_END = 30;
const xScale = scaleLinear([AXIS_MIN, AXIS_MAX], [TRACK_X0, TRACK_X1]);

// Pixels the open-ended male bar extends past the 60-minute tick, to read
// as "keeps going" via the arrowhead marker rather than a specific
// endpoint the page never gives -- same value and technique as
// diverging-recovery-clocks-diagram.tsx's OPEN_END_OVERSHOOT_PX.
const OPEN_END_OVERSHOOT_PX = 22;

const ROW_Y = { female: 56, male: 118 };
const BAR_HEIGHT = 22;

// The page's own commonly-cited starting ratio: "a 4:1 carbohydrate-to-
// protein recovery ratio is the commonly cited starting point, adjusted
// up in protein if that shift proves relevant to you personally" (Sims,
// Roar, 2016). 4:1 by parts is 80%/20% by share -- arithmetic on the
// page's own ratio, not a new number.
const RATIO_Y = 196;
const RATIO_HEIGHT = 26;
const CARB_SHARE = 4 / 5;

const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out

// Three rows grow via a composite-only transform (scaleX, transform-box:
// fill-box), each its own ref + staggered delay -- ref + reflow drives it,
// not React state (animation-performance). The female window finishes
// first (it's the shorter, closing window); the male window keeps growing
// past it into its open end; the 4:1 ratio bar reveals last, after both
// windows have settled, mirroring the order a reader would reason through
// the figure: first see the two windows differ, then see the practical
// lever (the ratio) that follows from the narrower one.
export function RefuelingWindowComparisonDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const femaleBarRef = useRef<SVGGElement | null>(null);
  const maleBarRef = useRef<SVGGElement | null>(null);
  const carbBarRef = useRef<SVGRectElement | null>(null);
  const proteinBarRef = useRef<SVGRectElement | null>(null);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  function grow() {
    if (femaleBarRef.current) {
      femaleBarRef.current.style.transition = `transform 550ms ${SWEEP_EASE}`;
      femaleBarRef.current.style.transform = "scaleX(1)";
    }
    if (maleBarRef.current) {
      maleBarRef.current.style.transition = `transform 900ms ${SWEEP_EASE}`;
      maleBarRef.current.style.transform = "scaleX(1)";
    }
    if (carbBarRef.current) {
      carbBarRef.current.style.transition = `transform 500ms ${SWEEP_EASE} 950ms`;
      carbBarRef.current.style.transform = "scaleX(1)";
    }
    if (proteinBarRef.current) {
      proteinBarRef.current.style.transition = `transform 500ms ${SWEEP_EASE} 950ms`;
      proteinBarRef.current.style.transform = "scaleX(1)";
    }
  }

  function handleReplay() {
    [femaleBarRef.current, maleBarRef.current].forEach((el) => {
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = "scaleX(0)";
    });
    [carbBarRef.current, proteinBarRef.current].forEach((el) => {
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = "scaleX(0)";
    });
    // Force a reflow so the reset above paints before the grow transition
    // below starts (same technique as every other figure in this directory).
    femaleBarRef.current?.getBoundingClientRect();
    requestAnimationFrame(grow);
  }

  useEffect(() => {
    if (reducedMotion || hasPlayedOnce) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasPlayedOnce(true);
          grow();
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, hasPlayedOnce]);

  const staticFallback = reducedMotion;

  const femaleBarX1 = xScale(FEMALE_WINDOW_END);
  const femaleBarWidth = femaleBarX1 - TRACK_X0;
  const maleBarX1 = xScale(AXIS_MAX);
  const maleBarWidth = maleBarX1 - TRACK_X0;

  const ratioSplitX = TRACK_X0 + CARB_SHARE * (TRACK_X1 - TRACK_X0);
  const carbWidth = ratioSplitX - TRACK_X0;
  const proteinWidth = TRACK_X1 - ratioSplitX;

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A comparison of the post-exercise refueling window in women and men. Women have a narrower window, roughly 30 minutes, before the body shifts back toward fat storage. Men have a window that can extend past an hour. Below both, a 4 to 1 carbohydrate-to-protein ratio is shown as the commonly cited starting point for recovery fueling, adjusted up in protein if that proves personally relevant."
      >
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
          {/* Shared duration axis */}
          <line x1={TRACK_X0} y1={160} x2={TRACK_X1} y2={160} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
          {[0, 15, 30, 45, 60].map((t) => (
            <g key={t}>
              <line x1={xScale(t)} y1={155} x2={xScale(t)} y2={165} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
              <text
                x={t === AXIS_MAX ? xScale(t) + 2 : xScale(t)}
                y={178}
                textAnchor={t === AXIS_MAX ? "start" : "middle"}
                className="fill-zinc-500 text-[11px] dark:fill-zinc-400"
              >
                {t}
              </text>
            </g>
          ))}
          <text x={(TRACK_X0 + TRACK_X1) / 2} y={192} textAnchor="middle" className="fill-zinc-400 text-[10.5px] italic dark:fill-zinc-500">
            minutes after finishing
          </text>

          {/* Female row -- closed at roughly 30 minutes */}
          <text x={TRACK_X0} y={ROW_Y.female - 10} className="fill-zinc-700 text-[12px] font-semibold dark:fill-zinc-200">
            Women{" "}
            <tspan className="fill-zinc-500 text-[11px] font-normal dark:fill-zinc-400">(roughly 30 min)</tspan>
          </text>
          <g
            ref={femaleBarRef}
            style={{
              transform: staticFallback ? "scaleX(1)" : "scaleX(0)",
              transformOrigin: "left",
              transformBox: "fill-box",
            }}
          >
            <rect x={TRACK_X0} y={ROW_Y.female} width={femaleBarWidth} height={BAR_HEIGHT} rx="4" className="fill-[var(--accent-tip)]" />
          </g>
          <text x={femaleBarX1 + 8} y={ROW_Y.female + BAR_HEIGHT / 2 + 4} className="fill-zinc-600 text-[10.5px] font-semibold dark:fill-zinc-300">
            closes &mdash; shifts back toward fat storage
          </text>

          {/* Male row -- open-ended past 60 minutes */}
          <text x={TRACK_X0} y={ROW_Y.male - 10} className="fill-zinc-700 text-[12px] font-semibold dark:fill-zinc-200">
            Men{" "}
            <tspan className="fill-zinc-500 text-[11px] font-normal dark:fill-zinc-400">(can extend past an hour)</tspan>
          </text>
          <g
            ref={maleBarRef}
            style={{
              transform: staticFallback ? "scaleX(1)" : "scaleX(0)",
              transformOrigin: "left",
              transformBox: "fill-box",
            }}
          >
            <rect x={TRACK_X0} y={ROW_Y.male} width={maleBarWidth} height={BAR_HEIGHT} rx="4" className="fill-zinc-400 dark:fill-zinc-500" />
            <polygon
              points={`${maleBarX1},${ROW_Y.male - 7} ${maleBarX1 + OPEN_END_OVERSHOOT_PX},${ROW_Y.male + BAR_HEIGHT / 2} ${maleBarX1},${ROW_Y.male + BAR_HEIGHT + 7}`}
              className="fill-zinc-400 dark:fill-zinc-500"
            />
          </g>

          {/* 4:1 carbohydrate-to-protein ratio */}
          <text x={TRACK_X0} y={RATIO_Y - 10} className="fill-zinc-700 text-[12px] font-semibold dark:fill-zinc-200">
            4:1 recovery ratio{" "}
            <tspan className="fill-zinc-500 text-[11px] font-normal dark:fill-zinc-400">(starting point)</tspan>
          </text>
          <rect
            ref={carbBarRef}
            x={TRACK_X0}
            y={RATIO_Y}
            width={carbWidth}
            height={RATIO_HEIGHT}
            className="fill-[var(--accent-research)]"
            style={{
              transform: staticFallback ? "scaleX(1)" : "scaleX(0)",
              transformOrigin: "left",
              transformBox: "fill-box",
            }}
          />
          <rect
            ref={proteinBarRef}
            x={ratioSplitX}
            y={RATIO_Y}
            width={proteinWidth}
            height={RATIO_HEIGHT}
            className="fill-zinc-300 dark:fill-zinc-700"
            style={{
              transform: staticFallback ? "scaleX(1)" : "scaleX(0)",
              transformOrigin: "left",
              transformBox: "fill-box",
            }}
          />
          <text x={TRACK_X0 + carbWidth / 2} y={RATIO_Y + RATIO_HEIGHT / 2 + 4} textAnchor="middle" className="fill-white text-[11px] font-semibold">
            Carbohydrate (4)
          </text>
          <text x={ratioSplitX + proteinWidth / 2} y={RATIO_Y + RATIO_HEIGHT / 2 + 4} textAnchor="middle" className="fill-zinc-700 text-[11px] font-semibold dark:fill-zinc-200">
            Protein (1)
          </text>
        </svg>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Both window lengths and the 4:1 ratio are the page&rsquo;s own cited figures (Sims, <em>Roar</em>, 2016).
          Neither window has a specific measured endpoint beyond &ldquo;roughly 30 minutes&rdquo; and &ldquo;past
          an hour&rdquo;, so the men&rsquo;s row is drawn open-ended rather than at a specific minute.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the refueling window animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
