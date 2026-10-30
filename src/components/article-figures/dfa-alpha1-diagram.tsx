"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

// A flatter viewBox than a plain 640x300 would suggest -- see
// race-pace-curve-diagram.tsx's own comment above its CHART_HEIGHT for
// the full reasoning: Diagram's "wide" box's padded content area is
// narrower than 21:9 once the fixed p-4 padding is subtracted at phone
// width, so a 640x300 viewBox overflows vertically there and
// overflow-hidden crops it. 640x230 stays safely inside that padded area
// at every width this site renders at.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// DFA-alpha1 falls as intensity rises; the page's own cited crossing value
// (0.75) is real: "values above roughly 0.75 correspond to low-intensity,
// comfortably aerobic effort; values at or below 0.75 mark the shift into
// moderate-to-high intensity." The curve SHAPE is illustrative, same
// convention as the pilot. "Fatigued/hot" models the page's own claim
// that cardiac drift, heat, and sleep debt "shift the raw heart-rate-to-
// effort relationship" -- shown by the crossing point moving to a LOWER
// heart rate, while a fixed heart-rate zone boundary (the thing the page
// says "silently goes stale") stays pinned at the same heart rate in both
// states, since it has no way to know the relationship moved.
const HR_MIN = 55;
const HR_MAX = 100;
const THRESHOLD_LINE = 0.75; // the page's own cited DFA-alpha1 crossing value
const xScale = scaleLinear([HR_MIN, HR_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0.4, 1.15], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

const FRESH_CROSSING = 82; // % of max HR where the fresh curve crosses 0.75
const FATIGUED_CROSSING = 70; // the same physiological boundary, now reached sooner
const FIXED_ZONE_BOUNDARY = 82; // a static HR zone cutoff -- doesn't move between states

function dfaAlpha1(hr: number, crossing: number): number {
  const t = (hr - crossing) / 7;
  return 0.4 + 0.75 / (1 + Math.exp(t));
}

const SAMPLE_COUNT = 51;
function curvePath(crossing: number): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const hr = HR_MIN + (i * (HR_MAX - HR_MIN)) / (SAMPLE_COUNT - 1);
    const x = xScale(hr);
    const y = yScale(dfaAlpha1(hr, crossing));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const SWEEP_DURATION_MS = 1000;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function DfaAlpha1Diagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [fatigued, setFatigued] = useState(false);
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
  const crossing = fatigued ? FATIGUED_CROSSING : FRESH_CROSSING;

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A chart showing DFA-alpha1, a heart rate variability measure, declining as heart rate rises, crossing its 0.75 threshold value at a given heart rate when fresh. A Fatigued or hot toggle shows that same physiological crossing point shifting to a lower heart rate, while a fixed heart-rate zone boundary stays pinned at the same heart rate in both states, unable to see that the relationship has moved."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            <line x1={PAD_LEFT} y1={yScale(THRESHOLD_LINE)} x2={PAD_LEFT + PLOT_WIDTH} y2={yScale(THRESHOLD_LINE)} strokeWidth="1" strokeDasharray="4 3" className="stroke-zinc-400 dark:stroke-zinc-500" />
            <text x={PAD_LEFT + 4} y={yScale(THRESHOLD_LINE) - 6} className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
              0.75 (the page&rsquo;s cited crossing value)
            </text>

            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            {/* The last tick (100%) sits at xScale(HR_MAX), which is the
                plot's own right edge -- center-anchoring its label there
                put its right half past the viewBox's right edge (PAD_RIGHT
                is only 12px, less than half the label's own ~32px width),
                and SVG's default overflow:hidden clipped it (confirmed via
                Playwright getBBox at both 390px and 1280px). Right-anchoring
                just that one tick inside the viewBox's right edge fixes it
                without moving the tick mark or any other label. */}
            {[55, 70, 85, 100].map((hr) => (
              <g key={hr}>
                <line x1={xScale(hr)} y1={PAD_TOP + PLOT_HEIGHT} x2={xScale(hr)} y2={PAD_TOP + PLOT_HEIGHT + 5} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
                <text
                  x={hr === HR_MAX ? CHART_WIDTH - 4 : xScale(hr)}
                  y={PAD_TOP + PLOT_HEIGHT + 17}
                  textAnchor={hr === HR_MAX ? "end" : "middle"}
                  className="fill-zinc-500 text-[12px] dark:fill-zinc-400"
                >
                  {hr}%
                </text>
              </g>
            ))}
            <text
              x={14}
              y={PAD_TOP + PLOT_HEIGHT / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${PAD_TOP + PLOT_HEIGHT / 2})`}
              className="fill-zinc-500 text-[12px] dark:fill-zinc-400"
            >
              DFA-alpha1
            </text>

            {/* The fixed heart-rate zone boundary -- pinned at the same
                heart rate regardless of the toggle, since it has no way
                to know the real physiological relationship has moved. */}
            <line
              x1={xScale(FIXED_ZONE_BOUNDARY)}
              y1={PAD_TOP}
              x2={xScale(FIXED_ZONE_BOUNDARY)}
              y2={PAD_TOP + PLOT_HEIGHT}
              strokeWidth="2"
              strokeDasharray="2 3"
              className="stroke-zinc-400 dark:stroke-zinc-600"
            />
            <text x={xScale(FIXED_ZONE_BOUNDARY)} y={PAD_TOP + 14} textAnchor="middle" className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
              fixed HR zone (stale)
            </text>

            <path d={curvePath(crossing)} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />
            <circle cx={xScale(crossing)} cy={yScale(THRESHOLD_LINE)} r="4" className="fill-[var(--accent-tip)]" />
            <text x={xScale(crossing)} y={yScale(THRESHOLD_LINE) + 20} textAnchor="middle" className="fill-[var(--accent-tip)] text-[10.5px] font-semibold">
              {fatigued ? "real threshold, now lower" : "real threshold"}
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Fresh or fatigued and hot">
          <button type="button" onClick={() => setFatigued(false)} className={segmentedButtonClass(!fatigued)}>
            Fresh
          </button>
          <button type="button" onClick={() => setFatigued(true)} className={segmentedButtonClass(fatigued)}>
            Fatigued / hot
          </button>
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the DFA-alpha1 animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Illustrative curve shape; 0.75 is the DFA-alpha1 crossing value the page cites. The page states that cardiac
        drift, heat, and sleep debt shift the real heart-rate-to-effort relationship while a fixed heart-rate zone
        boundary can&rsquo;t see that shift and &ldquo;silently goes stale,&rdquo; which the fixed line above
        illustrates by staying put while the real crossing point moves.
      </p>
    </div>
  );
}
