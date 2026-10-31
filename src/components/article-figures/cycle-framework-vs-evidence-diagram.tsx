"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

// Same flatter viewBox convention as the rest of this directory's most
// recent batch. Both toggled views below render inside this SAME viewBox
// (rather than each sizing itself) specifically so switching views never
// changes the figure's own height -- zero attributable layout shift.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 290;

type View = "model" | "evidence";

// Every attribute below is quoted directly from the page's own opening
// paragraph describing Stacy Sims' two-phase framework (Sims, Roar, 2016):
// "better heat tolerance, easier carbohydrate use, and less muscle
// breakdown in the follicular phase, versus a harder time dissipating
// heat, higher core temperature, greater sodium loss, and faster muscle
// breakdown in the luteal phase, plus a temporary drop in blood plasma
// volume, which reduces the blood's oxygen-carrying capacity to working
// muscle." The follicular and luteal lists are deliberately NOT forced
// into matched pairs -- the page itself doesn't offer a follicular
// counterpart for sodium loss or plasma volume, so none is invented here.
// `lines` pre-wraps anything too long for one line at this column width,
// same technique f665309 used to fix lactate-shuttle-diagram.tsx's
// clipped label, rather than risking it after the fact.
const FOLLICULAR_ROWS: (string | [string, string])[] = [
  "Better heat tolerance",
  "Easier carbohydrate use",
  "Less muscle breakdown",
];
const LUTEAL_ROWS: (string | [string, string])[] = [
  "Harder heat dissipation",
  "Higher core temperature",
  "Greater sodium loss",
  "Faster muscle breakdown",
  ["Plasma volume drop →", "less O2 to muscle"],
];

const ROW_START_Y = 92;
const ROW_GAP = 25;

const SWEEP_DURATION_MS = 900;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

// A small Gaussian sampler for the evidence view's two illustrative
// performance distributions -- same "illustrative curve shape, not
// digitized or measured data" convention as gastric-emptying-explorer.tsx
// and intensity-domains-diagram.tsx. The page gives no effect-size number
// to plot (McNulty et al. found the effect "at most trivial to small and
// inconsistent across studies"), so the two curves are drawn nearly fully
// overlapping on purpose: the near-identical shape IS the finding, not a
// specific point estimate.
function gaussianPath(mean: number, sigma: number, amplitude: number, baseline: number, x0: number, x1: number): string {
  const steps = 48;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + (i / steps) * (x1 - x0);
    const y = baseline - amplitude * Math.exp(-((x - mean) ** 2) / (2 * sigma * sigma));
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

const CURVE_X0 = 70;
const CURVE_X1 = 570;
const CURVE_BASELINE = 190;
// A deliberately small 8px mean offset and near-identical amplitude --
// just enough that two curves are visibly drawn, not one curve twice,
// while still reading as "essentially overlapping," which is the point.
const FOLLICULAR_CURVE = gaussianPath(312, 85, 62, CURVE_BASELINE, CURVE_X0, CURVE_X1);
const LUTEAL_CURVE = gaussianPath(328, 85, 58, CURVE_BASELINE, CURVE_X0, CURVE_X1);

// A short entrance fade for the panel swapped in on toggle (not the first
// scroll-triggered reveal, which uses the clip-path sweep below) -- an
// opacity + scale(0.98) entrance per emil-design-eng ("never animate from
// scale(0)"), driven via ref + a forced reflow on mount, not React state.
// Remounting under a `key={view}` change is what re-triggers this effect
// each time the toggle flips.
function PanelEntrance({ animate, children }: { animate: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!animate) return;
    const el = ref.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.opacity = "0";
    el.style.transform = "scale(0.98)";
    el.getBoundingClientRect(); // force a reflow before the transition below starts
    requestAnimationFrame(() => {
      el.style.transition =
        "opacity 200ms cubic-bezier(0.23, 1, 0.32, 1), transform 200ms cubic-bezier(0.23, 1, 0.32, 1)";
      el.style.opacity = "1";
      el.style.transform = "scale(1)";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once per mount (re-keyed by the caller on view change), not on every render
  }, []);
  // h-full w-full is required here, not decorative -- without it this
  // wrapper's own height falls back to auto, which breaks the h-full
  // chain Diagram's `[&_svg]:h-full` rule depends on to size the <svg>
  // correctly, and the SVG falls back to its own intrinsic height instead
  // (caught in this task's own Playwright verification: a few pixels of
  // the bottom-most content silently clipped against the diagram's own
  // overflow-hidden box at 390px width, even though nothing was outside
  // the viewBox itself).
  return (
    <div ref={ref} className="h-full w-full">
      {children}
    </div>
  );
}

export function CycleFrameworkVsEvidenceDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("model");
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

  function renderRow(row: string | [string, string], x: number, y: number, colorClass: string, markerPoints: string) {
    const key = Array.isArray(row) ? row.join(" ") : row;
    return (
      <g key={key}>
        <polygon points={markerPoints} className={colorClass} transform={`translate(${x}, ${y - 4})`} />
        {Array.isArray(row) ? (
          <>
            <text x={x + 14} y={y - 2} className="fill-zinc-700 text-[11px] dark:fill-zinc-200">
              {row[0]}
            </text>
            <text x={x + 14} y={y + 12} className="fill-zinc-700 text-[11px] dark:fill-zinc-200">
              {row[1]}
            </text>
          </>
        ) : (
          <text x={x + 14} y={y + 4} className="fill-zinc-700 text-[11px] dark:fill-zinc-200">
            {row}
          </text>
        )}
      </g>
    );
  }

  const modelView = (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <text x={CHART_WIDTH / 2} y={22} textAnchor="middle" className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
        As proposed by the two-phase model (Sims, Roar, 2016)
      </text>

      {/* Column headers */}
      <text x={40} y={52} className="fill-[var(--accent-tip)] text-[14px] font-semibold">
        Follicular
      </text>
      <text x={40} y={67} className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
        ~2 weeks, period start to ovulation
      </text>
      <text x={40} y={80} className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
        estrogen &amp; progesterone both low
      </text>

      <text x={340} y={52} className="fill-[var(--accent-warning)] text-[14px] font-semibold">
        Luteal
      </text>
      <text x={340} y={67} className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
        ~2 weeks after ovulation
      </text>
      <text x={340} y={80} className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
        both hormones rise
      </text>

      {/* Divider */}
      <line x1={320} y1={40} x2={320} y2={238} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />

      {FOLLICULAR_ROWS.map((row, i) =>
        renderRow(row, 40, ROW_START_Y + i * ROW_GAP, "fill-[var(--accent-tip)]", "0,8 8,8 4,0"),
      )}
      {LUTEAL_ROWS.map((row, i) =>
        renderRow(row, 340, ROW_START_Y + i * ROW_GAP, "fill-[var(--accent-warning)]", "0,0 8,0 4,8"),
      )}

      {/* The headline case the model itself cites -- explicitly labeled as
          the model's own cited case, never presented as proof (the page's
          own framing: McNulty et al.'s review found the broader phase
          effect at most trivial to small). */}
      <g>
        <rect x={40} y={252} width={560} height="30" rx="6" fill="none" strokeWidth="1" strokeDasharray="3 3" className="stroke-zinc-300 dark:stroke-zinc-700" />
        <text x={52} y={266} className="fill-zinc-500 text-[9.5px] font-semibold tracking-wide uppercase dark:fill-zinc-400">
          The model&rsquo;s own cited case
        </text>
        <text x={52} y={278} className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300">
          Radcliffe&rsquo;s 2002 Chicago Marathon world record, run while menstruating &mdash; not proof.
        </text>
      </g>
    </svg>
  );

  const evidenceView = (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <text x={CHART_WIDTH / 2} y={22} textAnchor="middle" className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
        What a 2020 systematic review &amp; meta-analysis found
      </text>

      {/* Baseline */}
      <line x1={CURVE_X0} y1={CURVE_BASELINE} x2={CURVE_X1} y2={CURVE_BASELINE} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
      <text x={(CURVE_X0 + CURVE_X1) / 2} y={CURVE_BASELINE + 16} textAnchor="middle" className="fill-zinc-400 text-[10.5px] dark:fill-zinc-500">
        performance (illustrative, not plotted study data)
      </text>

      {/* Two nearly-overlapping distributions -- the near-identical shape
          IS the finding (at most trivial to small, inconsistent across
          studies), not a specific plotted effect size. */}
      <path d={FOLLICULAR_CURVE} fill="var(--accent-tip)" opacity="0.18" />
      <path d={FOLLICULAR_CURVE} fill="none" strokeWidth="2" className="stroke-[var(--accent-tip)]" />
      <path d={LUTEAL_CURVE} fill="var(--accent-warning)" opacity="0.18" />
      <path d={LUTEAL_CURVE} fill="none" strokeWidth="2" strokeDasharray="5 4" className="stroke-[var(--accent-warning)]" />

      {/* Legend */}
      <g>
        <line x1={70} y1={56} x2={92} y2={56} strokeWidth="2" className="stroke-[var(--accent-tip)]" />
        <text x={98} y={60} className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300">
          Follicular
        </text>
        <line x1={190} y1={56} x2={212} y2={56} strokeWidth="2" strokeDasharray="5 4" className="stroke-[var(--accent-warning)]" />
        <text x={218} y={60} className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300">
          Luteal
        </text>
      </g>

      <text x={CHART_WIDTH / 2} y={214} textAnchor="middle" className="fill-zinc-700 text-[12px] font-semibold dark:fill-zinc-200">
        Effect: at most trivial to small, inconsistent across studies
      </text>
      <text x={CHART_WIDTH / 2} y={229} textAnchor="middle" className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
        (McNulty et al., Sports Medicine, 2020)
      </text>

      <g>
        <rect x={40} y={248} width={560} height="34" rx="6" className="fill-zinc-50 dark:fill-zinc-900" />
        <text x={CHART_WIDTH / 2} y={263} textAnchor="middle" className="fill-zinc-700 text-[10.5px] font-semibold dark:fill-zinc-200">
          Track your own cycle and response.
        </text>
        <text x={CHART_WIDTH / 2} y={277} textAnchor="middle" className="fill-zinc-500 text-[10px] dark:fill-zinc-400">
          Treat any phase-based adjustment as a personal experiment, not a universal rule.
        </text>
      </g>
    </svg>
  );

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt={
          view === "model"
            ? "The two-phase model's proposed pattern: the follicular phase (roughly the first two weeks of the cycle, both hormones low) is proposed to bring better heat tolerance, easier carbohydrate use, and less muscle breakdown. The luteal phase (roughly the following two weeks, both hormones rising) is proposed to bring harder heat dissipation, higher core temperature, greater sodium loss, faster muscle breakdown, and a temporary plasma-volume drop reducing oxygen delivery to muscle. The model's own cited case is Paula Radcliffe's 2002 Chicago Marathon world record, run while menstruating -- labeled explicitly as the model's own cited case, not proof."
            : "Two nearly fully overlapping illustrative performance distributions for the follicular and luteal phases, showing that a 2020 systematic review and meta-analysis found the phase effect on performance was at most trivial to small and inconsistent across studies. The takeaway: track your own cycle and response, and treat any phase-based adjustment as a personal experiment, not a universal rule."
        }
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <PanelEntrance key={view} animate={!staticFallback && hasPlayedOnce}>
            {view === "model" ? modelView : evidenceView}
          </PanelEntrance>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Framework or evidence">
          <button type="button" onClick={() => setView("model")} className={segmentedButtonClass(view === "model")}>
            The model&rsquo;s claim
          </button>
          <button type="button" onClick={() => setView("evidence")} className={segmentedButtonClass(view === "evidence")}>
            What the evidence found
          </button>
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the framework versus evidence animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        The follicular and luteal attribute lists are quoted directly from the page&rsquo;s own description of the
        model; they&rsquo;re deliberately not forced into matched pairs, since the page doesn&rsquo;t offer a
        follicular counterpart for sodium loss or plasma volume. The evidence view&rsquo;s curves are illustrative,
        not digitized study data &mdash; the near-overlap is the finding, not a specific effect size the page gives.
      </p>
    </div>
  );
}
