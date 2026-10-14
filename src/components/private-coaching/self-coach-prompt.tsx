"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { becomeSelfCoach } from "@/app/(app)/(protected)/coaching/self-coach-actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// Deliberately NOT framed as "become a private coach" -- that would read
// as joining the invite-only coach product this whole feature is scoped
// to stay separate from (see becomeSelfCoach's own comment). This is the
// entry point for someone with neither isPrivateCoach nor isCoachedAthlete
// (coaching/page.tsx's "neither role" branch) who wants to plan their own
// training with the same tools, not become a coach for anyone else.
export function SelfCoachPrompt() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await becomeSelfCoach();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card padding="md" className="mt-6 max-w-xl">
      <p className="font-semibold text-zinc-900 dark:text-white">Build your own training plan</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Use the Haarchive&rsquo;s coaching tools -- the weekly schedule, workout templates, and training phases -- to
        plan and manage your own training.
      </p>
      <div className="mt-4">
        <Button type="button" onClick={start} disabled={isPending}>
          {isPending ? "Setting up…" : "Start self-coaching"}
        </Button>
      </div>
      {error && <FormError className="mt-3">{error}</FormError>}
    </Card>
  );
}
