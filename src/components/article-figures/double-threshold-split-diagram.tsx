"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 280;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 20;
const PAD_BOTTOM = 40;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Every number quoted directly from "One Long Threshold Session vs. Two
// Shorter Ones" (Research Library, citing Kjøsen Talsnes et al., Frontiers
// in Physiology, 2024): in the single 6x10-minute session, perceived
// effort climbed from Borg 13.4 to 14.8 across the session, alongside a
// ~2.8% heart-rate rise and a 0.41 mmol/L lactate rise in the second half.
// The split protocol (two 3x10 sessions, 6.5 hours apart) is described
// only qualitatively on the page -- "lower heart rate and lower lactate"
// in the evening, "effort stayed flat," "less next-day muscle soreness,"
// "lower resting heart rate" -- with NO specific delta numbers given for
// any of those. Rather than invent magnitudes for the split protocol, it
// is rendered as a quoted checklist, not a second number-bearing chart;
// only the single-session effort line (a real, exact two-point value) is
// drawn as a chart.
const SINGLE_EFFORT = [13.4, 14.8] as const;
const BORG_MIN = 12;
const BORG_MAX = 16;
const xScale = scaleLinear([0, 1], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([BORG_MIN, BORG_MAX], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

const SWEEP_DURATION_MS = 900;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

const SPLIT_CHECKLIST = [
  "Evening session: lower heart rate and lower lactate than the morning session",
  "Perceived effort stayed flat across both sessions",
  "Less next-day muscle soreness than after the single long session",
  "Lower resting heart rate the next morning",
];

export function DoubleThresholdSplitDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [single, setSingle] = useState(true);
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
        alt="A single 6x10-minute threshold session showing perceived effort climbing from Borg 13.4 to 14.8 across the session, alongside a roughly 2.8% heart-rate rise and a 0.41 mmol/L lactate rise in the second half. The alternative, splitting the identical volume into two 3x10-minute sessions 6.5 hours apart, is described as showing a lower-heart-rate and lower-lactate evening session, flat perceived effort across both sessions, less next-day muscle soreness, and a lower resting heart rate the next morning."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          {single ? (
            <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
              <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
              <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
              {[12, 13, 14, 15, 16].map((b) => (
                <text key={b} x={PAD_LEFT - 8} y={yScale(b) + 4} textAnchor="end" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
                  {b}
                </text>
              ))}
              <text x={xScale(0)} y={PAD_TOP + PLOT_HEIGHT + 24} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
                First half
              </text>
              <text x={xScale(1)} y={PAD_TOP + PLOT_HEIGHT + 24} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
                Second half
              </text>
              <line
                x1={xScale(0)}
                y1={yScale(SINGLE_EFFORT[0])}
                x2={xScale(1)}
                y2={yScale(SINGLE_EFFORT[1])}
                strokeWidth="2.5"
                className="stroke-[var(--accent-warning)]"
                strokeLinecap="round"
              />
              <circle cx={xScale(0)} cy={yScale(SINGLE_EFFORT[0])} r="4" className="fill-[var(--accent-warning)]" />
              <circle cx={xScale(1)} cy={yScale(SINGLE_EFFORT[1])} r="4" className="fill-[var(--accent-warning)]" />
              <text x={xScale(0)} y={yScale(SINGLE_EFFORT[0]) - 12} textAnchor="middle" className="fill-[var(--accent-warning)] text-[12px] font-semibold">
                Borg {SINGLE_EFFORT[0]}
              </text>
              <text x={xScale(1)} y={yScale(SINGLE_EFFORT[1]) - 12} textAnchor="middle" className="fill-[var(--accent-warning)] text-[12px] font-semibold">
                Borg {SINGLE_EFFORT[1]}
              </text>
            </svg>
          ) : (
            <div className="flex h-full min-h-[200px] flex-col justify-center gap-3 px-6 py-6">
              {SPLIT_CHECKLIST.map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-[13px] text-zinc-300">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-tip)]" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Single session or split sessions">
          <button type="button" onClick={() => setSingle(true)} className={segmentedButtonClass(single)}>
            Single 6x10
          </button>
          <button type="button" onClick={() => setSingle(false)} className={segmentedButtonClass(!single)}>
            Split 3x10 + 3x10
          </button>
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the double-threshold split animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Identical total workload, Kjøsen Talsnes et al., Frontiers in Physiology, 2024. The split protocol&rsquo;s
        improvements are the page&rsquo;s own qualitative findings &mdash; it gives no specific delta numbers for them.
      </p>
    </div>
  );
}
