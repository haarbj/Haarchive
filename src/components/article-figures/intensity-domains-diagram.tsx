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
const PAD_BOTTOM = 44;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Effort axis: percent of 5K race pace, the proxy the exercise-physiology
// page itself endorses as "tighter and better correlated with the two
// thresholds than VO2 max-based ranges" -- deliberately NOT percent of
// VO2max, which the same page calls out as unreliable because the two
// thresholds "occur at meaningfully different percentages of VO2 max from
// one runner to the next." Plotting against VO2max would visually
// contradict the page's own argument.
const EFFORT_MIN = 50;
const EFFORT_MAX = 105;
const xScale = scaleLinear([EFFORT_MIN, EFFORT_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);

// A relative, illustrative 0-100 "lactate accumulation" value -- not a
// measured unit, same convention as GastricEmptyingExplorer's "relative"
// y-axis. The curve's SHAPE is the point, not any single number on it: it
// must rise continuously and smoothly, with the slope visibly steepening
// through the two threshold bands, never a corner or a jump. That shape is
// what the page's text argues for directly ("the threshold just marks the
// point where production starts outpacing removal... not a change in
// what's actually happening biologically").
const yScale = scaleLinear([0, 100], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);
function lactateCurve(effort: number): number {
  const t = effort - EFFORT_MIN;
  return Math.min(100, 4 + 0.00065 * t * t * t);
}

const SAMPLE_COUNT = 56; // one sample per whole percent from 50-105
function curvePath(): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const effort = EFFORT_MIN + i;
    const x = xScale(effort);
    const y = yScale(lactateCurve(effort));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

// LT1/LT2 proxy ranges, quoted directly from the page's own cited source
// (Davis, Marathon Excellence for Everyone): "roughly 64-93% of 5K pace for
// the first, and roughly 90-100% of 5K pace for the second." Drawn as
// overlapping bands, not sharp lines -- the ranges genuinely overlap
// (90-93%), which is itself part of the page's point that these are proxy
// ranges, not precise cutoffs.
const LT1_RANGE: [number, number] = [64, 93];
const LT2_RANGE: [number, number] = [90, 100];

const DOMAIN_LABELS = [
  { text: "Moderate", x: (EFFORT_MIN + LT1_RANGE[0]) / 2 },
  { text: "Heavy", x: (LT1_RANGE[1] + LT2_RANGE[0]) / 2 },
  { text: "Severe", x: (LT2_RANGE[1] + EFFORT_MAX) / 2 },
];

const SWEEP_DURATION_MS = 900;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out

// The pilot animation for the Physiology domain (see this component's own
// task report for the full selection rationale): a one-shot clip-path
// sweep, left to right, revealing the lactate curve and both threshold
// bands together as effort increases -- chosen over an SVG
// stroke-dashoffset draw because clip-path is composite-only (cheaper) and
// produces the identical visual here, since the curve is monotonic in x
// (animation-performance skill). Triggered once when scrolled into view,
// replayable on demand, and never auto-plays on mount -- the reader
// controls when the explanation runs, not the page.
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function IntensityDomainsDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  // Lazy initializer, not an effect -- same pattern as ui/drawer.tsx's
  // isMobileSheet state (see its own comment): resolves correctly on the
  // very first client render instead of flashing the animated state for
  // one frame before an effect corrects it.
  const [reducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  // Drives clip-path on the ref directly rather than through React state
  // (animation-performance skill: "write to ref.current.style, not
  // state") -- the sweep never needs a re-render, and driving it
  // imperatively is what makes the reset-then-resweep on Replay reliable:
  // forcing a reflow between the two style writes guarantees the browser
  // paints the reset frame before the transition starts, which two nested
  // requestAnimationFrame calls did not reliably do under test.
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
    el.offsetHeight; // eslint-disable-line @typescript-eslint/no-unused-expressions -- force a reflow so the reset above paints before the transition below starts
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

  // Reduced motion: show the fully-revealed, final state immediately --
  // same markup, no clip-path transition, no Replay control (there is
  // nothing to replay). This is the static fallback; it communicates the
  // identical curve, bands, and domain labels as the animated version.
  const staticFallback = reducedMotion;

  const path = curvePath();
  const lt1X0 = xScale(LT1_RANGE[0]);
  const lt1X1 = xScale(LT1_RANGE[1]);
  const lt2X0 = xScale(LT2_RANGE[0]);
  const lt2X1 = xScale(LT2_RANGE[1]);

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A curve showing lactate accumulation rising continuously and smoothly as running effort increases from 50% to 105% of 5K race pace, with no sharp jump at either threshold. The moderate domain sits below the first lactate threshold's proxy range (roughly 64-93% of 5K pace), the heavy domain between the first and second threshold proxy ranges, and the severe domain above the second threshold's proxy range (roughly 90-100% of 5K pace). The two ranges overlap, showing these are proxy estimates, not precise cutoffs."
      >
        <div
          ref={sweepRef}
          className="h-full w-full"
          style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}
        >
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* Threshold proxy bands -- same low-alpha, non-traffic-light
                palette convention as GastricEmptyingExplorer's zone bands. */}
            <rect x={lt1X0} y={PAD_TOP} width={lt1X1 - lt1X0} height={PLOT_HEIGHT} className="fill-[var(--accent-tip)] opacity-[0.08]" />
            <rect x={lt2X0} y={PAD_TOP} width={lt2X1 - lt2X0} height={PLOT_HEIGHT} className="fill-[var(--accent-warning)] opacity-[0.1]" />

            {/* Axes */}
            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />

            {[50, 65, 80, 95, 105].map((tick) => (
              <g key={tick}>
                <line x1={xScale(tick)} y1={PAD_TOP + PLOT_HEIGHT} x2={xScale(tick)} y2={PAD_TOP + PLOT_HEIGHT + 5} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
                <text x={xScale(tick)} y={PAD_TOP + PLOT_HEIGHT + 20} textAnchor="middle" className="fill-zinc-500 text-[14px] dark:fill-zinc-400">
                  {tick}%
                </text>
              </g>
            ))}
            <text x={PAD_LEFT + PLOT_WIDTH / 2} y={CHART_HEIGHT - 2} textAnchor="middle" className="fill-zinc-500 text-[13px] dark:fill-zinc-400">
              Effort (% of 5K race pace)
            </text>
            <text
              x={14}
              y={PAD_TOP + PLOT_HEIGHT / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${PAD_TOP + PLOT_HEIGHT / 2})`}
              className="fill-zinc-500 text-[13px] dark:fill-zinc-400"
            >
              Lactate (relative)
            </text>

            {/* Domain labels -- part of the same artwork as the curve, so
                the single clip-path sweep reveals each one as it passes
                that region left to right (Moderate, then Heavy, then
                Severe), instead of a second, separately-timed animation. */}
            {DOMAIN_LABELS.map((d) => (
              <text
                key={d.text}
                x={xScale(d.x)}
                y={PAD_TOP + 14}
                textAnchor="middle"
                className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500"
              >
                {d.text}
              </text>
            ))}

            {/* The curve */}
            <path d={path} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Illustrative curve shape, not measured data &mdash; LT1/LT2 ranges from Davis,{" "}
          <em>Marathon Excellence for Everyone</em>.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the intensity domains animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
