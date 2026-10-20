"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { dismissPlanPayoff } from "./actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// "Take me to my schedule" -- the one required dismissal control. Marks
// plan_payoff_dismissed_at (dismissPlanPayoff) so the one-time auto-show
// never fires again, then leaves for the athlete's real coaching home.
// This page stays reachable afterward regardless -- dismissal only ever
// gates the automatic redirect, never the page itself.
export function DismissPayoffButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsPending(true);
    const result = await dismissPlanPayoff();
    setIsPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/coaching");
  }

  return (
    <div>
      <Button type="button" variant="outline" onClick={handleClick} disabled={isPending}>
        {isPending ? "…" : "Take me to my schedule"}
      </Button>
      {error ? <FormError className="mt-2">{error}</FormError> : null}
    </div>
  );
}
