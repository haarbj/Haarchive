"use client";

import { useState } from "react";

import { MEDICAL_NOTE, READY_TO_RUN_CHECKLIST, readyToRunSelfCheck } from "@/lib/private-coaching/setbacks";
import { Button } from "@/components/ui/button";

// The check itself. Pure client state: nothing is submitted, nothing is
// stored, and there is no server action behind it. The result is computed
// by the same tested function the coach-facing guidance uses, so the two
// can never disagree about what counts as a whole-body sign.
//
// Deliberately NOT phrased as a clearance. "An easy run is reasonable
// today" is a different sentence from "you are fine to run", and an
// athlete who reads the second one will run through something they should
// not.

export function ReadyToRunCheck() {
  const [answers, setAnswers] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const result = submitted ? readyToRunSelfCheck([...answers]) : null;

  function toggle(id: string) {
    setAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSubmitted(false);
  }

  return (
    <div className="mt-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        Tick anything that is true right now
      </p>
      <ul className="mt-3 space-y-2">
        {READY_TO_RUN_CHECKLIST.map((item) => (
          <li key={item.id}>
            <label className="flex items-start gap-3 rounded-control border border-black/10 p-3 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={answers.has(item.id)}
                onChange={() => toggle(item.id)}
                className="mt-1"
              />
              <span>{item.question}</span>
            </label>
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setSubmitted(true)}>
        {answers.size === 0 ? "Nothing applies — check" : `Check (${answers.size} ticked)`}
      </Button>

      {result ? (
        <div className="mt-6 rounded-card border border-black/10 p-4 dark:border-white/10">
          <p className="text-lg font-semibold text-zinc-900 dark:text-white">{result.guidance.title}</p>
          <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">{result.guidance.detail}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {result.guidance.actions.map((action) => (
              <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
                {action}
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-black/10 pt-3 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            {result.guidance.medicalNote}
          </p>
        </div>
      ) : (
        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">{MEDICAL_NOTE}</p>
      )}
    </div>
  );
}
