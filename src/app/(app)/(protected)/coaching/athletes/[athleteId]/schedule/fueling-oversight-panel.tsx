"use client";

import { useEffect, useState } from "react";

import { loadFuelingOversight, type FuelingOversightView } from "./fueling-oversight-actions";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { UnderFuelingSignals } from "@/lib/private-coaching/fueling-oversight";
import type { SetbackGuidance } from "@/lib/private-coaching/setbacks";
import { Card } from "@/components/ui/card";

// Part L, coach-only. The under-fuelling signals are answered in the
// moment and nothing is saved -- the same stateless pattern Parts I and J
// use for a judgment the coach makes, not a fact the platform tracks. The
// gut-training check and the ferritin trigger's "aerobic fitness
// stalling" half are both derived from real logged data, so they load
// without any input from the coach.

const SIGNAL_LABELS: { key: keyof UnderFuelingSignals; label: string }[] = [
  { key: "frequentIllness", label: "Frequent illness" },
  { key: "recurrentOveruseInjuries", label: "Recurring overuse injuries" },
  { key: "troubleSleeping", label: "Trouble sleeping" },
  { key: "hormoneDisruptions", label: "Hormone disruptions" },
  { key: "plateauingOrDecliningDespiteSolidTraining", label: "Performance plateauing or declining despite training that looks solid" },
];

function GuidanceBlock({ guidance }: { guidance: SetbackGuidance }) {
  return (
    <div className="mt-2">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{guidance.title}</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{guidance.detail}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        {guidance.actions.map((action) => (
          <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
            {action}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{guidance.medicalNote}</p>
    </div>
  );
}

export function FuelingOversightPanel({ athleteId }: { athleteId: string }) {
  const [signals, setSignals] = useState<UnderFuelingSignals>({
    frequentIllness: false,
    recurrentOveruseInjuries: false,
    troubleSleeping: false,
    hormoneDisruptions: false,
    plateauingOrDecliningDespiteSolidTraining: false,
  });
  const [view, setView] = useState<FuelingOversightView | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFuelingOversight({ athleteId, underFuelingSignals: signals }).then((result) => {
      if (!cancelled) setView(result);
    });
    return () => {
      cancelled = true;
    };
    // Re-runs whenever a checkbox changes, since the cluster assessment
    // and the ferritin trigger both depend on these signals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId, JSON.stringify(signals)]);

  const gutTrainingFired = view?.gutTraining?.fired;
  const hasAnything = view && !view.error && (view.underFueling?.clusterPresent || gutTrainingFired || view.ferritin);

  return (
    <Card padding="md">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Fuelling</p>

      {gutTrainingFired && view?.gutTraining ? (
        <div className="mt-3 rounded-control border border-black/10 p-3 dark:border-white/10">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Race-day fuelling isn&rsquo;t showing up in the log</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.gutTraining.detail}</p>
          {view.gutTraining.unpracticedSessions.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {view.gutTraining.unpracticedSessions.map((w) => (
                <li key={w.id} className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatDate(w.scheduledDate)}
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            href="/coaching/learn/fueling-and-hydration"
            className="mt-2 inline-block text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            The fuelling &amp; hydration guide
          </Link>
        </div>
      ) : null}

      <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Under-fuelling signals
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Not saved -- answer for how things actually look right now.
        </p>
        <div className="mt-2 space-y-1.5">
          {SIGNAL_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={signals[key]}
                onChange={(e) => setSignals((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="mt-0.5"
              />
              {label}
            </label>
          ))}
        </div>
        {view?.underFueling?.guidance ? <GuidanceBlock guidance={view.underFueling.guidance} /> : null}
      </div>

      {view?.ferritin ? (
        <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
          <GuidanceBlock guidance={view.ferritin} />
        </div>
      ) : null}

      {!hasAnything ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Nothing to flag right now.</p>
      ) : null}
    </Card>
  );
}
