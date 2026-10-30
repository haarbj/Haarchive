"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 560;
const CHART_HEIGHT = 260;
const FIBER_R = 26;

// Counts quoted directly from "What the Capillary Difference Actually Looks
// Like" (The Aerobic Base, citing Lydiard, Running to the Top): Swedish
// runners averaged 4-5 capillaries per muscle cell, Kenyan runners 7-8.
// Dot COUNT is real (the midpoint of each stated range); dot POSITIONING
// around the fiber is illustrative layout only.
const GROUPS = [
  { label: "Swedish", count: 4.5, cx: 160 },
  { label: "Kenyan", count: 7.5, cx: 400 },
];

function dotPositions(count: number, cx: number, cy: number, radius: number) {
  const n = Math.round(count);
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

const SWEEP_DURATION_MS = 1000;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

export function CapillaryDensificationDiagram() {
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
  const cy = CHART_HEIGHT / 2;

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="A comparison of capillary density around a single muscle fiber: four to five capillaries surrounding the fiber for the Swedish runners in the cited study, versus seven to eight surrounding the fiber for the Kenyan runners, nearly double the delivery network in the same muscle."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {GROUPS.map((g) => (
              <g key={g.label}>
                <circle cx={g.cx} cy={cy} r={FIBER_R} className="fill-zinc-950 stroke-zinc-400 dark:stroke-zinc-600" strokeWidth="1.5" />
                {dotPositions(g.count, g.cx, cy, FIBER_R + 20).map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="5" className="fill-[var(--accent-tip)]" />
                ))}
                <text x={g.cx} y={cy - FIBER_R - 32} textAnchor="middle" className="fill-zinc-300 text-[13px] font-semibold dark:fill-zinc-200">
                  {g.label}
                </text>
                <text x={g.cx} y={cy + FIBER_R + 50} textAnchor="middle" className="fill-[var(--accent-tip)] text-[12px] font-semibold">
                  {g.label === "Swedish" ? "4–5 per fiber" : "7–8 per fiber"}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Counts quoted directly from the page&rsquo;s own cited source (Lydiard, Running to the Top).</p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the capillary densification animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
