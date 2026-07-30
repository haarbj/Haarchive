"use client";

import { useId, useState } from "react";

import { LabeledInput } from "@/components/ui/labeled-input";
import { statCardClass, statLabelClass } from "@/lib/tool-styles";

// The "body weight in pounds divided by two" daily hydration baseline from
// sections.ts (Nutrition & Fueling's Hydration section), as a live worked
// example -- see training-heart-rate-inline.tsx for the sibling calculator
// this mirrors.
export function HydrationBaselineInline() {
  const baseId = useId();
  const [weightInput, setWeightInput] = useState("");

  const weight = Number(weightInput);
  const weightValid = weightInput.trim() !== "" && Number.isFinite(weight) && weight > 0;
  const ounces = weightValid ? weight / 2 : null;

  return (
    <div className={`${statCardClass} text-base leading-normal`}>
      <p className={statLabelClass}>Try it with your own weight</p>
      <div className="mt-3">
        <LabeledInput
          id={`${baseId}-weight`}
          label="Body weight (lb)"
          type="number"
          min={1}
          inputMode="numeric"
          value={weightInput}
          onChange={(event) => setWeightInput(event.target.value)}
          className="w-24"
        />
      </div>

      {ounces !== null ? (
        <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
            {Math.round(ounces)} <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">oz / day</span>
          </p>
          <p className="mt-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-300">
            {weight} lb &divide; 2 = {Math.round(ounces)} oz
          </p>
        </div>
      ) : (
        <p className="mt-4 border-t border-black/10 pt-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          Enter your body weight above to see your daily baseline.
        </p>
      )}
    </div>
  );
}
