"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { approveClubIntakeSubmission, waitlistClubIntakeSubmission, setCoachAthleteTier, type ClubIntakeQueueRow } from "./actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

const STATUS_TONE = {
  pending: "neutral",
  approved: "success",
  waitlisted: "warning",
  redirected_not_ready: "error",
} as const;

function formatMinutes(seconds: number | null): string {
  if (seconds == null) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function QueueTable({ rows }: { rows: ClubIntakeQueueRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
                <p className="font-semibold text-zinc-900 dark:text-white">{row.athleteName}</p>
                <Badge tone={STATUS_TONE[row.status]}>{row.status.replace(/_/g, " ")}</Badge>
                {row.readinessFail ? <Badge tone="error">Below readiness line</Badge> : null}
                {row.injuryHistory ? <Badge tone="warning">Injury/illness history</Badge> : null}
                {row.interested1on1 ? <Badge tone="research">1-on-1 interest</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {row.currentWeeklyMileage} mi/week &middot; {row.yearsRunning} yr running &middot; {row.plansCompleted} plan(s) completed
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Goal: {row.goalType === "time" ? `Time target (${formatMinutes(row.goalTimeS)})` : "Finish"}
                {row.raceName ? ` · 5K reference: ${row.raceName} (${formatMinutes(row.finishTimeS)})` : row.plansTimeTrial ? " · Will use team time trial" : ""}
              </p>
              {row.proposedFrameworkKey ? (
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                  Proposed: {row.proposedFrameworkKey} &middot; ~{row.proposedPeakMileage} mi/week peak
                </p>
              ) : null}
              {row.injuryHistory ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Injury notes: {row.injuryHistory}</p> : null}
              {row.wtpBracket ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">WTP bracket: {row.wtpBracket}</p> : null}
            </div>

            {row.status === "pending" ? (
              <div className="flex gap-2">
                <Button size="sm" disabled={pendingId === row.id} onClick={() => handle(row.id, approveClubIntakeSubmission)}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" disabled={pendingId === row.id} onClick={() => handle(row.id, waitlistClubIntakeSubmission)}>
                  Waitlist
                </Button>
              </div>
            ) : null}
            {row.status === "approved" && row.coachAthleteId ? (
              <div className="flex items-center gap-2">
                <Badge tone={row.tier === "paid" ? "success" : "neutral"}>{row.tier === "paid" ? "Paid 1-on-1" : "Free Club Plan"}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId === row.id}
                  onClick={() =>
                    handle(row.id, () => setCoachAthleteTier(row.coachAthleteId!, row.tier === "paid" ? "free" : "paid"))
                  }
                >
                  {row.tier === "paid" ? "Move to free" : "Mark as paid 1-on-1"}
                </Button>
              </div>
            ) : null}
          </div>
          {errors[row.id] ? <FormError className="mt-3">{errors[row.id]}</FormError> : null}
        </Card>
      ))}
    </div>
  );
}
