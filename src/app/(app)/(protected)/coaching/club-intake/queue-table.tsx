"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { approveClubIntakeSubmission, setCoachAthleteTier, setPaidWaitlisted, type ClubIntakeQueueRow } from "./actions";
import { CLUB_INTAKE_WTP_LABELS } from "@/lib/validation/club-intake";
import { formatClock } from "@/lib/running-format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// "waitlisted" stays in the type (an old enum value this app no longer
// writes -- see the paid-waitlist migration) but still needs a tone in
// case a row from before that change is ever read.
const STATUS_TONE = {
  pending: "neutral",
  approved: "success",
  waitlisted: "warning",
  redirected_not_ready: "error",
} as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function QueueTable({ rows }: { rows: ClubIntakeQueueRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // revalidatePath (in the server actions) only invalidates the ROUTER
  // CACHE for the next navigation -- it doesn't retroactively update this
  // already-mounted client component's own `rows` prop. router.refresh()
  // re-runs the page's Server Component and passes fresh rows back down,
  // so Approve/Waitlist/tier changes show up immediately instead of only
  // after a manual reload.
  function handle(id: string, action: (id: string) => Promise<{ error?: string }>) {
    setPendingId(id);
    startTransition(async () => {
      const result = await action(id);
      setErrors((prev) => ({ ...prev, [id]: result.error ?? "" }));
      setPendingId(null);
      if (!result.error) router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No submissions yet.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card key={row.id} padding="md">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1 font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/20 dark:hover:decoration-white"
                  aria-expanded={expandedId === row.id}
                  onClick={() => setExpandedId((current) => (current === row.id ? null : row.id))}
                >
                  {row.athleteName}
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${expandedId === row.id ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <Badge tone={STATUS_TONE[row.status]}>{row.status.replace(/_/g, " ")}</Badge>
                {row.readinessFail ? <Badge tone="error">Below readiness line</Badge> : null}
                {row.injuryHistory ? <Badge tone="warning">Injury/illness history</Badge> : null}
                {row.interested1on1 ? <Badge tone="research">1-on-1 interest</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {row.currentWeeklyMileage} mi/week &middot; {row.yearsRunning} yr running &middot; {row.plansCompleted} plan(s) completed
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Goal: {row.goalType === "time" && row.goalTimeS != null ? `Time target (${formatClock(row.goalTimeS)})` : "Finish"}
                {row.raceName && row.finishTimeS != null
                  ? ` · 5K reference: ${row.raceName} (${formatClock(row.finishTimeS)})`
                  : row.plansTimeTrial
                    ? " · Will use team time trial"
                    : ""}
              </p>
              {row.proposedFrameworkKey ? (
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                  Proposed: {row.proposedFrameworkKey} &middot; ~{row.proposedPeakMileage} mi/week peak
                </p>
              ) : null}
              {row.injuryHistory ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Injury notes: {row.injuryHistory}</p> : null}
              {row.wtpBracket ? (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Willingness to pay: {CLUB_INTAKE_WTP_LABELS[row.wtpBracket as keyof typeof CLUB_INTAKE_WTP_LABELS] ?? row.wtpBracket}
                </p>
              ) : null}
            </div>

            {/* Step 1: free Club Plan approval. The readiness gate is
                advisory (see club-intake.ts's own header comment) -- not
                meeting the mileage line routes a submission to
                redirected_not_ready by default, but the coach still has
                final say. Everyone gets manually approved or not for
                free; there is no "waitlist" at this step. */}
            {row.status !== "approved" ? (
              <Button size="sm" disabled={pendingId === row.id} onClick={() => handle(row.id, approveClubIntakeSubmission)}>
                Approve for free Club Plan
              </Button>
            ) : null}

            {/* Step 2: paid 1-on-1, a separate decision that only applies
                once free-approved AND the athlete expressed interest.
                Reversible both directions, and happens "a while later"
                once price/capacity are set -- nothing here is meant to
                be decided the same day as step 1. */}
            {row.status === "approved" && row.coachAthleteId && row.interested1on1 ? (
              <div className="flex flex-col items-end gap-2">
                <Badge tone={row.tier === "paid" ? "success" : row.paidWaitlisted ? "warning" : "neutral"}>
                  {row.tier === "paid" ? "Paid 1-on-1" : row.paidWaitlisted ? "Waitlisted for paid" : "Free (interested in paid)"}
                </Badge>
                <div className="flex gap-2">
                  {row.tier === "paid" ? (
                    <Button size="sm" variant="outline" disabled={pendingId === row.id} onClick={() => handle(row.id, () => setCoachAthleteTier(row.coachAthleteId!, "free"))}>
                      Move to free
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" disabled={pendingId === row.id} onClick={() => handle(row.id, () => setCoachAthleteTier(row.coachAthleteId!, "paid"))}>
                        Select for paid
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === row.id}
                        onClick={() => handle(row.id, () => setPaidWaitlisted(row.coachAthleteId!, !row.paidWaitlisted))}
                      >
                        {row.paidWaitlisted ? "Remove from waitlist" : "Waitlist for paid"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : row.status === "approved" && row.coachAthleteId ? (
              <Badge tone="neutral">Free Club Plan</Badge>
            ) : null}
          </div>
          {expandedId === row.id ? (
            <div className="mt-4 space-y-1 border-t border-black/10 pt-4 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-300">
              <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Full response</p>
              <p>Submitted: {formatDateTime(row.createdAt)}</p>
              <p>Race date: {row.raceDate ?? "not provided"}</p>
              <p>School email: {row.schoolEmail ?? "not provided"}</p>
              <p>
                Coaching agreement:{" "}
                {row.interested1on1 ? "all four boxes checked (required to express 1-on-1 interest)." : "not applicable (no 1-on-1 interest)."}
              </p>
            </div>
          ) : null}
          {errors[row.id] ? <FormError className="mt-3">{errors[row.id]}</FormError> : null}
        </Card>
      ))}
    </div>
  );
}
