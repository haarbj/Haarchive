"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;
const PAD_LEFT = 46;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 40;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Every number is sourced from "Gut Training Is a Real, Trainable Skill"
// and its own "Before Your Next Long Run" callout:
// - Session 1 starts at 30 g/h -- the callout's own worked example
//   ("If you're currently taking 30 g/h...").
// - Session 2 is 42.5 g/h -- the midpoint of that same callout's explicit
//   next step ("plan for 40-45 g/h on your next long run").
// - The list's own rule for every step after that is a range, not a fixed
//   number ("Add roughly 5-15 g/h every few key sessions, not all at
//   once"), so sessions 3-6 each step up by 10 g/h -- the midpoint of that
//   5-15 g/h range -- labeled explicitly as a representative step, not a
//   specific sourced number the way sessions 1-2 are.
// - The shaded goal band (60-90 g/h) is the page's own duration bracket
//   for a 2-3 hour effort ("2-3 hours moves that up to roughly 60-90 grams
//   an hour"), shown here as a realistic destination this progression is
//   building toward, not a claim that every runner's gut training ends
//   there.
const SESSIONS = [
  { session: 1, gh: 30, sourced: true, label: "current comfortable intake" },
  { session: 2, gh: 42.5, sourced: true, label: "40–45 g/h (the next test)" },
  { session: 3, gh: 52.5, sourced: false, label: "+10 g/h" },
  { session: 4, gh: 62.5, sourced: false, label: "+10 g/h" },
  { session: 5, gh: 72.5, sourced: false, label: "+10 g/h" },
  { session: 6, gh: 82.5, sourced: false, label: "+10 g/h" },
];

const GOAL_BAND: [number, number] = [60, 90];

const xScale = scaleLinear([0.5, SESSIONS.length + 0.5], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
const yScale = scaleLinear([0, 95], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);
const BAR_WIDTH = 34;

const SWEEP_DURATION_MS = 1100;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

// Gut training is a progression over several sessions, not a single
// before/after -- so this figure is a stepped bar chart swept left to
// right, same clip-path technique as the rest of this batch, rather than
// a two-state comparison card.
export function GutTrainingProgressionDiagram() {
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
  const goalY0 = yScale(GOAL_BAND[1]);
  const goalY1 = yScale(GOAL_BAND[0]);

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A stepped progression across six key long runs, starting at a 30 grams-per-hour comfortable baseline, testing 40 to 45 grams an hour on the next one, then increasing by roughly 10 grams an hour -- the midpoint of the page's own 5-to-15-gram range -- every few sessions after that, climbing toward the 60-to-90 grams-an-hour range the page cites for a 2-to-3-hour effort."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* Goal band: the page's own 2-3 hour, 60-90 g/h bracket */}
            <rect x={PAD_LEFT} y={goalY0} width={PLOT_WIDTH} height={goalY1 - goalY0} className="fill-[var(--accent-success)] opacity-[0.08]" />
            <text x={PAD_LEFT + PLOT_WIDTH - 4} y={goalY0 + 13} textAnchor="end" className="fill-[var(--accent-success)] text-[10.5px] font-semibold">
              60&ndash;90 g/h (2&ndash;3 hr bracket)
            </text>

            {/* Axes */}
            <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <text
              x={16}
              y={PAD_TOP + PLOT_HEIGHT / 2}
              textAnchor="middle"
              transform={`rotate(-90 16 ${PAD_TOP + PLOT_HEIGHT / 2})`}
              className="fill-zinc-500 text-[12px] dark:fill-zinc-400"
            >
              g/h
            </text>

            {/* Bars */}
            {SESSIONS.map((s) => {
              const x = xScale(s.session) - BAR_WIDTH / 2;
              const y = yScale(s.gh);
              const height = PAD_TOP + PLOT_HEIGHT - y;
              return (
                <g key={s.session}>
                  <rect
                    x={x}
                    y={y}
                    width={BAR_WIDTH}
                    height={height}
                    rx="4"
                    className={s.sourced ? "fill-[var(--accent-tip)]" : "fill-[var(--accent-tip)] opacity-[0.55]"}
                  />
                  <text x={x + BAR_WIDTH / 2} y={y - 8} textAnchor="middle" className="fill-zinc-700 text-[11px] font-semibold dark:fill-zinc-200">
                    {s.gh % 1 === 0 ? s.gh : s.gh.toFixed(1)}
                  </text>
                  <text x={x + BAR_WIDTH / 2} y={PAD_TOP + PLOT_HEIGHT + 18} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
                    #{s.session}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Sessions 1&ndash;2 are the page&rsquo;s own worked example (30 g/h, then testing 40&ndash;45 g/h). Sessions
          3&ndash;6 apply its &ldquo;add roughly 5&ndash;15 g/h every few key sessions&rdquo; rule at the 10 g/h
          midpoint &mdash; a representative step, not a specific number the page states.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the gut training progression animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
