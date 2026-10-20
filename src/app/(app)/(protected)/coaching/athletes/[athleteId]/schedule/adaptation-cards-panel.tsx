"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatDate } from "@/lib/format";
import { adaptationActionSummary, adaptationEvidenceLines, adaptationSignalLabel } from "@/lib/private-coaching/adaptation-card-copy";
import type { AdaptationCardRow } from "@/lib/private-coaching/adaptation-cards-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptAdaptationCardAction, dismissAdaptationCardAction, loadAdaptationCards } from "./adaptation-actions";

// Consent-based adaptation cards: a deterministic signal engine
// (adaptation-signals.ts) flags a pattern, shows the coach the evidence
// and one concrete proposed action, and does nothing until Accept.
// Mirrors RealignPanel's own "fetch on mount, render nothing when
// there's nothing to show" shape, and Accept/Dismiss's exact consent
// mechanics -- see realign-panel.tsx and adaptation-cards-service.ts.
export function AdaptationCardsPanel({ athleteId }: { athleteId: string }) {
  const [cards, setCards] = useState<AdaptationCardRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAdaptationCards(athleteId).then((result) => {
      if (!cancelled) setCards(result);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  if (cards === null) return null;

  const pending = cards.filter((c) => c.status === "pending");
  const decided = cards.filter((c) => c.status !== "pending");

  if (pending.length === 0 && decided.length === 0) return null;

  async function refresh() {
    setCards(await loadAdaptationCards(athleteId));
  }

  return (
    <Card padding="md">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Adaptation Cards</p>

      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">No active signals right now.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {pending.map((card) => (
            <AdaptationCard key={card.id} athleteId={athleteId} card={card} onDecided={refresh} />
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-500 dark:text-zinc-400">History ({decided.length})</summary>
          <div className="mt-2 space-y-2">
            {decided.map((card) => (
              <div key={card.id} className="rounded-control border border-black/10 p-2 text-xs dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-200">{adaptationSignalLabel(card.signal)}</p>
                  <Badge tone="neutral">{card.status}</Badge>
                </div>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">{adaptationActionSummary(card)}</p>
                {card.decided_at ? <p className="mt-1 text-zinc-400 dark:text-zinc-500">Decided {formatDate(card.decided_at.slice(0, 10))}</p> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </Card>
  );
}

function AdaptationCard({ athleteId, card, onDecided }: { athleteId: string; card: AdaptationCardRow; onDecided: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosenDate, setChosenDate] = useState("");

  const evidenceLines = adaptationEvidenceLines(card);
  const actionSummary = adaptationActionSummary(card);

  // "Edit" opens the existing schedule editor on the exact day the
  // proposed change touches -- the coach's own usual workout-editing
  // surface, loaded with that workout's real current values, never the
  // proposal's values pre-applied. fatigue_accumulating/plan_too_low both
  // reference a concrete existing workout; fitness_up has no existing
  // workout to edit (it proposes inserting a new one, where the date
  // picker below already lets the coach choose before Accept); going_quiet
  // proposes no plan change at all, so there's nothing to edit.
  const editDate =
    card.signal === "fatigue_accumulating"
      ? (card.action as { scheduledDate: string }).scheduledDate
      : card.signal === "plan_too_low"
        ? (card.action as { scheduledDate: string }).scheduledDate
        : null;

  async function handleAccept() {
    setError(null);
    if (card.signal === "fitness_up" && !chosenDate) {
      setError("Pick a day for the retest workout.");
      return;
    }
    setPending("accept");
    const result = await acceptAdaptationCardAction(athleteId, card.id, chosenDate || undefined);
    setPending(null);
    if (result.error) return setError(result.error);
    onDecided();
    router.refresh();
  }

  async function handleDismiss() {
    setPending("dismiss");
    setError(null);
    const result = await dismissAdaptationCardAction(athleteId, card.id);
    setPending(null);
    if (result.error) return setError(result.error);
    onDecided();
  }

  return (
    <div className="rounded-control border border-black/10 p-3 dark:border-white/10">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{adaptationSignalLabel(card.signal)}</p>

      <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
        {evidenceLines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>

      <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-100">{actionSummary}</p>

      {card.signal === "fitness_up" ? (
        <label className="mt-2 block text-xs text-zinc-500 dark:text-zinc-400">
          Day for the retest workout
          <input
            type="date"
            value={chosenDate}
            onChange={(e) => setChosenDate(e.target.value)}
            className="mt-0.5 block rounded-control border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
          />
        </label>
      ) : null}

      {error ? <p className="mt-2 text-xs text-accent-error">{error}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <Button type="button" onClick={handleAccept} disabled={pending !== null}>
          {pending === "accept" ? "Applying…" : "Accept"}
        </Button>
        {editDate ? (
          <Link
            href={`/coaching/athletes/${athleteId}/schedule?date=${editDate}`}
            className="text-sm font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            Edit
          </Link>
        ) : null}
        <button
          type="button"
          onClick={handleDismiss}
          disabled={pending !== null}
          className="text-sm font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          {pending === "dismiss" ? "Dismissing…" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
