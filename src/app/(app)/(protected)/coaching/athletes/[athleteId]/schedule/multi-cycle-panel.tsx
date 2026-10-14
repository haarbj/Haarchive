"use client";

import { useEffect, useState } from "react";

import { loadMultiCycleHistory, type MultiCycleView } from "./multi-cycle-actions";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Part G, coach-only. History on the left of the decision, the suggestion
// on the right of it. Advisory: it suggests a rung, the coach assigns
// whatever they judge right.
//
// The injury question is a real toggle rather than something inferred.
// "Was the root cause addressed" is a clinical and contextual judgment the
// platform has no way to make, and getting it wrong in the optimistic
// direction is how an athlete gets progressed back into the thing that
// broke them.

export function MultiCyclePanel({ athleteId }: { athleteId: string }) {
  const [view, setView] = useState<MultiCycleView | null>(null);
  const [unresolvedInjury, setUnresolvedInjury] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMultiCycleHistory({ athleteId, unresolvedInjury }).then((result) => {
      if (!cancelled) setView(result);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId, unresolvedInjury]);

  if (!view || view.error) return null;
  const cycles = view.cycles ?? [];
  const suggestion = view.suggestion;
  if (cycles.length === 0 && !suggestion) return null;

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
          Across cycles
        </p>
        {cycles.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowHistory((prev) => !prev)}>
            {showHistory ? "Hide history" : `History (${cycles.length})`}
          </Button>
        ) : null}
      </div>

      {view.consecutiveMarathonCycles != null && view.consecutiveMarathonCycles > 0 ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {view.consecutiveMarathonCycles} marathon buildup{view.consecutiveMarathonCycles === 1 ? "" : "s"} in a row.
        </p>
      ) : null}

      {showHistory && cycles.length > 0 ? (
        <ul className="mt-3 space-y-1 border-l border-black/10 pl-4 dark:border-white/10">
          {[...cycles].reverse().map((c) => (
            <li key={`${c.startDate}-${c.programId ?? "manual"}`} className="text-sm text-zinc-600 dark:text-zinc-300">
              {formatDate(c.startDate)} to {formatDate(c.endDate)} ·{" "}
              {c.programName ?? "Built by hand"}
              {c.peakMileage != null ? ` · peak ${c.peakMileage} mi/week` : ""}
              <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                ({c.phaseKeys.length} phase{c.phaseKeys.length === 1 ? "" : "s"})
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {suggestion ? (
        <div className="mt-3">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{suggestion.title}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{suggestion.detail}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {suggestion.actions.map((action) => (
              <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="mt-3 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={unresolvedInjury}
          onChange={(e) => setUnresolvedInjury(e.target.checked)}
          className="mt-1"
        />
        <span>
          An injury in the last cycle whose cause has not been addressed.
          <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
            Your call, not something read from the log. Checking it holds the next buildup at a level they have already
            completed.
          </span>
        </span>
      </label>
    </Card>
  );
}
