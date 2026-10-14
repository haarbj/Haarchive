"use client";

import { useState } from "react";

import {
  READY_TO_RUN_CHECKLIST,
  illnessGuidanceForCoach,
  illnessReturnProgression,
} from "@/lib/private-coaching/setbacks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Part I item 22b/22c, coach-only. Offered when a check-in or message
// mentions something that reads like illness (see
// mentionsPossibleIllness) -- the coach works through the same checklist
// the athlete's self-check uses, and gets the cold-like vs. flu-like
// distinction and the return progression.
export function IllnessPanel() {
  const [answers, setAnswers] = useState<Set<string>>(new Set());
  const [showReturn, setShowReturn] = useState(false);

  const guidance = illnessGuidanceForCoach([...answers]);
  const returnGuidance = illnessReturnProgression();

  function toggle(id: string) {
    setAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card padding="md" className="mt-3">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        Illness guidance
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Work through what they&rsquo;re describing to get the right pattern. This is the same checklist their own
        self-check uses.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-1.5 xs:grid-cols-2">
        {READY_TO_RUN_CHECKLIST.map((item) => (
          <label key={item.id} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={answers.has(item.id)} onChange={() => toggle(item.id)} className="mt-0.5" />
            <span>{item.question}</span>
          </label>
        ))}
      </div>

      <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{guidance.title}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{guidance.detail}</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          {guidance.actions.map((action) => (
            <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
              {action}
            </li>
          ))}
        </ul>
      </div>

      <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setShowReturn((prev) => !prev)}>
        {showReturn ? "Hide the return progression" : "Once they're better: how to come back"}
      </Button>
      {showReturn ? (
        <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{returnGuidance.title}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{returnGuidance.detail}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {returnGuidance.actions.map((action) => (
              <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{guidance.medicalNote}</p>
    </Card>
  );
}
