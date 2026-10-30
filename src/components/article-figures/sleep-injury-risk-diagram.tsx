"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const BASELINE_Y = 190;
const BAR_WIDTH = 72;

// The page's own figures, carried with its own caveat: a guest "cited
// sleep-specific injury-risk figures worth flagging as suggestive rather
// than precisely established, since they weren't tied to a specific study
// in the discussion itself." Both numbers (1.7x, up to 61%) are quoted
// directly; this figure shows DIRECTION, not a precise point estimate --
// every bar below is drawn with a soft, faded top edge and a tilde in its
// label specifically so it never reads as a crisp measured value.
const BARS = [
  { key: "baseline", label: "Well-rested baseline", heightScale: 1, approx: false, colorClass: "fill-zinc-400 dark:fill-zinc-500" },
  { key: "under7", label: "Under 7 hrs/night", heightScale: 1.7, approx: true, valueLabel: "~1.7× risk", colorClass: "fill-[var(--accent-warning)]" },
  { key: "good", label: "Consistently good sleep", heightScale: 0.39, approx: true, valueLabel: "up to ~61% lower", colorClass: "fill-[var(--accent-success)]" },
] as const;

const BASE_BAR_HEIGHT = 80; // pixel height representing the 1.0x baseline
const BAR_X = [60, 240, 420];

const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out

// Each bar grows from its baseline (height 0) via a composite-only
// transform (scaleY, transform-box: fill-box, anchored to the shared
// baseline) -- ref + reflow drives it, not React state
// (animation-performance). All three grow with the same duration here
// (unlike diverging-recovery-clocks-diagram.tsx): the point of THIS figure
// is the direction of each bar relative to baseline, not a race between
// different speeds, so a uniform grow-in keeps the comparison honest.
export function SleepInjuryRiskDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<(SVGGElement | null)[]>([]);
  const labelRefs = useRef<(SVGTextElement | null)[]>([]);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  function grow() {
    barRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transition = `transform 700ms ${SWEEP_EASE} ${i * 100}ms`;
      el.style.transform = "scaleY(1)";
    });
    labelRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transition = `opacity 300ms ease-out ${i * 100 + 500}ms`;
      el.style.opacity = "1";
    });
  }

  function handleReplay() {
    barRefs.current.forEach((el) => {
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = "scaleY(0)";
    });
    labelRefs.current.forEach((el) => {
      if (!el) return;
      el.style.transition = "none";
      el.style.opacity = "0";
    });
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
        alt="A comparison showing the direction, not a precise measurement, of how sleep relates to running injury risk. Against a well-rested baseline, runners sleeping under seven hours a night carry roughly 1.7 times the injury risk; consistently good sleep can cut injury risk by as much as 61%. The page itself calls these multipliers suggestive rather than precisely established, since they weren't tied to a specific study."
      >
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
          {/* Baseline reference line */}
          <line x1={30} y1={BASELINE_Y} x2={CHART_WIDTH - 30} y2={BASELINE_Y} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />

          {BARS.map((bar, i) => {
            const h = BASE_BAR_HEIGHT * bar.heightScale;
            const x = BAR_X[i];
            const topY = BASELINE_Y - h;
            const gradId = `sleep-risk-fade-${bar.key}`;
            return (
              <g key={bar.key}>
                {bar.approx ? (
                  <defs>
                    {/* A soft fade-to-background overlay on the two
                        approximate bars' top edge -- the visual cue that
                        these are suggestive estimates, not crisp measured
                        point values (the page's own caveat, carried into
                        the artwork itself, not just the caption). Stacked
                        OVER a normally-filled solid bar below, rather than
                        replacing the bar's own fill, so the bar color
                        itself still reads correctly (an earlier version of
                        this gradient had no stop-color at all, which
                        silently defaulted to black and made every bar
                        nearly invisible against the figure's own dark
                        background -- caught in this task's own Playwright
                        verification pass). */}
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#09090b" stopOpacity="0.55" />
                      <stop offset="30%" stopColor="#09090b" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                ) : null}
                <g
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                  style={{
                    transform: staticFallback ? "scaleY(1)" : "scaleY(0)",
                    transformOrigin: `${x}px ${BASELINE_Y}px`,
                    transformBox: "view-box",
                  }}
                >
                  <rect x={x - BAR_WIDTH / 2} y={topY} width={BAR_WIDTH} height={h} rx="4" className={bar.colorClass} />
                  {bar.approx ? (
                    <>
                      <rect x={x - BAR_WIDTH / 2} y={topY} width={BAR_WIDTH} height={h} rx="4" fill={`url(#${gradId})`} />
                      <rect
                        x={x - BAR_WIDTH / 2}
                        y={topY}
                        width={BAR_WIDTH}
                        height={h}
                        rx="4"
                        fill="none"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        className="stroke-zinc-400 dark:stroke-zinc-500"
                      />
                    </>
                  ) : null}
                </g>
                {/* Value label lives outside the scaled group (fades in
                    instead of stretching with the bar) so the text never
                    visually distorts during the scaleY grow-in. */}
                <text
                  ref={(el) => {
                    labelRefs.current[i] = el;
                  }}
                  x={x}
                  y={topY - 10}
                  textAnchor="middle"
                  className="fill-zinc-700 text-[12px] font-semibold dark:fill-zinc-200"
                  style={{ opacity: staticFallback ? 1 : 0 }}
                >
                  {"valueLabel" in bar ? bar.valueLabel : "1× (reference)"}
                </text>
                <text x={x} y={BASELINE_Y + 20} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
                  {bar.label}
                </text>
              </g>
            );
          })}
        </svg>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Suggestive, not precisely established &mdash; the page&rsquo;s own caveat, since these multipliers
          weren&rsquo;t tied to a specific study. Dashed outlines and faded tops mark the two non-baseline bars as
          approximate; read the direction, not the exact height.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the sleep and injury risk animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
