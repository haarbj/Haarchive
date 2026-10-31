"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

// Same flatter viewBox + toggle-between-two-views-in-one-viewBox convention
// as cycle-framework-vs-evidence-diagram.tsx (src/components/article-
// figures/cycle-framework-vs-evidence-diagram.tsx) -- switching the toggle
// never changes this figure's own height, so zero attributable layout
// shift either way.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 290;

type View = "myth" | "talk-test";

// Pregnancy and Postpartum Running's own callout text (sections.ts, the
// "A common myth, and what actually matters" callout): "'Keep your heart
// rate under 140 bpm' was widely repeated pregnancy advice for years and
// isn't well supported as a hard ceiling: the more relevant concern is
// sustained time near the top of your effort range, which can bring on
// dizziness from temporarily reduced blood flow, not a specific number."
// The 140 bpm figure is the ONLY number the page gives for the myth view --
// no alternate bpm value for "what actually matters" is invented, since the
// page's own replacement is effort-based (the talk test), not a different
// number.
const MYTH_BPM = 140;
const BPM_MIN = 100;
const BPM_MAX = 180;
const PAD_LEFT = 70;
const PAD_RIGHT = 70;
const AXIS_Y = 150;
const bpmScale = scaleLinear([BPM_MIN, BPM_MAX], [PAD_LEFT, CHART_WIDTH - PAD_RIGHT]);

// The "what actually matters" view has no bpm axis at all -- it's
// deliberately effort-based (the talk test), matching the page's own
// framing that a fixed heart-rate cap is the wrong tool here. 0-100 is an
// illustrative effort scale, same "relative, not measured" convention as
// intensity-domains-diagram.tsx's lactate curve.
const EFFORT_MIN = 0;
const EFFORT_MAX = 100;
const effortScale = scaleLinear([EFFORT_MIN, EFFORT_MAX], [PAD_LEFT, CHART_WIDTH - PAD_RIGHT]);
// The page's own concern is "sustained time near the top of your effort
// range" -- drawn as the top ~22% of the effort scale, not a sharp cutoff,
// since the page gives no precise boundary.
const RISK_ZONE_START = 78;

const SWEEP_DURATION_MS = 900;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

// Short entrance for the panel swapped in on toggle -- same technique and
// same h-full-chain note as cycle-framework-vs-evidence-diagram.tsx's
// PanelEntrance (the wrapper div needs an explicit height class or
// Diagram's `[&_svg]:h-full` rule has nothing real to propagate from,
// which silently clipped content at 390px in the prior batch).
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
  return (
    <div ref={ref} className="h-full w-full">
      {children}
    </div>
  );
}

export function HeartRateMythVsTalkTestDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("myth");
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
  const mythX = bpmScale(MYTH_BPM);
  const riskZoneX = effortScale(RISK_ZONE_START);

  const mythView = (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <text x={CHART_WIDTH / 2} y={20} textAnchor="middle" className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
        Widely repeated pregnancy advice
      </text>
      <text x={CHART_WIDTH / 2} y={36} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
        &ldquo;Keep your heart rate under 140 bpm&rdquo;
      </text>

      {/* One flat cap, applied identically to every runner -- the figure's
          whole point: a single number with no way to account for an
          individual's own fitness or effort. The annotation label sits well
          clear of the subtitle above it (a prior draft overlapped them). */}
      <line x1={PAD_LEFT} y1={AXIS_Y} x2={CHART_WIDTH - PAD_RIGHT} y2={AXIS_Y} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
      {[100, 120, 140, 160, 180].map((tick) => (
        <g key={tick}>
          <line x1={bpmScale(tick)} y1={AXIS_Y} x2={bpmScale(tick)} y2={AXIS_Y + 6} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
          <text x={bpmScale(tick)} y={AXIS_Y + 22} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
            {tick}
          </text>
        </g>
      ))}
      <text x={(PAD_LEFT + CHART_WIDTH - PAD_RIGHT) / 2} y={AXIS_Y + 40} textAnchor="middle" className="fill-zinc-400 text-[10.5px] italic dark:fill-zinc-500">
        heart rate (bpm) &mdash; same scale for every runner
      </text>

      <text x={mythX} y={64} textAnchor="middle" className="fill-zinc-700 text-[13px] font-semibold dark:fill-zinc-200">
        140 bpm
      </text>
      <polygon points={`${mythX - 7},76 ${mythX + 7},76 ${mythX},88`} className="fill-[var(--accent-warning)]" />
      <line x1={mythX} y1={88} x2={mythX} y2={AXIS_Y} strokeWidth="2.5" strokeDasharray="5 4" className="stroke-[var(--accent-warning)]" />

      <g>
        <rect x={64} y={196} width={512} height={62} rx="6" fill="none" strokeWidth="1" strokeDasharray="3 3" className="stroke-zinc-300 dark:stroke-zinc-700" />
        <text x={76} y={216} className="fill-zinc-500 text-[9.5px] font-semibold tracking-wide uppercase dark:fill-zinc-400">
          Not well supported as a hard ceiling
        </text>
        <text x={76} y={231} className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300">
          A single number, applied the same way regardless of a runner&rsquo;s
        </text>
        <text x={76} y={245} className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300">
          own fitness or effort level.
        </text>
      </g>
    </svg>
  );

  const talkTestView = (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <text x={CHART_WIDTH / 2} y={28} textAnchor="middle" className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
        What actually matters
      </text>
      <text x={CHART_WIDTH / 2} y={46} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
        Sustained time near the top of your effort range
      </text>

      {/* Effort gradient bar, comfortable speech through labored speech --
          no bpm anywhere in this view, since the page's replacement for the
          140 cap is effort-based (the talk test), not a different number. */}
      <rect x={PAD_LEFT} y={AXIS_Y - 14} width={CHART_WIDTH - PAD_LEFT - PAD_RIGHT} height={28} rx="6" className="fill-[var(--accent-tip)] opacity-[0.12]" />
      <rect
        x={riskZoneX}
        y={AXIS_Y - 14}
        width={CHART_WIDTH - PAD_RIGHT - riskZoneX}
        height={28}
        rx="6"
        className="fill-[var(--accent-warning)] opacity-[0.22]"
      />
      <line x1={PAD_LEFT} y1={AXIS_Y + 14} x2={CHART_WIDTH - PAD_RIGHT} y2={AXIS_Y + 14} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />

      <text x={PAD_LEFT} y={AXIS_Y + 32} className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
        Can talk easily
      </text>
      <text x={CHART_WIDTH - PAD_RIGHT} y={AXIS_Y + 32} textAnchor="end" className="fill-zinc-600 text-[10.5px] font-semibold dark:fill-zinc-300">
        Can barely talk
      </text>

      <line x1={riskZoneX} y1={AXIS_Y - 26} x2={riskZoneX} y2={AXIS_Y + 14} strokeWidth="1" strokeDasharray="3 3" className="stroke-zinc-400 dark:stroke-zinc-600" />
      <text x={riskZoneX + 8} y={AXIS_Y - 30} className="fill-zinc-500 text-[10px] font-semibold dark:fill-zinc-400">
        Sustained time here
      </text>

      {/* The dizziness mechanism, made visible as the causal chain the page
          itself states, not a new claim: sustained time near the top of
          effort → temporarily reduced blood flow → dizziness. */}
      <g>
        <rect x={64} y={178} width={512} height={82} rx="6" fill="none" strokeWidth="1" strokeDasharray="3 3" className="stroke-zinc-300 dark:stroke-zinc-700" />
        <text x={76} y={198} className="fill-zinc-500 text-[9.5px] font-semibold tracking-wide uppercase dark:fill-zinc-400">
          The real mechanism
        </text>
        <g className="fill-zinc-600 text-[11px] font-semibold dark:fill-zinc-200">
          <text x={76} y={216}>
            Sustained time near top of range
          </text>
          <text x={312} y={216} className="fill-zinc-400 dark:fill-zinc-500">
            &rarr;
          </text>
          <text x={330} y={216}>
            Temporarily reduced blood flow
          </text>
        </g>
        <text x={76} y={234} className="fill-[var(--accent-warning)] text-[11px] font-semibold">
          &rarr; Dizziness risk
        </text>
        <text x={76} y={252} className="fill-zinc-500 text-[10px] dark:fill-zinc-400">
          Not a specific heart-rate number &mdash; use the Talk Test to guide effort instead.
        </text>
      </g>
    </svg>
  );

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt={
          view === "myth"
            ? "A horizontal heart-rate scale from 100 to 180 beats per minute, with a single dashed line marking the widely repeated advice to keep heart rate under 140 bpm during pregnancy. A note explains this fixed number isn't well supported as a hard ceiling, since it's applied the same way regardless of a runner's own fitness or effort level."
            : "An effort-based talk-test scale running from comfortable speech to labored speech, with the top portion of the range highlighted as the real area of concern. A labeled causal chain shows that sustained time near the top of the effort range can temporarily reduce blood flow, which brings on dizziness risk -- not a specific heart-rate number. The guide suggests using the Talk Test to track effort instead."
        }
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <PanelEntrance key={view} animate={!staticFallback && hasPlayedOnce}>
            {view === "myth" ? mythView : talkTestView}
          </PanelEntrance>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="The 140 bpm myth or the talk test">
          <button type="button" onClick={() => setView("myth")} className={segmentedButtonClass(view === "myth")}>
            The 140 bpm myth
          </button>
          <button type="button" onClick={() => setView("talk-test")} className={segmentedButtonClass(view === "talk-test")}>
            What actually matters
          </button>
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the heart rate myth versus talk test animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        The 140 bpm figure is the page&rsquo;s own description of widely repeated advice, not a cited source &mdash;
        the page&rsquo;s own replacement is effort-based (
        <em>A More Precise Way to Find Your Zones: The Talk Test</em> in How to Start Running), not a different
        number.
      </p>
    </div>
  );
}
