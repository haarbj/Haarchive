"use client";

import { useState, useTransition } from "react";

import { generatePlansForRoster } from "@/app/(app)/(protected)/coach/actions";

type Athlete = { id: string; display_name: string };

type RosterGeneratePanelProps = {
  seasonId: string;
  athletes: Athlete[];
};

export function RosterGeneratePanel({ seasonId, athletes }: RosterGeneratePanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ succeeded: string[]; skipped: { athleteName: string; reason: string }[] } | null>(
    null,
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleGenerate() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const response = await generatePlansForRoster(seasonId, Array.from(selected));
      if (response.error) setError(response.error);
      else if (response.result) setResult(response.result);
    });
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">Generate plans for your roster</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Each athlete needs their own current mileage/days-per-week and an active goal at this season&rsquo;s
        distance with a goal time set — they set those themselves.
      </p>

      {athletes.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">No athletes on the roster yet.</p>
      ) : (
        <>
          <div className="mt-3 space-y-1.5">
            {athletes.map((athlete) => (
              <label key={athlete.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={selected.has(athlete.id)} onChange={() => toggle(athlete.id)} />
                {athlete.display_name}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending || selected.size === 0}
            className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Generating…" : `Generate for ${selected.size} athlete${selected.size === 1 ? "" : "s"}`}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-2 text-sm">
          {result.succeeded.length > 0 && (
            <p className="text-emerald-700 dark:text-emerald-400">
              <span className="font-semibold">Generated for </span>
              {result.succeeded.join(", ")}
            </p>
          )}
          {result.skipped.length > 0 && (
            <div className="text-amber-700 dark:text-amber-400">
              <p className="font-semibold">Skipped</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    {s.athleteName}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
