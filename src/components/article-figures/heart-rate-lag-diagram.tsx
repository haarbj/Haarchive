"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

// A flatter viewBox than a plain 640x300 would suggest -- see the
// race-pace-curve-diagram.tsx comment above its own CHART_HEIGHT for the
// full reasoning: Diagram's "wide" box's padded content area is narrower
// than 21:9 once the fixed p-4 padding is subtracted at phone width, so a
// 640x300 viewBox overflows vertically there and overflow-hidden crops
// it. 640x230 stays safely inside that padded area at every width this
// site renders at.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Illustrative shapes only -- "Why Heart Rate Misleads on Short, Hard
// Efforts" gives no specific lag duration beyond "a minute or more" and no
// specific interval length beyond "as short as 30-90 seconds," so this
// diagram draws a representative 30-second hard interval (inside that
// stated range) and a first-order-lag heart-rate curve tuned so it is
// still rising when the interval ends, same convention as the pilot's
// lactate curve: the SHAPE (effort already over before heart rate catches
// up) is the real claim, not any single plotted number.
const TIME_MIN = 0;
const TIME_MAX = 120; // seconds
const EFFORT_START = 20;
const EFFORT_END = 50; // a 30s hard interval, inside the page's stated 30-90s range
const xScale = scaleLinear([TIME_MIN, TIME_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0, 100], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

const BASELINE = 18;
const PEAK_EFFORT = 92;
const LAG_TAU = 24; // seconds -- tuned so heart rate takes "a minute or more" to fully settle

function effortAt(t: number): number {
  return t >= EFFORT_START && t <= EFFORT_END ? PEAK_EFFORT : BASELINE;
}

// A simple first-order lag (discretized), not a physiological model --
// it exists only to produce the one shape the page's text describes:
// heart rate still climbing after the effort driving it has already ended.
function heartRateSeries(): number[] {
  const dt = 0.5;
  const steps = Math.round((TIME_MAX - TIME_MIN) / dt);
  const values: number[] = [];
  let hr = BASELINE;
  for (let i = 0; i <= steps; i++) {
    const t = TIME_MIN + i * dt;
    hr += ((effortAt(t) - hr) / LAG_TAU) * dt;
    values.push(hr);
  }
  return values;
}

function heartRatePath(): string {
  const values = heartRateSeries();
  const dt = (TIME_MAX - TIME_MIN) / (values.length - 1);
  return values
    .map((hr, i) => {
      const t = TIME_MIN + i * dt;
      const x = xScale(t);
      const y = yScale(hr);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function effortPath(): string {
  // A sharp step, not a sampled curve -- effort turns on and off
  // instantly, which is the whole point of the contrast with heart rate.
  const points: [number, number][] = [
    [TIME_MIN, BASELINE],
    [EFFORT_START, BASELINE],
    [EFFORT_START, PEAK_EFFORT],
    [EFFORT_END, PEAK_EFFORT],
    [EFFORT_END, BASELINE],
    [TIME_MAX, BASELINE],
  ];
  return points
    .map(([t, v], i) => `${i === 0 ? "M" : "L"}${xScale(t).toFixed(1)},${yScale(v).toFixed(1)}`)
    .join(" ");
}

// Where heart rate is still climbing after the interval has already ended
// -- found from the same series used to draw the curve, not a separate
// invented number.
function hrPeakTime(): number {
  const values = heartRateSeries();
  const dt = (TIME_MAX - TIME_MIN) / (values.length - 1);
  let peakIndex = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[peakIndex]) peakIndex = i;
  }
  return TIME_MIN + peakIndex * dt;
}

const SWEEP_DURATION_MS = 1100;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function HeartRateLagDiagram() {
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
  const hrSeries = heartRateSeries();
  const hrDt = (TIME_MAX - TIME_MIN) / (hrSeries.length - 1);
  const hrAt = (t: number) => hrSeries[Math.round((t - TIME_MIN) / hrDt)];
  const peakTime = hrPeakTime();

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A chart over two minutes showing a sudden step up and back down in running effort during a short, hard interval, against a heart rate curve that rises slowly and is still climbing after the effort has already ended, then falls slowly afterward. The gap between the two illustrates why heart rate lags a sudden change in effort by a minute or more."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            {[0, 30, 60, 90, 120].map((t) => (
              <g key={t}>
                <line x1={xScale(t)} y1={PAD_TOP + PLOT_HEIGHT} x2={xScale(t)} y2={PAD_TOP + PLOT_HEIGHT + 5} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
                <text x={xScale(t)} y={PAD_TOP + PLOT_HEIGHT + 17} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
                  {t}s
                </text>
              </g>
            ))}

            {/* Marker at the end of the interval -- effort has already
                dropped back to baseline, heart rate has not. */}
            <line
              x1={xScale(EFFORT_END)}
              y1={PAD_TOP}
              x2={xScale(EFFORT_END)}
              y2={PAD_TOP + PLOT_HEIGHT}
              strokeWidth="1"
              strokeDasharray="3 3"
              className="stroke-zinc-400 dark:stroke-zinc-500"
            />
            <text x={xScale(EFFORT_END) + 5} y={PAD_TOP + 12} className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
              interval ends
            </text>
            <circle cx={xScale(peakTime)} cy={yScale(hrAt(peakTime))} r="4" className="fill-[var(--accent-tip)]" />
            <text x={xScale(peakTime) + 6} y={PAD_TOP + 28} className="fill-[var(--accent-tip)] text-[10.5px] font-semibold">
              heart rate still climbing
            </text>

            <path d={effortPath()} fill="none" strokeWidth="2" strokeDasharray="5 4" className="stroke-zinc-400 dark:stroke-zinc-600" />
            <text x={xScale(EFFORT_START) + 4} y={yScale(PEAK_EFFORT) - 8} className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
              Effort
            </text>

            <path d={heartRatePath()} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />
            <text x={xScale(100)} y={yScale(hrAt(100)) - 10} className="fill-[var(--accent-tip)] text-[11px] font-semibold">
              Heart rate
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Illustrative curve shapes, not measured data &mdash; the page states heart rate lags a sudden jump in effort
          by &ldquo;a minute or more,&rdquo; which is why it actively misleads on an interval as short as 30&ndash;90
          seconds: the effort is already finishing before heart rate has caught up to reflect it.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the heart rate lag animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
