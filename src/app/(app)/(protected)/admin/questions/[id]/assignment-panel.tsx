"use client";

import { useActionState, useState, useTransition } from "react";

import {
  assignQuestionCollaborators,
  promoteDraftAnswer,
  type AssignmentState,
} from "./assignment-actions";
import type { BasicUser } from "@/lib/admin/users";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AssignmentPanel({
  questionId,
  assignedTo,
  assignedReviewer,
  draftAnswer,
  users,
}: {
  questionId: string;
  assignedTo: string | null;
  assignedReviewer: string | null;
  draftAnswer: string | null;
  users: BasicUser[];
}) {
  const [state, formAction, isPending] = useActionState<AssignmentState, FormData>(
    assignQuestionCollaborators,
    {},
  );
  const [isPromoting, startPromote] = useTransition();
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoted, setPromoted] = useState(false);

  function promote() {
    setPromoted(false);
    setPromoteError(null);
    startPromote(async () => {
      const result = await promoteDraftAnswer(questionId);
      if (result.error) setPromoteError(result.error);
      else setPromoted(true);
    });
  }

  return (
    <Card padding="md" className="space-y-5">
      <p className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        Contributor collaboration
      </p>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="questionId" value={questionId} />
        <div>
          <label htmlFor="assignedTo" className={labelClass}>
            Assigned contributor
          </label>
          <select id="assignedTo" name="assignedTo" defaultValue={assignedTo ?? ""} className={fieldClass}>
            <option value="">— None —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="assignedReviewer" className={labelClass}>
            Assigned reviewer
          </label>
          <select
            id="assignedReviewer"
            name="assignedReviewer"
            defaultValue={assignedReviewer ?? ""}
            className={fieldClass}
          >
            <option value="">— None —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save assignment"}
        </Button>
      </form>
      {state.error ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p> : null}

      <div>
        <p className={labelClass}>Contributor&rsquo;s draft answer</p>
        {draftAnswer ? (
          <>
            <p className="mt-1 rounded-lg bg-black/[0.03] p-3 text-sm whitespace-pre-wrap text-zinc-700 dark:bg-white/[0.05] dark:text-zinc-200">
              {draftAnswer}
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-2" disabled={isPromoting} onClick={promote}>
              {isPromoting ? "Copying…" : "Use as public response"}
            </Button>
            {promoted ? (
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
                Copied into the public response above.
              </p>
            ) : null}
            {promoteError ? (
              <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
                {promoteError}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">No draft answer yet.</p>
        )}
      </div>
    </Card>
  );
}
