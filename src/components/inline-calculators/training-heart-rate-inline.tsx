"use client";

import { useId, useState } from "react";

import { LabeledInput } from "@/components/ui/labeled-input";
import { bpmFromPercent, estimateMaxHr } from "@/lib/hr-model";
import { statCardClass, statLabelClass } from "@/lib/tool-styles";

const RANGE_WIDTH_BPM = 5;
const RESERVE_PERCENT = 70;

// A small worked-example version of the "Finding Your Training Heart Rate"
// formula in sections.ts, embedded directly in that prose via the
// "calculator" ContentBlock type (see components/content-blocks.tsx and
// components/inline-calculators/index.tsx) so a reader can plug in real
// numbers instead of doing the arithmetic by hand. Deliberately no +3 bpm
// adjustment for women: that term was already found unsourced and dropped
// from every other calculator on the site (see lib/hr-model.ts) rather than
// reintroduced here.
export function TrainingHeartRateInline() {
  const baseId = useId();
  const [ageInput, setAgeInput] = useState("");
  const [restingHrInput, setRestingHrInput] = useState("");

  const age = Number(ageInput);
  const ageValid = ageInput.trim() !== "" && Number.isFinite(age) && age > 0;
  const restingHr = Number(restingHrInput);
  const restingHrValid = restingHrInput.trim() !== "" && Number.isFinite(restingHr) && restingHr > 0;

  const maxHr = ageValid ? estimateMaxHr(age, null) : null;
  const target = maxHr !== null && restingHrValid ? bpmFromPercent(RESERVE_PERCENT, "hrreserve", maxHr, restingHr) : null;

  return (
    <div className={`${statCardClass} text-base leading-normal`}>
      <p className={statLabelClass}>Try it with your own numbers</p>
      <div className="mt-3 flex flex-wrap gap-6">
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
        <LabeledInput
          id={`${baseId}-resting-hr`}
          label="Resting heart rate"
          type="number"
          min={1}
          inputMode="numeric"
          value={restingHrInput}
          onChange={(event) => setRestingHrInput(event.target.value)}
          placeholder="e.g. 60"
          className="w-28"
        />
      </div>

      {target !== null && maxHr !== null ? (
        <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
            {Math.round(target - RANGE_WIDTH_BPM)}&ndash;{Math.round(target + RANGE_WIDTH_BPM)}{" "}
            <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">bpm</span>
          </p>
          <p className="mt-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-300">
            (220 &minus; {age} &minus; {restingHr}) &times; 70% + {restingHr} = {Math.round(target)} bpm, &plusmn;{RANGE_WIDTH_BPM} bpm
          </p>
        </div>
      ) : (
        <p className="mt-4 border-t border-black/10 pt-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          Enter your age and resting heart rate above to see your range.
        </p>
      )}
    </div>
  );
}
