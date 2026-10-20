"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { loadOnboardingChecklist, type OnboardingView } from "./onboarding-actions";
import { Card } from "@/components/ui/card";

// Part K item 31, coach-only. Renders only while something is missing --
// once both prerequisites are met there is nothing useful left to say, so
// the panel disappears rather than sitting there confirming good news
// forever.
export function OnboardingPanel({ athleteId }: { athleteId: string }) {
  const [view, setView] = useState<OnboardingView | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadOnboardingChecklist({ athleteId }).then((result) => {
      if (!cancelled) setView(result);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  const prerequisites = view?.prerequisites;
  if (!view || view.error || !prerequisites || prerequisites.readyForMarathonPlan) return null;

  const crashCourseProgramId = view.crashCourseOffer
    ? view.crashCourseProgramIds?.[view.crashCourseOffer.frameworkKey]
    : null;

  return (
    <Card padding="md">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        Before a marathon plan
      </p>
      <ul className="mt-2 space-y-1.5">
        {prerequisites.notes.map((note) => (
          <li key={note} className="text-sm text-zinc-600 dark:text-zinc-300">
            {note}
          </li>
        ))}
      </ul>

      {view.crashCourseOffer ? (
        <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            5K Crash Course, Level {view.crashCourseOffer.level}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.crashCourseOffer.detail}</p>
          {crashCourseProgramId ? (
            <Link
              href={`/coaching/athletes/${athleteId}/schedule?view=phase&assignProgram=${crashCourseProgramId}`}
              className="mt-2 inline-block text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
            >
              Assign it
            </Link>
          ) : (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              You don&rsquo;t have the Crash Course set up yet. Ask your workspace admin to add it.
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
