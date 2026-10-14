"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { runEstimateReview, saveEstimateReview, type EstimateReviewView } from "./estimate-review-actions";
import { formatDate } from "@/lib/format";
import { formatClock, parseTimeToSeconds } from "@/lib/running-format";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Part F, coach-only. On demand rather than on page load: a review reads a
// month of logged work and is a thing a coach chooses to do, not a number
// that should quietly appear next to everything else.
//
// The confirmation step records the coach's conclusion. It deliberately
// does NOT write the athlete's own estimate -- that stays athlete-owned
// (see estimate-review-actions.ts). The copy says so, so a coach is never
// left believing the athlete's paces have moved when they have not.

const VERDICT_LABEL: Record<string, string> = {
  "about-right": "Looks about right",
  "looks-optimistic": "Looks optimistic",
  "looks-conservative": "Looks conservative",
  "not-enough-evidence": "Not enough evidence",
};

export function EstimateReviewPanel({ athleteId }: { athleteId: string }) {
  const router = useRouter();
  const [view, setView] = useState<EstimateReviewView | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proposal = view?.proposal;
  const referenceLabel = view?.referenceKey === "5k" ? "5K" : "marathon";

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
          Fitness estimate review
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={running}
          onClick={async () => {
            setRunning(true);
            setError(null);
            setSaved(false);
            const result = await runEstimateReview({ athleteId });
            setRunning(false);
            if (result.error) return setError(result.error);
            setView(result);
            setConfirmInput(result.proposal?.proposedTimeS ? formatClock(result.proposal.proposedTimeS) : "");
          }}
        >
          {running ? "Reading the log…" : view ? "Run again" : "Run a review"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Reads the last four weeks of logged sessions. Advisory: it proposes, you decide.
      </p>

      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {view?.deterioration?.flagged ? (
        <div className="mt-3 rounded-control border border-black/10 p-3 dark:border-white/10">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{view.deterioration.title}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.deterioration.detail}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {view.deterioration.actions.map((action) => (
              <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {proposal ? (
        <div className="mt-3">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {VERDICT_LABEL[proposal.verdict] ?? proposal.verdict}
            <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
              {referenceLabel} estimate
              {view?.phaseKey ? ` · read against the ${view.phaseKey} phase` : ""}
            </span>
          </p>
          <ul className="mt-1.5 space-y-1">
            {proposal.notes.map((note) => (
              <li key={note} className="text-sm text-zinc-600 dark:text-zinc-300">
                {note}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <span>On file: {proposal.currentTimeS != null ? formatClock(proposal.currentTimeS) : "nothing yet"}</span>
            <span>Proposed: {proposal.proposedTimeS != null ? formatClock(proposal.proposedTimeS) : "no number"}</span>
          </div>

          {proposal.contributions.length > 0 ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white">
                Which sessions weighed most ({proposal.contributions.length})
              </summary>
              <ul className="mt-2 space-y-2 border-l border-black/10 pl-4 dark:border-white/10">
                {proposal.contributions.map((entry) => (
                  <li key={entry.session.id}>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {formatDate(entry.session.scheduledDate)}
                      {entry.session.dayLabel ? ` · ${entry.session.dayLabel}` : ""}
                      <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                        weight {Math.round(entry.weight * 100) / 100}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{entry.reasons.join(" ")}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
            <label className="block max-w-xs">
              <span className={labelClass}>Your conclusion ({referenceLabel} time)</span>
              <input
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="mm:ss or h:mm:ss"
                className={fieldClass}
              />
            </label>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Recorded against this athlete for the trend, and for the deterioration check. It does not change their
              estimate: athletes own their own, so take this to them. Leave it blank to record that you reviewed and left
              it alone.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setError(null);
                const confirmed = confirmInput.trim() ? parseTimeToSeconds(confirmInput.trim()) : null;
                if (confirmInput.trim() && (confirmed == null || confirmed <= 0)) {
                  setSaving(false);
                  return setError("Enter a time like 15:57 or 3:05:00, or leave it blank.");
                }
                const result = await saveEstimateReview({
                  athleteId,
                  referenceKey: view?.referenceKey ?? "marathon",
                  verdict: proposal.verdict,
                  previousTimeS: proposal.currentTimeS,
                  proposedTimeS: proposal.proposedTimeS,
                  confirmedTimeS: confirmed,
                  reasoning: proposal.notes.join("\n\n"),
                  sessionsCounted: proposal.contributions.length,
                  // The review only counted sessions that were actually
                  // completed, so any evidence at all means work happened.
                  workCompleted: proposal.contributions.length > 0,
                });
                setSaving(false);
                if (result.error) return setError(result.error);
                setSaved(true);
                router.refresh();
              }}
            >
              {saving ? "Recording…" : "Record this review"}
            </Button>
            {saved ? <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">Recorded.</span> : null}
          </div>
        </div>
      ) : null}

      {view?.history && view.history.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white">
            Past reviews ({view.history.length})
          </summary>
          <ul className="mt-2 space-y-1 border-l border-black/10 pl-4 dark:border-white/10">
            {view.history.map((entry) => (
              <li key={entry.reviewedAt} className="text-sm text-zinc-600 dark:text-zinc-300">
                {formatDate(entry.reviewedAt)} · {VERDICT_LABEL[entry.verdict] ?? entry.verdict}
                {entry.confirmedTimeS != null ? ` · settled on ${formatClock(entry.confirmedTimeS)}` : " · left as it was"}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}
