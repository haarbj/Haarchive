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
const PAD_TOP = 16;
const PAD_BOTTOM = 40;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// The two pole positions (roughly 65% and 90% of VO2max) and the
// "gravitational trap" framing of the threshold middle are quoted
// directly from "Two Poles, Not a Straight Line" (Research Library,
// Seiler, "Training Intensity Distribution for Endurance Performance,"
// Vienna 2017). The bimodal DENSITY CURVE shape -- how much volume sits at
// each point along the intensity axis -- is illustrative, not digitized
// training-log data, same convention as the approved pilot's lactate
// curve: what matters is two distinct peaks with a real dip between them,
// not any single density value. The page gives no specific number for how
// a "drifted" week's volume redistributes, so the Drift toggle moves
// volume into the middle by a fixed, clearly-labeled illustrative amount
// rather than claiming a measured one.
const POLE_LOW = 65;
const POLE_HIGH = 90;
const INTENSITY_MIN = 40;
const INTENSITY_MAX = 105;
const xScale = scaleLinear([INTENSITY_MIN, INTENSITY_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0, 1], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

function bump(x: number, center: number, width: number, height: number): number {
  const t = (x - center) / width;
  return height * Math.exp(-(t * t));
}

// drift in [0, 1]: 0 = polarized (two sharp poles), 1 = fully drifted
// (volume pulled into a single middle-zone bump instead).
function density(intensity: number, drift: number): number {
  const poleHeight = 1 - 0.75 * drift;
  const middleHeight = 0.85 * drift;
  return (
    bump(intensity, POLE_LOW, 6, poleHeight) +
    bump(intensity, POLE_HIGH, 5, poleHeight * 0.9) +
    bump(intensity, (POLE_LOW + POLE_HIGH) / 2 + 2, 7, middleHeight)
  );
}

const SAMPLE_COUNT = 66;
function densityPath(drift: number): string {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const intensity = INTENSITY_MIN + i * ((INTENSITY_MAX - INTENSITY_MIN) / (SAMPLE_COUNT - 1));
    const x = xScale(intensity);
    const y = yScale(density(intensity, drift));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const SWEEP_DURATION_MS = 1000;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function PolarizedPolesDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [drifted, setDrifted] = useState(false);
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
  const drift = drifted ? 1 : 0;
  const path = densityPath(drift);

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A distribution curve showing training volume concentrated at two poles, roughly 65% and 90% of VO2max, with comparatively little volume in between. A Drift toggle shows an illustrative alternative where volume is pulled into the threshold zone between the poles -- the gravitational trap Seiler's research describes, where threshold-paced running feels productive and sustainable without being either genuinely easy or genuinely hard."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            <rect
              x={xScale((POLE_LOW + POLE_HIGH) / 2 - 10)}
              y={PAD_TOP}
              width={xScale((POLE_LOW + POLE_HIGH) / 2 + 10) - xScale((POLE_LOW + POLE_HIGH) / 2 - 10)}
              height={PLOT_HEIGHT}
              className="fill-[var(--accent-warning)] opacity-[0.08]"
            />
            <text
              x={xScale((POLE_LOW + POLE_HIGH) / 2)}
              y={PAD_TOP + 14}
              textAnchor="middle"
              className="fill-zinc-400 text-[10px] font-semibold uppercase dark:fill-zinc-500"
            >
              the gravitational trap
            </text>

            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            {[40, 65, 90, 105].map((t) => (
              <g key={t}>
                <line x1={xScale(t)} y1={PAD_TOP + PLOT_HEIGHT} x2={xScale(t)} y2={PAD_TOP + PLOT_HEIGHT + 5} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
                <text x={xScale(t)} y={PAD_TOP + PLOT_HEIGHT + 20} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
                  {t}%
                </text>
              </g>
            ))}
            <text x={PAD_LEFT + PLOT_WIDTH / 2} y={CHART_HEIGHT - 4} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              Intensity (% of VO2max)
            </text>

            <path d={path} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />
            <text x={xScale(POLE_LOW)} y={yScale(0.95) - 10} textAnchor="middle" className="fill-[var(--accent-tip)] text-[11px] font-semibold">
              ~65%
            </text>
            <text x={xScale(POLE_HIGH)} y={yScale(0.95) - 10} textAnchor="middle" className="fill-[var(--accent-tip)] text-[11px] font-semibold">
              ~90%
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Polarized week or drifted week">
          <button type="button" onClick={() => setDrifted(false)} className={segmentedButtonClass(!drifted)}>
            Polarized week
          </button>
          <button type="button" onClick={() => setDrifted(true)} className={segmentedButtonClass(drifted)}>
            Drifted week
          </button>
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the polarized poles animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Pole positions (~65% / ~90% VO2max) are the page&rsquo;s own cited figures; the density curve shape and the
        drifted week are illustrative, not measured training-log data.
      </p>
    </div>
  );
}
