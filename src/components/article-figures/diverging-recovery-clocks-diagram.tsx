"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

// Same flatter viewBox convention as the rest of this directory's most
// recent batch (fueling-window-diagram.tsx, carb-ceiling-diagram.tsx).
const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const PAD_LEFT = 16;
const PAD_RIGHT = 56; // extra room for the bone-density row's "and beyond" arrowhead
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const TRACK_X0 = PAD_LEFT;
const TRACK_X1 = PAD_LEFT + PLOT_WIDTH;

// The page's own three-stage recovery timeline, from "The Recovery Timeline
// Doesn't Move at One Speed": energy status recovers within days to weeks,
// menstrual function typically takes months, bone mineral density can lag
// years behind both (2014 Female Athlete Triad Coalition consensus
// statement, as cited on the page). No day/week/month counts are given
// beyond those category words, so the four x-axis positions below are
// evenly spaced category labels, not a true numeric/log scale -- the same
// "illustrative, not measured" convention intensity-domains-diagram.tsx
// uses for its curve shape. Each row's own bar endpoint is a deliberate,
// qualitative placement inside the category its own text names, never a
// specific day count the page doesn't give.
const CATEGORIES = ["Days", "Weeks", "Months", "Years"] as const;
const CATEGORY_X = [0, 1, 2, 3];

function categoryToX(index: number): number {
  return TRACK_X0 + (index / (CATEGORY_X.length - 1)) * PLOT_WIDTH;
}

type ClockRow = {
  label: string;
  endsAt: number; // category-scale position, 0-3, matching the Days-Years ticks
  detail: string;
  colorClass: string;
  // Stagger each row's own grow-in duration so the three clocks visibly
  // move at different speeds -- the animation's duration differences ARE
  // part of what this figure teaches, not just each bar's final length.
  durationMs: number;
  openEnded?: boolean;
};

const ROWS: ClockRow[] = [
  {
    label: "Energy status",
    endsAt: 1,
    detail: "days to weeks",
    colorClass: "fill-[var(--accent-tip)]",
    durationMs: 550,
  },
  {
    label: "Menstrual function",
    endsAt: 2,
    detail: "months",
    colorClass: "fill-[var(--accent-warning)]",
    durationMs: 1050,
  },
  {
    label: "Bone mineral density",
    endsAt: 3,
    detail: "years — can lag behind both",
    colorClass: "fill-[var(--accent-error)]",
    durationMs: 1700,
    openEnded: true,
  },
];

// Pixels the open-ended bone-density bar extends past the "Years" tick,
// to read as "and beyond" via the arrowhead marker rather than a specific
// endpoint the page never gives.
const OPEN_END_OVERSHOOT_PX = 22;

const ROW_Y = [48, 108, 168];
const BAR_HEIGHT = 20;

const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out

// Each bar grows from zero width via a composite-only transform (scaleX
// with transform-box: fill-box), not a width/clip-path sweep -- chosen
// specifically so each row can run its OWN duration (animation-performance:
// transform/opacity only, ref + reflow, not React state driving the
// animation). The three different durations are the whole point: the
// animation itself demonstrates that these three systems recover at
// different speeds, not just the three different final bar lengths.
export function DivergingRecoveryClocksDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<(SVGGElement | null)[]>([]);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  function grow() {
    ROWS.forEach((row, i) => {
      const el = barRefs.current[i];
      if (!el) return;
      el.style.transition = `transform ${row.durationMs}ms ${SWEEP_EASE}`;
      el.style.transform = "scaleX(1)";
    });
  }

  function handleReplay() {
    ROWS.forEach((_, i) => {
      const el = barRefs.current[i];
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = "scaleX(0)";
    });
    // Force a reflow so the reset above paints before the grow transition
    // below starts (same technique as every other figure in this directory).
    barRefs.current[0]?.getBoundingClientRect();
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

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="Three recovery clocks shown on the same days-to-years timeline, each moving at a different speed. Energy status can start recovering within days to weeks of increased intake or reduced training load. Menstrual function typically takes months to normalize even after energy status improves. Bone mineral density can lag years behind both, meaning an athlete can feel and perform better long before the skeleton has actually caught up."
      >
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
          {/* Category axis */}
          <line x1={TRACK_X0} y1={204} x2={TRACK_X1} y2={204} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
          {CATEGORIES.map((cat, i) => (
            <g key={cat}>
              <line x1={categoryToX(i)} y1={199} x2={categoryToX(i)} y2={209} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
              <text x={categoryToX(i)} y={224} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
                {cat}
              </text>
            </g>
          ))}

          {ROWS.map((row, i) => {
            const barX = categoryToX(0);
            const barEndX = categoryToX(row.endsAt);
            const barWidth = barEndX - barX;
            const cy = ROW_Y[i] + BAR_HEIGHT / 2;
            return (
              <g key={row.label}>
                <text x={barX} y={ROW_Y[i] - 10} className="fill-zinc-700 text-[12px] font-semibold dark:fill-zinc-200">
                  {row.label} <tspan className="fill-zinc-500 text-[11px] font-normal dark:fill-zinc-400">({row.detail})</tspan>
                </text>
                {/* Track */}
                <line x1={barX} y1={cy} x2={TRACK_X1} y2={cy} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />
                {/* Animated bar (+ an open-ended arrowhead for bone density):
                    both drawn at full target size once, then the whole
                    group is scaled via transform so the grow-in stays
                    composite-only (animation-performance). An SVG
                    marker-end can't attach to a <rect>, so the arrowhead is
                    its own <polygon>, grouped with the bar rather than
                    attached to it. */}
                <g
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                  style={{
                    transform: staticFallback ? "scaleX(1)" : "scaleX(0)",
                    transformOrigin: "left",
                    transformBox: "fill-box",
                  }}
                >
                  <rect x={barX} y={ROW_Y[i]} width={barWidth} height={BAR_HEIGHT} rx="4" className={row.colorClass} />
                  {row.openEnded ? (
                    <polygon
                      points={`${barEndX},${cy - 7} ${barEndX + OPEN_END_OVERSHOOT_PX},${cy} ${barEndX},${cy + 7}`}
                      className={row.colorClass}
                    />
                  ) : null}
                </g>
              </g>
            );
          })}
        </svg>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Category positions only (Days / Weeks / Months / Years) &mdash; the page gives no specific day counts
          beyond those words. Each bar&rsquo;s own grow-in speed is deliberately different: energy status recovers
          fastest, bone density slowest.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the diverging recovery clocks animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
