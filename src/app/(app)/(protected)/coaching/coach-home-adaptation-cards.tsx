"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { adaptationActionSummary, adaptationEvidenceLines, adaptationSignalLabel } from "@/lib/private-coaching/adaptation-card-copy";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptAdaptationCardAction, dismissAdaptationCardAction } from "./athletes/[athleteId]/schedule/adaptation-actions";
import type { CoachAdaptationCard } from "./adaptation-cards-data";

// The roster-wide scan surface for adaptation cards on coach home --
// same card content and consent mechanics as AdaptationCardsPanel
// (the per-athlete schedule-page surface), just across every athlete at
// once rather than one. Both surfaces call the exact same server
// actions (adaptation-actions.ts), so Accept/Dismiss can never behave
// differently depending on which screen a coach decided from.
export function CoachHomeAdaptationCards({ cards }: { cards: CoachAdaptationCard[] }) {
  return (
    <div className="mt-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Adaptation Cards</p>
      <div className="mt-3 space-y-3">
        {cards.map((card) => (
          <CoachHomeAdaptationCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function CoachHomeAdaptationCard({ card }: { card: CoachAdaptationCard }) {
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [chosenDate, setChosenDate] = useState("");

  if (dismissed) return null;

  const evidenceLines = adaptationEvidenceLines(card);
  const actionSummary = adaptationActionSummary(card);

  async function handleAccept() {
    setError(null);
    if (card.signal === "fitness_up" && !chosenDate) {
      setError("Pick a day for the retest workout.");
      return;
    }
    setPending("accept");
    const result = await acceptAdaptationCardAction(card.athlete_id, card.id, chosenDate || undefined);
    setPending(null);
    if (result.error) return setError(result.error);
    setDismissed(true);
    router.refresh();
  }

  async function handleDismiss() {
    setPending("dismiss");
    setError(null);
    const result = await dismissAdaptationCardAction(card.athlete_id, card.id);
    setPending(null);
    if (result.error) return setError(result.error);
    setDismissed(true);
  }

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          <Link href={`/coaching/athletes/${card.athlete_id}`} className="hover:underline">
            {card.athleteDisplayName}
          </Link>
          {" · "}
          {adaptationSignalLabel(card.signal)}
        </p>
      </div>

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

      <div className="mt-3 flex gap-2">
        <Button type="button" onClick={handleAccept} disabled={pending !== null}>
          {pending === "accept" ? "Applying…" : "Accept"}
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={pending !== null}
          className="text-sm font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          {pending === "dismiss" ? "Dismissing…" : "Dismiss"}
        </button>
      </div>
    </Card>
  );
}
