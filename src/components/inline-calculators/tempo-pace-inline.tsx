"use client";

import { useId, useState } from "react";

import { LabeledInput } from "@/components/ui/labeled-input";
import { formatClock, parseTimeToSeconds } from "@/lib/running-format";
import { MILE_METERS } from "@/lib/race-distances";
import { statCardClass, statLabelClass } from "@/lib/tool-styles";

const FIVE_K_METERS = 5000;
const TEMPO_FACTOR = 0.93;

// The "5K pace divided by 0.93" tempo-pace rule of thumb from sections.ts
// (Marathon Training's "A Formula for Tempo Pace"), as a live worked
// example. The Pace & Heart Rate Calculator computes this same relationship
// as part of a full training-paces breakdown; this is the lightweight,
// single-purpose version embedded directly in the prose that explains it.
export function TempoPaceInline() {
  const baseId = useId();
  const [fiveKInput, setFiveKInput] = useState("");

  const fiveKSeconds = parseTimeToSeconds(fiveKInput);
  const fiveKValid = fiveKSeconds !== null && fiveKSeconds > 0;

  const fiveKPacePerMile = fiveKValid ? fiveKSeconds! / (FIVE_K_METERS / MILE_METERS) : null;
  const tempoPacePerMile = fiveKPacePerMile !== null ? fiveKPacePerMile / TEMPO_FACTOR : null;

  return (
    <div className={`${statCardClass} text-base leading-normal`}>
      <p className={statLabelClass}>Try it with your own 5K time</p>
      <div className="mt-3">
        <LabeledInput
          id={`${baseId}-5k-time`}
          label="5K time"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 20:00"
          value={fiveKInput}
          onChange={(event) => setFiveKInput(event.target.value)}
          className="w-24"
        />
      </div>

      {tempoPacePerMile !== null ? (
        <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
            {formatClock(tempoPacePerMile)} <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">/mi</span>
          </p>
          <p className="mt-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-300">
            {formatClock(fiveKPacePerMile!)}/mi &divide; {TEMPO_FACTOR} = {formatClock(tempoPacePerMile)}/mi
          </p>
        </div>
      ) : (
        <p className="mt-4 border-t border-black/10 pt-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          Enter a 5K time above (mm:ss) to see your tempo pace.
        </p>
      )}
    </div>
  );
}
