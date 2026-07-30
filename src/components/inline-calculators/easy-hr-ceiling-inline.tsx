"use client";

import { useId, useState } from "react";

import { LabeledInput } from "@/components/ui/labeled-input";
import { statCardClass, statLabelClass } from "@/lib/tool-styles";

// The "180 minus your age" easy-running HR ceiling from sections.ts (Marathon
// Training's Four Pillars, and the same number Maffetone's MAF Method uses
// in the Coaching Library), as a live worked example -- see
// training-heart-rate-inline.tsx for the sibling calculator this mirrors.
export function EasyHrCeilingInline() {
  const baseId = useId();
  const [ageInput, setAgeInput] = useState("");

  const age = Number(ageInput);
  const ageValid = ageInput.trim() !== "" && Number.isFinite(age) && age > 0;
  const ceiling = ageValid ? 180 - age : null;

  return (
    <div className={`${statCardClass} text-base leading-normal`}>
      <p className={statLabelClass}>Try it with your own age</p>
      <div className="mt-3">
        <LabeledInput
          id={`${baseId}-age`}
          label="Age"
          type="number"
          min={1}
          inputMode="numeric"
          value={ageInput}
          onChange={(event) => setAgeInput(event.target.value)}
          className="w-20"
        />
      </div>

      {ceiling !== null ? (
        <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
            Under {Math.round(ceiling)} <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">bpm</span>
          </p>
          <p className="mt-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-300">
            180 &minus; {age} = {Math.round(ceiling)} bpm
          </p>
        </div>
      ) : (
        <p className="mt-4 border-t border-black/10 pt-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          Enter your age above to see your ceiling.
        </p>
      )}
    </div>
  );
}
