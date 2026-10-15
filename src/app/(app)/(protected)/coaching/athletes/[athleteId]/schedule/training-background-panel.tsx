"use client";

import { useEffect, useState } from "react";

import { loadTrainingBackground, type TrainingBackgroundView } from "./training-background-actions";
import { Card } from "@/components/ui/card";

// Coach-only, always visible. The most upstream context of all: whether
// this athlete's history is a prior cycle with this platform at all, or
// training that happened somewhere else entirely -- self-trained, a
// previous coach, another app, or no structured training yet. See
// training-background.ts's own header for why this exists.
export function TrainingBackgroundPanel({ athleteId }: { athleteId: string }) {
  const [view, setView] = useState<TrainingBackgroundView | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTrainingBackground({ athleteId }).then((result) => {
      if (!cancelled) setView(result);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  if (!view || view.error || !view.context) return null;

  return (
    <Card padding="md">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        Training background
      </p>
      <p className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-white">{view.context.title}</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.context.detail}</p>
      {view.context.medicalNote ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{view.context.medicalNote}</p>
      ) : null}
      {view.anchorPeakMileage != null ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Plan selection and progression anchor on a {view.anchorReliable ? "recorded" : "assumed"} peak of{" "}
          {view.anchorPeakMileage} mi/week.
          {view.anchorReliable ? "" : " Confirm this with the athlete before assigning a plan."}
        </p>
      ) : null}
    </Card>
  );
}
