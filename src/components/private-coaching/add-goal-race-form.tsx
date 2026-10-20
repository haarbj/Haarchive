"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createGoalRace } from "@/app/(app)/(protected)/coaching/your-plan/actions";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// The "Your Plan" payoff's own inline "no goal race yet" remedy -- not a
// dead end, per the task's own requirement. A plain insert into the
// shared `goals` table (see createGoalRace's own header comment); once
// saved, router.refresh() re-renders the payoff's Server Component tree
// with the new goal in place, same pattern as CoachTrainsSelfPrompt.
export function AddGoalRaceForm() {
  const router = useRouter();
  const [raceName, setRaceName] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const result = await createGoalRace(raceName, goalDate);
    setIsPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3 rounded-control border border-black/10 p-3 dark:border-white/10">
      <div>
        <label className={labelClass} htmlFor="goal-race-name">
          Race name
        </label>
        <input
          id="goal-race-name"
          type="text"
          value={raceName}
          onChange={(e) => setRaceName(e.target.value)}
          required
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="goal-race-date">
          Race date
        </label>
        <input
          id="goal-race-date"
          type="date"
          value={goalDate}
          onChange={(e) => setGoalDate(e.target.value)}
          required
          className={fieldClass}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
      {error ? <FormError>{error}</FormError> : null}
    </form>
  );
}
