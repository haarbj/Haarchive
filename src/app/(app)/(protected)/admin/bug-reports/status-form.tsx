"use client";

import { useActionState } from "react";

import { updateBugReportStatus, type AdminBugReportActionState } from "./actions";
import type { BugReportStatus } from "./types";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

const STATUS_LABELS: Record<BugReportStatus, string> = {
  new: "New",
  investigating: "Investigating",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const ALL_STATUSES: BugReportStatus[] = ["new", "investigating", "resolved", "dismissed"];

// One button per *other* status, not a full 4-option control plus the
// current one -- you're always looking at where a report already is (the
// Badge next to this), so the only useful actions are the moves from here.
export function BugReportStatusForm({ id, status }: { id: string; status: BugReportStatus }) {
  const [state, formAction, isPending] = useActionState<AdminBugReportActionState, FormData>(
    updateBugReportStatus,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {ALL_STATUSES.filter((candidate) => candidate !== status).map((candidate) => (
        <Button key={candidate} type="submit" name="status" value={candidate} variant="outline" size="sm" disabled={isPending}>
          Mark {STATUS_LABELS[candidate].toLowerCase()}
        </Button>
      ))}
      {state.error ? <FormError as="span">{state.error}</FormError> : null}
    </form>
  );
}
