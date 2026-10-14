"use client";

import { useState } from "react";

import { catchEarlyNudge, injuryGuidance, type PainCharacter } from "@/lib/private-coaching/setbacks";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Card } from "@/components/ui/card";

// Part I item 23, coach-only. Shown next to a logged pain report so the
// coach can get paradigm-appropriate guidance without leaving the page.
//
// This asks the coach to CLASSIFY the pain (where, and whether it is sharp
// and pinpoint or dull and load-dependent) rather than trying to infer that
// from the athlete's free-text note -- "my ankle hurts" does not say which
// pattern it is, and guessing wrong here means pointing a coach at the
// wrong rules. The classification stays local to this panel and is not
// stored anywhere: it is an input to a lookup, not a diagnosis on record.
export function InjuryTriagePanel() {
  const [character, setCharacter] = useState<PainCharacter | "">("");
  const [location, setLocation] = useState("");

  const nudge = catchEarlyNudge();
  const guidance = character ? injuryGuidance({ character, location }) : null;

  return (
    <Card padding="md" className="mt-3">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        Pain was reported
      </p>
      <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{nudge.detail}</p>

      <div className="mt-3 grid grid-cols-1 gap-2 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>How does it behave?</span>
          <select value={character} onChange={(e) => setCharacter(e.target.value as PainCharacter | "")} className={fieldClass}>
            <option value="">Choose&hellip;</option>
            <option value="bone-like">Sharp and highly localised (bone-like)</option>
            <option value="tendon-like">Dull and load-dependent (tendon-like)</option>
            <option value="knee-or-gait">At the knee</option>
            <option value="unclear">Not clear yet</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Where, if known</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. navicular, Achilles, lateral knee"
            className={fieldClass}
          />
        </label>
      </div>

      {guidance ? (
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
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{guidance.medicalNote}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{nudge.medicalNote}</p>
      )}
    </Card>
  );
}
