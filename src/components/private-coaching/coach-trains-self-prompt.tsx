"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setCoachTrainsSelf } from "@/app/(app)/(protected)/settings/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// Required (no "skip"/"maybe later", unlike learning-onboarding-prompt.tsx)
// -- Settings can't correctly decide whether to show Athlete
// Profile/Race Results/Injuries to a private coach without a real answer,
// and there's no relationship-based fact to infer it from for a coach who
// isn't already isAthlete/isCoachedAthlete (see the migration's own
// comment). router.refresh() re-renders the coaching page's Server
// Component tree once saved, at which point session.coachTrainsSelf is no
// longer null and the real coach content renders in this same slot instead
// -- simpler than a client-side state machine since there's no multi-step
// wizard or recommendation to preserve across the transition, just a
// straight yes/no.
export function CoachTrainsSelfPrompt() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function answer(trainsSelf: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setCoachTrainsSelf(trainsSelf);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card padding="md">
      <p className="font-semibold text-zinc-900 dark:text-white">Do you also train and race yourself?</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        This decides whether your own Athlete Profile, Race Results, and Injury log show up in Settings, separate
        from your coaching. Answering yes also sets you up to plan and track your own training the same way your
        athletes do -- schedule, check-ins, and coaching tools. You can change your answer anytime.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={() => answer(true)} disabled={isPending}>
          {isPending ? "Saving…" : "Yes, I train too"}
        </Button>
        <Button type="button" variant="outline" onClick={() => answer(false)} disabled={isPending}>
          {isPending ? "Saving…" : "No, coaching only"}
        </Button>
      </div>
      {error && <FormError className="mt-3">{error}</FormError>}
    </Card>
  );
}
