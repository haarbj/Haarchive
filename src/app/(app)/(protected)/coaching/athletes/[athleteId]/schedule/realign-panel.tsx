"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { formatDate } from "@/lib/format";
import { formatMiles } from "@/lib/format";
import { MILE_METERS } from "@/lib/race-distances";
import type { RealignmentEntry } from "@/lib/private-coaching/plan-realignment";
import type { RealignmentEntryOverride, RealignmentProposalRow } from "@/lib/private-coaching/realignment-service";
import { acceptRealignment, dismissRealignment, initiateRealignment, loadRealignmentProposals } from "./realignment-actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// The consent card for Plan Realignment: a coach sees exactly what the
// rules engine (plan-realignment.ts) proposes for the week after a
// disruption, can tweak any entry inline before deciding, and must
// explicitly Accept or Dismiss -- nothing on scheduled_workouts changes
// until Accept, and Accept always applies whatever is currently shown
// here (the engine's own proposal, or a coach's edited values), never a
// stale copy. Same "fetch on mount, render nothing when there's nothing
// to show" shape as PlanHealthPanel/MultiCyclePanel.
export function RealignPanel({ athleteId }: { athleteId: string }) {
  const router = useRouter();
  const [proposals, setProposals] = useState<RealignmentProposalRow[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRealignmentProposals(athleteId).then((result) => {
      if (!cancelled) setProposals(result);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  if (proposals === null) return null;

  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const decidedProposals = proposals.filter((p) => p.status !== "pending");

  async function handleInitiate() {
    setFormError(null);
    if (!startDate || !endDate) {
      setFormError("Pick both a start and end date.");
      return;
    }
    setPending(true);
    const result = await initiateRealignment(athleteId, { startDate, endDate }, note || null);
    setPending(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setFormOpen(false);
    setStartDate("");
    setEndDate("");
    setNote("");
    setProposals(await loadRealignmentProposals(athleteId));
    router.refresh();
  }

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Plan Realignment</p>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          {formOpen ? "Cancel" : "Realign training"}
        </button>
      </div>

      {formOpen ? (
        <div className="mt-3 space-y-2 rounded-control border border-black/10 p-3 dark:border-white/10">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            When was this athlete unable to train? The coming week gets revised around the return -- nothing changes until you accept it below.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Disruption start date"
              className="rounded-control border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="Disruption end date"
              className="rounded-control border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
            />
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note -- sick, travel, etc."
            className="w-full rounded-control border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
          />
          {formError ? <p className="text-xs text-accent-error">{formError}</p> : null}
          <Button type="button" onClick={handleInitiate} disabled={pending}>
            {pending ? "Proposing…" : "Propose realignment"}
          </Button>
        </div>
      ) : null}

      {pendingProposals.length === 0 && decidedProposals.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">No realignments proposed yet.</p>
      ) : null}

      <div className="mt-3 space-y-4">
        {pendingProposals.map((proposal) => (
          <ProposalCard key={proposal.id} athleteId={athleteId} proposal={proposal} onDecided={() => loadRealignmentProposals(athleteId).then(setProposals)} />
        ))}
      </div>

      {decidedProposals.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">History</p>
          <div className="mt-2 space-y-1.5">
            {decidedProposals.map((proposal) => (
              <p key={proposal.id} className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDate(proposal.disruption_start_date)} – {formatDate(proposal.disruption_end_date)}:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-200">{proposal.status}</span>
                {proposal.decided_at ? ` on ${formatDate(proposal.decided_at.slice(0, 10))}` : ""} ·{" "}
                {proposal.triggered_by === "athlete" ? "athlete-flagged" : "coach-initiated"}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function metersToMiles(m: number | null): string {
  return m == null ? "" : (m / MILE_METERS).toFixed(1);
}

function milesToMeters(input: string): number | null {
  const n = Number(input);
  return input.trim() === "" || Number.isNaN(n) ? null : Math.round(n * MILE_METERS);
}

function ProposalCard({
  athleteId,
  proposal,
  onDecided,
}: {
  athleteId: string;
  proposal: RealignmentProposalRow;
  onDecided: () => void;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, RealignmentEntryOverride>>({});
  const [pending, setPending] = useState<"accept" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changed = proposal.proposal.entries.filter((e) => e.changeKind !== "unchanged");

  function currentValuesFor(entry: RealignmentEntry): RealignmentEntryOverride {
    return overrides[entry.original.id] ?? { proposedDate: entry.proposedDate, proposedDistanceM: entry.proposedDistanceM, proposedDurationS: entry.proposedDurationS };
  }

  async function handleAccept() {
    setPending("accept");
    setError(null);
    const result = await acceptRealignment(athleteId, proposal.id, overrides);
    setPending(null);
    if (result.error) return setError(result.error);
    onDecided();
    router.refresh();
  }

  async function handleDismiss() {
    setPending("dismiss");
    setError(null);
    const result = await dismissRealignment(athleteId, proposal.id);
    setPending(null);
    if (result.error) return setError(result.error);
    onDecided();
  }

  return (
    <div className="rounded-control border border-black/10 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          Disruption {formatDate(proposal.disruption_start_date)} – {formatDate(proposal.disruption_end_date)}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {proposal.triggered_by === "athlete" ? "Flagged by athlete" : "Initiated by you"}
          {proposal.disruption_note ? ` · "${proposal.disruption_note}"` : ""}
        </p>
      </div>

      {proposal.proposal.hasProtectedDrop ? (
        <p className="mt-2 rounded-control border border-black/10 bg-black/[0.03] p-2 text-xs font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200">
          A key session or the long run had no safe day in this window and was dropped -- see below.
        </p>
      ) : null}

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Week {formatDate(proposal.proposal.horizonStart)} – {formatDate(proposal.proposal.horizonEnd)} · Planned{" "}
        {formatMiles(proposal.proposal.originalLoadM)} → Proposed {formatMiles(proposal.proposal.proposedLoadM)}
      </p>

      <div className="mt-3 space-y-2">
        {changed.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No changes needed -- the week already holds up.</p>
        ) : (
          changed.map((entry) => {
            const values = currentValuesFor(entry);
            const isEditing = editingId === entry.original.id;
            return (
              <div key={entry.original.id} className="rounded-control border border-black/10 p-2 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p>
                    <span className="text-zinc-500 dark:text-zinc-400">{entry.original.dayLabel ?? "Workout"} · </span>
                    <span className="text-zinc-900 dark:text-white">{formatDate(entry.original.scheduledDate)}</span>
                    <span className="text-zinc-400 dark:text-zinc-500"> → </span>
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {entry.changeKind === "dropped" ? "dropped" : formatDate(values.proposedDate)}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    {entry.flagged ? <Badge tone="neutral">Dropped key session</Badge> : <Badge tone="neutral">{entry.changeKind}</Badge>}
                    {entry.changeKind !== "dropped" ? (
                      <button
                        type="button"
                        onClick={() => setEditingId(isEditing ? null : entry.original.id)}
                        className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
                      >
                        {isEditing ? "Done" : "Edit"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {entry.reason ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{entry.reason}</p> : null}

                {isEditing ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">
                      Date
                      <input
                        type="date"
                        value={values.proposedDate}
                        onChange={(e) =>
                          setOverrides((prev) => ({ ...prev, [entry.original.id]: { ...values, proposedDate: e.target.value } }))
                        }
                        className="mt-0.5 block rounded-control border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
                      />
                    </label>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">
                      Distance (mi)
                      <input
                        type="text"
                        inputMode="decimal"
                        value={metersToMiles(values.proposedDistanceM)}
                        onChange={(e) =>
                          setOverrides((prev) => ({
                            ...prev,
                            [entry.original.id]: { ...values, proposedDistanceM: milesToMeters(e.target.value) },
                          }))
                        }
                        placeholder="optional"
                        className="mt-0.5 block w-24 rounded-control border border-black/10 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

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
    </div>
  );
}
