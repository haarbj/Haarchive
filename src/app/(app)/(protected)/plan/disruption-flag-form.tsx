"use client";

import { useState } from "react";

import { flagDisruption } from "./realignment-actions";
import { Button } from "@/components/ui/button";

// Trigger (a) of Plan Realignment: the athlete flags their own
// disruption -- "I was sick / traveling / couldn't train" -- with a date
// range. This never shows a proposal back to the athlete; it only lands
// on the coach's side (realign-panel.tsx, on the athlete's schedule
// page), who reviews/edits/accepts before anything about the plan
// actually changes. Missed-workout badges alone never trigger this --
// only this explicit flag, or the coach initiating it themselves, does.
export function DisruptionFlagForm() {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);

  async function handleSubmit() {
    setResult(null);
    if (!startDate || !endDate) {
      setResult({ error: "Pick both a start and end date." });
      return;
    }
    setPending(true);
    const response = await flagDisruption({ startDate, endDate }, note || null);
    setPending(false);
    if (response.error) {
      setResult({ error: response.error });
      return;
    }
    setResult({ success: true });
    setStartDate("");
    setEndDate("");
    setNote("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
      >
        I missed training -- tell my coach
      </button>
    );
  }

  return (
    <div className="rounded-control border border-black/10 p-3 text-sm dark:border-white/10">
      <p className="text-zinc-600 dark:text-zinc-300">
        When were you unable to train? Your coach will see this and can revise the coming week if it helps -- nothing changes
        automatically.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label="First day you couldn't train"
          className="rounded-control border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label="Last day you couldn't train"
          className="rounded-control border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
        />
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional: sick, traveling, etc."
        className="mt-2 w-full rounded-control border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
      />
      {result?.error ? <p className="mt-2 text-xs text-accent-error">{result.error}</p> : null}
      {result?.success ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Sent to your coach.</p> : null}
      <div className="mt-2 flex gap-2">
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? "Sending…" : "Send to coach"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
