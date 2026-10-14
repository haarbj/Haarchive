"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { fieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";

export type RosterOption = { athleteId: string; displayName: string };

// The program page's own entry point into the assign flow (see the Phase
// View's "Assign a program" button, which this deep-links into rather than
// duplicating) -- the program itself has no athlete context, so picking one
// here is the one extra step this surface needs before handing off.
export function AssignToAthleteButton({ programId, roster }: { programId: string; roster: RosterOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [athleteId, setAthleteId] = useState(roster[0]?.athleteId ?? "");

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Assign to athlete
      </Button>
    );
  }

  if (roster.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        No athletes on your roster yet.
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} className={`${fieldClass} max-w-[14rem]`} aria-label="Choose athlete">
        {roster.map((r) => (
          <option key={r.athleteId} value={r.athleteId}>
            {r.displayName}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        onClick={() => router.push(`/coaching/athletes/${athleteId}/schedule?view=phase&assignProgramId=${programId}`)}
      >
        Go
      </Button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
      >
        Cancel
      </button>
    </div>
  );
}
