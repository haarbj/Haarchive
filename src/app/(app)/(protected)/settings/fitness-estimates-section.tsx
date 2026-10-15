"use client";

import { useActionState, useEffect, useId, useState } from "react";

import { formatClock } from "@/lib/running-format";
import { formatDate } from "@/lib/format";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { updateFitnessEstimate, deleteFitnessEstimate } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormError } from "@/components/ui/form-error";

const fieldClass = `w-full ${baseFieldClass}`;

export type FitnessEstimateRow = { referenceKey: "5k" | "marathon"; estimatedTimeS: number; updatedAt: string };

const DISTANCE_LABELS: Record<"5k" | "marathon", string> = { "5k": "5K", marathon: "Marathon" };

function EstimateForm({
  referenceKey,
  existing,
  onSaved,
}: {
  referenceKey: "5k" | "marathon";
  existing: FitnessEstimateRow | undefined;
  onSaved: () => void;
}) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateFitnessEstimate, {});

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <Card padding="sm" shadow={false}>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="referenceKey" value={referenceKey} />
        <label htmlFor={`${baseId}-time`} className="flex-1">
          <span className={labelClass}>{DISTANCE_LABELS[referenceKey]} estimate</span>
          <input
            id={`${baseId}-time`}
            name="estimatedTimeInput"
            type="text"
            defaultValue={existing ? formatClock(existing.estimatedTimeS) : ""}
            placeholder="mm:ss or h:mm:ss"
            autoComplete="off"
            required
            className={fieldClass}
          />
        </label>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        {state.error && <FormError>{state.error}</FormError>}
      </form>
    </Card>
  );
}

function EstimateRow({ referenceKey, existing }: { referenceKey: "5k" | "marathon"; existing: FitnessEstimateRow | undefined }) {
  const [editing, setEditing] = useState(!existing);

  if (editing) {
    return <EstimateForm referenceKey={referenceKey} existing={existing} onSaved={() => setEditing(false)} />;
  }

  return (
    <Card padding="sm" shadow={false} className="flex items-center justify-between gap-3 text-sm">
      <div>
        <span className="font-medium text-zinc-900 dark:text-white">{DISTANCE_LABELS[referenceKey]}: </span>
        <span className="text-zinc-600 dark:text-zinc-300">
          {formatClock(existing!.estimatedTimeS)} · updated {formatDate(existing!.updatedAt)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Update
        </button>
        <ConfirmButton
          action={() => deleteFitnessEstimate(referenceKey)}
          confirmMessage={`Clear your ${DISTANCE_LABELS[referenceKey]} estimate? Any percent-of-pace workout that resolves from it goes back to a prose-only prescription until you set a new one.`}
          label="Clear"
          pendingLabel="Clearing…"
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        />
      </div>
    </Card>
  );
}

// Your own CURRENT fitness estimate -- distinct from a race result (see
// athlete_fitness_estimates' own migration comment): a self-reported "I
// think I could run this right now" number, not a completed, dated race.
// This is what any coach-assigned program's percent-of-pace prescription
// (e.g. "90-92% MP") resolves against, live, every time your schedule is
// read -- updating it here is reflected in every workout you haven't
// completed yet, automatically, without touching anything you've already
// done.
export function FitnessEstimatesSection({ estimates }: { estimates: FitnessEstimateRow[] }) {
  const byKey = new Map(estimates.map((e) => [e.referenceKey, e]));

  return (
    <div className="space-y-3">
      <EstimateRow referenceKey="5k" existing={byKey.get("5k")} />
      <EstimateRow referenceKey="marathon" existing={byKey.get("marathon")} />
      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Some of your coach&rsquo;s training programs prescribe workouts as a percent of your 5K or marathon pace (e.g.
        &ldquo;90-92% marathon pace&rdquo;) -- these resolve into a real pace using whatever you&rsquo;ve set here, and stay
        prose-only until you do.
      </p>
    </div>
  );
}
