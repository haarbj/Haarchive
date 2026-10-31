"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;

// Seven stages, quoted directly from the page's own "Every explanation on
// this page assumes a physical pipeline..." paragraph (Exercise Physiology,
// The Oxygen Delivery Pipeline): lungs -> hemoglobin -> heart -> arteries ->
// capillaries -> muscle fiber -> mitochondria. "Air" is added as the
// obvious entry point the page's own first sentence implies ("Oxygen
// enters through the lungs"); every other stage name is the page's own.
// `anchor`/`dx` let one stage's own node label be nudged independently of
// its node -- added for Mitochondria only: centered on its own node
// (x=680, 40px from the viewBox's right edge at 720), "Mitochondria" (the
// node label itself, never touched by the prior round of label fixes,
// which only right-anchored the ADAPTATIONS text below) measured close
// enough to its own centered half-width that its right edge sat within
// ~1px of the viewBox's own right edge at every width tested (390-1920px
// -- confirmed via Playwright getBoundingClientRect, not getBBox, since
// the margin lives in the SVG's own coordinate space and scales
// proportionally with the responsive container, not a fixed px amount).
// That's well inside a real rendering engine's rounding/hinting error
// bar, so right-anchoring it with real clearance instead of relying on a
// ~1px centered margin is the fix, matching the same right-anchor
// technique already used below for "more mitochondria".
const STAGES: { label: string; x: number; anchor?: "start" | "middle" | "end"; dx?: number }[] = [
  { label: "Air", x: 50 },
  { label: "Lungs", x: 150 },
  { label: "Hemoglobin", x: 250 },
  { label: "Heart", x: 360 },
  { label: "Arteries", x: 470 },
  { label: "Capillaries", x: 580 },
  { label: "Mitochondria", x: 680, anchor: "end", dx: 20 },
];
const NODE_Y = 90;
const NODE_R = 14;

// The three adaptations the page names in the same paragraph ("more
// capillaries, more mitochondria, a larger stroke volume") pinned to the
// stage each one upgrades -- stroke volume is the heart's pumping
// capacity, so it anchors to Heart, not Arteries.
// `anchor`/`dx`/`dy` let one label's position be nudged independently of
// its stage node -- added for Mitochondria only: centered on its own
// stage node (x=680, 40px from the viewBox's right edge at 720), "more
// mitochondria" measures ~125px wide, so a centered anchor put its right
// edge ~22px past the viewBox and SVG's default overflow:hidden clipped
// it (confirmed via Playwright getBBox at both 390px and 1280px widths --
// the same amount either width, since the overflow lives in the SVG's
// own coordinate space, not the responsive container). Right-anchoring it
// just inside the viewBox's own right edge fixes the clip, but on its own
// that shift runs it straight into "more capillaries" (the two labels
// already overlapped by ~25px even before this fix -- the clipped-off
// portion of "more mitochondria" had been silently hiding that overlap).
// Dropping Mitochondria's label to a second row (below the CO2 return
// line and its own caption, which only spans the chart's center) clears
// both the Capillaries row and the CO2 line/caption without moving any
// node, the viewBox, or the other two labels.
// dx was widened from 36 to 20 (more leftward) in the same pass as the
// node-label fix above: the original 36 left only ~4px of clearance to
// the viewBox's right edge, too thin by the same margin-of-error
// reasoning as that fix, and the new value keeps this label's right edge
// aligned under the node label's own new right edge (both now end at
// x=700) rather than picking an unrelated number.
const ADAPTATIONS: { stage: string; text: string; anchor?: "start" | "middle" | "end"; dx?: number; dy?: number }[] = [
  { stage: "Heart", text: "larger stroke volume" },
  { stage: "Capillaries", text: "more capillaries" },
  { stage: "Mitochondria", text: "more mitochondria", anchor: "end", dx: 20, dy: 34 },
];

const SWEEP_DURATION_MS = 1100;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out

// Same ref-driven clip-path sweep as the approved pilot
// (intensity-domains-diagram.tsx): one-shot on scroll-into-view, replayable,
// reduced-motion shows the final state immediately with no Replay control.
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function OxygenDeliveryPipelineDiagram() {
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

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A pipeline diagram showing oxygen flowing from air through the lungs, binding to hemoglobin, pumped by the heart through arteries to capillaries, and into muscle fiber mitochondria, with a return path for carbon dioxide back to the lungs. The heart, capillaries, and mitochondria stages are each labeled with the adaptation aerobic training builds there: a larger stroke volume at the heart, more capillaries at the capillary stage, and more mitochondria at the mitochondria stage."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {/* O2 delivery line */}
            <line
              x1={STAGES[0].x}
              y1={NODE_Y}
              x2={STAGES[STAGES.length - 1].x}
              y2={NODE_Y}
              strokeWidth="2"
              className="stroke-[var(--accent-tip)]"
            />
            {/* CO2 return path, dashed, below */}
            <line
              x1={STAGES[STAGES.length - 1].x}
              y1={NODE_Y + 40}
              x2={STAGES[0].x}
              y2={NODE_Y + 40}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              className="stroke-zinc-400 dark:stroke-zinc-600"
            />
            <text x={CHART_WIDTH / 2} y={NODE_Y + 58} textAnchor="middle" className="fill-zinc-500 text-[12px] dark:fill-zinc-400">
              CO&#8322; return trip
            </text>

            {STAGES.map((s) => (
              <g key={s.label}>
                <circle cx={s.x} cy={NODE_Y} r={NODE_R} className="fill-zinc-950 stroke-[var(--accent-tip)]" strokeWidth="2" />
                <text
                  x={s.x + (s.dx ?? 0)}
                  y={NODE_Y - NODE_R - 8}
                  textAnchor={s.anchor ?? "middle"}
                  className="fill-zinc-300 text-[12px] font-semibold dark:fill-zinc-200"
                >
                  {s.label}
                </text>
              </g>
            ))}

            {ADAPTATIONS.map((a) => {
              const stage = STAGES.find((s) => s.label === a.stage);
              if (!stage) return null;
              return (
                <text
                  key={a.stage}
                  x={stage.x + (a.dx ?? 0)}
                  y={NODE_Y + 24 + (a.dy ?? 0)}
                  textAnchor={a.anchor ?? "middle"}
                  className="fill-[var(--accent-tip)] text-[10.5px] font-semibold tracking-wide uppercase"
                >
                  {a.text}
                </text>
              );
            })}
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          The pipeline and its three named adaptations are quoted directly from this page&rsquo;s own text.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the oxygen delivery pipeline animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
