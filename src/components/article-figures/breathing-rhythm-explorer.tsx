"use client";

import { useState } from "react";

import { sectionLabelClass, segmentedButtonClass } from "@/lib/tool-styles";

// Ventilation figures quoted directly from "Breathing Rhythm as a Real-Time
// Pacing Signal" (Exercise Physiology): at a 180 steps/min cadence, 4-4
// moves roughly 90 L/min, 3-3 about 105, 2-2 about 135. The page gives NO
// total ventilation figure for 1-1 -- only a qualitative description (a
// fixed "dead space" volume eating a proportionally larger share of each,
// now much smaller, breath). Rather than invent a number for 1-1, it gets
// no bar at all below; see RHYTHMS' comment.
const VENT_MAX = 150;
const RHYTHMS = [
  { id: "4-4", label: "4-4", ventilation: 90 },
  { id: "3-3", label: "3-3", ventilation: 105 },
  { id: "2-2", label: "2-2", ventilation: 135, note: "~86% of elites default to this through near-maximal effort" },
  // No `ventilation` field -- deliberately not invented. See the
  // explanatory callout rendered in its place below.
  { id: "1-1", label: "1-1" },
] as const;

export function BreathingRhythmExplorer() {
  const [selected, setSelected] = useState<(typeof RHYTHMS)[number]["id"]>("2-2");
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const transitionClass = reducedMotion ? "" : "transition-transform duration-200 ease-out";
  const active = RHYTHMS.find((r) => r.id === selected)!;

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-zinc-900">
      <p className={sectionLabelClass}>Breathing rhythm vs. ventilation</p>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">At a 180 steps/min cadence, counted as steps-per-inhale to steps-per-exhale.</p>

      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Breathing rhythm">
        {RHYTHMS.map((r) => (
          <button key={r.id} type="button" onClick={() => setSelected(r.id)} className={segmentedButtonClass(selected === r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex h-32 items-end justify-center" aria-hidden="true">
        {"ventilation" in active && active.ventilation != null ? (
          <div className="flex h-full w-16 items-end overflow-hidden rounded-t-md border border-b-0 border-zinc-300 dark:border-zinc-700">
            <div
              className={`w-full origin-bottom bg-[var(--accent-tip)] ${transitionClass}`}
              style={{ height: "100%", transform: `scaleY(${active.ventilation / VENT_MAX})` }}
            />
          </div>
        ) : (
          <div className="flex h-full w-16 flex-col items-center justify-end gap-1 rounded-t-md border border-b-0 border-dashed border-[var(--accent-warning)] p-1 text-center">
            <span className="text-[10px] font-semibold text-[var(--accent-warning)]">dead space grows</span>
          </div>
        )}
      </div>

      <div aria-live="polite" className="mt-3 rounded-lg border border-black/10 p-3 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-300">
        {"ventilation" in active && active.ventilation != null ? (
          <>
            {active.label}: roughly {active.ventilation} L/min of ventilation.
            {"note" in active && active.note ? <> {active.note}.</> : null}
          </>
        ) : (
          <>
            1-1: the page gives no total ventilation figure here &mdash; breath size drops so much that the fixed, wasted
            &ldquo;dead space&rdquo; volume in each breath starts eating a proportionally larger share of it.
          </>
        )}
      </div>
    </div>
  );
}
