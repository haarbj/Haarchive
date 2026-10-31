"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

// Same flatter viewBox + toggle-between-two-views-in-one-viewBox convention
// as heart-rate-myth-vs-talk-test-diagram.tsx and cycle-framework-vs-
// evidence-diagram.tsx -- switching the toggle never changes this figure's
// own height.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 290;

type View = "supine" | "side-lying";

// Pregnancy and Postpartum Running's own list item (sections.ts): "After
// roughly 15-16 weeks, avoid extended time flat on your back: a growing
// uterus can compress a major vein (the vena cava) and disrupt blood flow;
// swap supine core work for standing or side-lying alternatives." Every
// number and claim below traces to that one sentence -- no additional
// anatomy or timeline is invented.
const CENTER_X = 180;
const TUBE_TOP = 70;
const TUBE_BOTTOM = 195;
const PINCH_TOP = 96;
const PINCH_BOTTOM = 164;
const PINCH_MID = (PINCH_TOP + PINCH_BOTTOM) / 2;
const HALF_WIDTH = 16;
const HALF_WIDTH_PINCHED = 4;

// The pinched vena cava outline: a closed path that narrows from the
// normal 32px-wide vessel down to 8px between PINCH_TOP and PINCH_BOTTOM,
// where the uterus (drawn on top of it in the supine view) presses on it --
// an illustrative schematic, not literal anatomy, matching this site's
// "thin line art, no anatomical realism" diagram convention (CLAUDE.md §3).
const PINCHED_TUBE_PATH = `M ${CENTER_X - HALF_WIDTH},${TUBE_TOP} L ${CENTER_X - HALF_WIDTH},${PINCH_TOP} C ${CENTER_X - HALF_WIDTH},${PINCH_TOP + 14} ${CENTER_X - HALF_WIDTH_PINCHED},${PINCH_MID - 14} ${CENTER_X - HALF_WIDTH_PINCHED},${PINCH_MID} C ${CENTER_X - HALF_WIDTH_PINCHED},${PINCH_MID + 14} ${CENTER_X - HALF_WIDTH},${PINCH_BOTTOM - 14} ${CENTER_X - HALF_WIDTH},${PINCH_BOTTOM} L ${CENTER_X - HALF_WIDTH},${TUBE_BOTTOM} L ${CENTER_X + HALF_WIDTH},${TUBE_BOTTOM} L ${CENTER_X + HALF_WIDTH},${PINCH_BOTTOM} C ${CENTER_X + HALF_WIDTH},${PINCH_BOTTOM - 14} ${CENTER_X + HALF_WIDTH_PINCHED},${PINCH_MID + 14} ${CENTER_X + HALF_WIDTH_PINCHED},${PINCH_MID} C ${CENTER_X + HALF_WIDTH_PINCHED},${PINCH_MID - 14} ${CENTER_X + HALF_WIDTH},${PINCH_TOP + 14} ${CENTER_X + HALF_WIDTH},${PINCH_TOP} L ${CENTER_X + HALF_WIDTH},${TUBE_TOP} Z`;

const UTERUS_RADIUS = 34;
const SUPINE_UTERUS_CX = CENTER_X;
const SIDE_LYING_UTERUS_CX = 280;
const UTERUS_CY = PINCH_MID;

const SWEEP_DURATION_MS = 900;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

// Same panel-swap entrance as the other two figures in this batch -- the
// h-full wrapper is required, not decorative (see those files' own comment
// on Diagram's `[&_svg]:h-full` rule and the 390px clipping it silently
// causes without it).
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

export function VenaCavaCompressionDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("supine");
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
  const isSupine = view === "supine";
  const uterusCx = isSupine ? SUPINE_UTERUS_CX : SIDE_LYING_UTERUS_CX;

  const callout = isSupine
    ? {
        heading: "Uterus compresses the vessel",
        line1: "Uterus presses on the vena cava",
        line2: "→ blood flow back to the heart is disrupted",
        tone: "var(--accent-warning)",
      }
    : {
        heading: "Vessel stays open",
        line1: "Uterus no longer rests on the vessel",
        line2: "→ blood flow is unaffected",
        tone: "var(--accent-tip)",
      };

  const diagramView = (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <text x={CHART_WIDTH / 2} y={28} textAnchor="middle" className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
        {isSupine ? "Lying flat on your back (after roughly 15–16 weeks)" : "Side-lying or standing"}
      </text>
      <text x={CHART_WIDTH / 2} y={46} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
        {isSupine ? "Avoid extended time here — swap supine core work out" : "Swap supine core work in for this instead"}
      </text>

      {/* "To heart" arrow above the vessel */}
      <polygon points={`${CENTER_X - 7},58 ${CENTER_X + 7},58 ${CENTER_X},46`} className="fill-zinc-400 dark:fill-zinc-500" />
      <text x={CENTER_X + 14} y={55} className="fill-zinc-500 text-[10px] dark:fill-zinc-400">
        to heart
      </text>

      {/* The vessel itself -- a plain rounded tube when open, pinched in
          the middle when the uterus (drawn on top of it) presses on it. */}
      {isSupine ? (
        <path d={PINCHED_TUBE_PATH} fill="none" strokeWidth="2" className="stroke-[var(--accent-warning)]" />
      ) : (
        <rect
          x={CENTER_X - HALF_WIDTH}
          y={TUBE_TOP}
          width={HALF_WIDTH * 2}
          height={TUBE_BOTTOM - TUBE_TOP}
          fill="none"
          strokeWidth="2"
          className="stroke-[var(--accent-tip)]"
        />
      )}
      <text x={CENTER_X} y={TUBE_BOTTOM + 18} textAnchor="middle" className="fill-zinc-500 text-[10px] italic dark:fill-zinc-500">
        vena cava
      </text>
      <text x={CENTER_X} y={TUBE_BOTTOM + 34} textAnchor="middle" className="fill-zinc-400 text-[9.5px] dark:fill-zinc-600">
        from lower body
      </text>

      {/* The uterus -- resting on the vessel in the supine view, shifted
          clear of it in the side-lying view. Low-alpha fill, same
          non-anatomical-realism convention as the rest of this diagram. */}
      <circle
        cx={uterusCx}
        cy={UTERUS_CY}
        r={UTERUS_RADIUS}
        className={isSupine ? "fill-[var(--accent-warning)] opacity-[0.16]" : "fill-[var(--accent-tip)] opacity-[0.12]"}
        strokeWidth="1.5"
        stroke={isSupine ? "var(--accent-warning)" : "var(--accent-tip)"}
        style={{ transition: "cx 500ms cubic-bezier(0.23, 1, 0.32, 1)" }}
      />
      <text
        x={uterusCx}
        y={UTERUS_CY + 4}
        textAnchor="middle"
        className="fill-zinc-600 text-[10px] font-semibold dark:fill-zinc-300"
      >
        uterus
      </text>

      {/* Mechanism callout */}
      <g>
        <rect x={360} y={78} width={240} height={110} rx="6" fill="none" strokeWidth="1" strokeDasharray="3 3" className="stroke-zinc-300 dark:stroke-zinc-700" />
        <text x={372} y={98} className="fill-zinc-500 text-[9.5px] font-semibold tracking-wide uppercase dark:fill-zinc-400">
          {callout.heading}
        </text>
        <text x={372} y={118} className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300">
          {callout.line1}
        </text>
        <text x={372} y={134} className="text-[10.5px] font-semibold" fill={callout.tone}>
          {callout.line2}
        </text>
      </g>

      {/* The page's own actionable fix, shown regardless of which toggle
          view is active so it reads as the takeaway, not a per-view note. */}
      <g>
        <rect x={40} y={232} width={560} height={40} rx="6" className="fill-zinc-50 dark:fill-zinc-900" />
        <text x={CHART_WIDTH / 2} y={248} textAnchor="middle" className="fill-zinc-700 text-[10.5px] font-semibold dark:fill-zinc-200">
          Swap supine core work for standing or side-lying alternatives.
        </text>
        <text x={CHART_WIDTH / 2} y={262} textAnchor="middle" className="fill-zinc-500 text-[10px] dark:fill-zinc-400">
          Roughly 15–16 weeks is when this starts to matter, not a precise cutoff.
        </text>
      </g>
    </svg>
  );

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt={
          isSupine
            ? "A schematic showing a growing uterus pressing on the vena cava while lying flat on the back after roughly 15 to 16 weeks of pregnancy, narrowing the vessel and disrupting blood flow back to the heart. The guidance is to swap supine core work for standing or side-lying alternatives."
            : "The same schematic showing the vena cava fully open once the uterus is no longer resting on it, in a side-lying or standing position, so blood flow back to the heart is unaffected."
        }
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <PanelEntrance key={view} animate={!staticFallback && hasPlayedOnce}>
            {diagramView}
          </PanelEntrance>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lying on your back or side-lying and standing">
          <button type="button" onClick={() => setView("supine")} className={segmentedButtonClass(view === "supine")}>
            Lying on your back
          </button>
          <button type="button" onClick={() => setView("side-lying")} className={segmentedButtonClass(view === "side-lying")}>
            Side-lying or standing
          </button>
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the vena cava compression animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        An illustrative schematic, not literal anatomy &mdash; the vena cava compression mechanism and the roughly
        15–16 week timing are the page&rsquo;s own text.
      </p>
    </div>
  );
}
