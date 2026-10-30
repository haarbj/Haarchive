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
const STAGES = [
  { label: "Air", x: 50 },
  { label: "Lungs", x: 150 },
  { label: "Hemoglobin", x: 250 },
  { label: "Heart", x: 360 },
  { label: "Arteries", x: 470 },
  { label: "Capillaries", x: 580 },
  { label: "Mitochondria", x: 680 },
];
const NODE_Y = 90;
const NODE_R = 14;

// The three adaptations the page names in the same paragraph ("more
// capillaries, more mitochondria, a larger stroke volume") pinned to the
// stage each one upgrades -- stroke volume is the heart's pumping
// capacity, so it anchors to Heart, not Arteries.
const ADAPTATIONS: { stage: string; text: string }[] = [
  { stage: "Heart", text: "larger stroke volume" },
  { stage: "Capillaries", text: "more capillaries" },
  { stage: "Mitochondria", text: "more mitochondria" },
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
                <text x={s.x} y={NODE_Y - NODE_R - 8} textAnchor="middle" className="fill-zinc-300 text-[12px] font-semibold dark:fill-zinc-200">
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
                  x={stage.x}
                  y={NODE_Y + 24}
                  textAnchor="middle"
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
