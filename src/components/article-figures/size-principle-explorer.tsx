"use client";

import { useId, useState } from "react";

import { sectionLabelClass, segmentedButtonClass, statLabelClass } from "@/lib/tool-styles";

// Recruitment order and the two reversals are quoted directly from "The
// Size Principle" and "Reversing the Size Principle" (Exercise Physiology):
// Type I fires first, IIA joins as demand rises, IIB only once everything
// below it is maxed out -- reversed by (1) a plyometric stretch-shortening
// action (hill bounding) or (2) a load above roughly 85% of 1RM, either of
// which recruits the largest motor units first.
const FIBERS = [
  { id: "I", label: "Type I", threshold: 0 },
  { id: "IIA", label: "Type IIA", threshold: 35 },
  { id: "IIB", label: "Type IIB", threshold: 75 },
] as const;

type Mode = "normal" | "bounding" | "heavy-lift";

const MODES: { id: Mode; label: string }[] = [
  { id: "normal", label: "Normal effort" },
  { id: "bounding", label: "Hill bounding" },
  { id: "heavy-lift", label: "Heavy lift (85%+ 1RM)" },
];

function isActive(fiberId: (typeof FIBERS)[number]["id"], effort: number, mode: Mode): boolean {
  if (mode === "normal") {
    const fiber = FIBERS.find((f) => f.id === fiberId);
    return !!fiber && effort >= fiber.threshold;
  }
  // Both reversals recruit the largest units first, regardless of the
  // effort slider -- that's the entire point of "reversing" the size
  // principle, so IIB (and IIA) light up immediately in these modes.
  return fiberId === "IIB" || fiberId === "IIA";
}

// Same "interactive explorer" pattern as the existing
// gastric-emptying-explorer.tsx: a self-contained light/dark card (not the
// Diagram component, which is for a permanently-dark science-figure box;
// this is a slider-driven explorer, the same kind of figure
// GastricEmptyingExplorer already is), React state rather than a
// scroll-triggered reveal, since the user drives the change directly.
export function SizePrincipleExplorer() {
  const baseId = useId();
  const [effort, setEffort] = useState(20);
  const [mode, setMode] = useState<Mode>("normal");
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const transitionClass = reducedMotion ? "" : "transition-[opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]";

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-zinc-900">
      <p className={sectionLabelClass}>Motor unit recruitment order</p>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">Smallest to largest, except under the two reversals below.</p>

      <div
        role="img"
        aria-label="Three fiber-type bars: Type I is always active, Type IIA and Type IIB activate as effort rises, smallest to largest. Switching to hill bounding or a heavy lift above 85% of one-rep max activates Type IIA and Type IIB immediately regardless of the effort level."
        className="flex items-end justify-center gap-6 py-4"
      >
        {FIBERS.map((f) => {
          const active = isActive(f.id, effort, mode);
          return (
            <div key={f.id} className="flex flex-col items-center gap-2">
              <div
                className={`h-20 w-10 rounded-md border-2 ${transitionClass} ${
                  active
                    ? "border-[var(--accent-tip)] bg-[var(--accent-tip)] opacity-100"
                    : "border-zinc-300 bg-transparent opacity-30 dark:border-zinc-700"
                }`}
              />
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{f.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-2">
        <label htmlFor={`${baseId}-effort`} className={statLabelClass}>
          Effort (normal-mode slider)
        </label>
        <input
          id={`${baseId}-effort`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={effort}
          disabled={mode !== "normal"}
          onChange={(e) => setEffort(Number(e.target.value))}
          aria-valuetext={`${effort} percent effort`}
          className="mt-2 w-full accent-[var(--accent-tip)] disabled:opacity-40 [accent-color:var(--accent-tip)]"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Recruitment mode">
        {MODES.map((m) => (
          <button key={m.id} type="button" onClick={() => setMode(m.id)} className={segmentedButtonClass(mode === m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-3 rounded-lg border border-black/10 p-3 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-300">
        {mode === "normal" ? (
          <>Under ordinary voluntary effort, the smallest Type I units fire first; the biggest Type IIB units join only once everything below them is already maxed out.</>
        ) : mode === "bounding" ? (
          <>A sudden eccentric stretch immediately followed by a concentric contraction &mdash; every stride of hill bounding &mdash; recruits the largest fibers first, regardless of overall effort.</>
        ) : (
          <>A load above roughly 85% of a one-rep max recruits the largest motor units first, simply because nothing smaller can move the weight.</>
        )}
      </div>
    </div>
  );
}
