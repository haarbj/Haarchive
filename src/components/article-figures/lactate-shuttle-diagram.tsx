"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 680;
const CHART_HEIGHT = 280;
const SOURCE_X = 90;
const SOURCE_Y = 140;
const DEST_X = 560;

// The four destinations named directly in "What Lactate Actually Is (and
// Isn't)": "sometimes to a neighboring, more oxidative muscle fiber,
// sometimes through the bloodstream to the heart, liver, or kidneys."
const DESTINATIONS = [
  { label: "Neighboring slow-twitch fiber", y: 50 },
  { label: "Heart", y: 110 },
  { label: "Liver", y: 170 },
  { label: "Kidneys", y: 230 },
];

const SWEEP_DURATION_MS = 1000;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

// Same ref-driven clip-path sweep as the approved pilot
// (intensity-domains-diagram.tsx) -- a one-shot reveal of the lactate
// shuttle's fan-out, since the page's point is specifically that lactate
// moves OUT to several destinations (unlike muscle glycogen, which the
// page states stays put -- see the caption below for that contrast).
export function LactateShuttleDiagram() {
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
        alt="A diagram showing a fast-twitch muscle fiber producing lactate, with arrows fanning out to four destinations that oxidize it for fuel: a neighboring slow-twitch fiber, the heart, the liver, and the kidneys. A label notes that roughly 75% of lactate produced at marathon effort is oxidized directly by these other tissues."
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
            {DESTINATIONS.map((d) => (
              <line
                key={d.label}
                x1={SOURCE_X + 16}
                y1={SOURCE_Y}
                x2={DEST_X - 16}
                y2={d.y}
                strokeWidth="1.5"
                className="stroke-[var(--accent-tip)]"
                markerEnd="url(#lactate-arrow)"
              />
            ))}
            <defs>
              <marker id="lactate-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" className="fill-[var(--accent-tip)]" />
              </marker>
            </defs>

            <circle cx={SOURCE_X} cy={SOURCE_Y} r="20" className="fill-zinc-950 stroke-[var(--accent-tip)]" strokeWidth="2" />
            <text x={SOURCE_X} y={SOURCE_Y - 30} textAnchor="middle" className="fill-zinc-300 text-[12px] font-semibold dark:fill-zinc-200">
              Fast-twitch fiber
            </text>
            <text x={SOURCE_X} y={SOURCE_Y + 36} textAnchor="middle" className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
              produces lactate
            </text>

            {DESTINATIONS.map((d) => (
              <g key={d.label}>
                <circle cx={DEST_X} cy={d.y} r="12" className="fill-zinc-950 stroke-zinc-400 dark:stroke-zinc-600" strokeWidth="1.5" />
                <text x={DEST_X + 20} y={d.y + 4} textAnchor="start" className="fill-zinc-300 text-[12px] dark:fill-zinc-200">
                  {d.label}
                </text>
              </g>
            ))}

            <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 10} textAnchor="middle" className="fill-[var(--accent-tip)] text-[13px] font-semibold">
              ~75% oxidized directly by other tissues (marathon effort)
            </text>
          </svg>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Lactate can be shuttled out to any of these destinations. Muscle glycogen can&rsquo;t: a muscle lacks the
          enzyme to export stored glycogen, so its store is usable only by that same muscle.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the lactate shuttle animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
