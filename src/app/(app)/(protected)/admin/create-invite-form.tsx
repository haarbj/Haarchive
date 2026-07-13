"use client";

import { useActionState, useState } from "react";

import { fieldClass } from "@/lib/form-styles";
import { createCoachInvite } from "./actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CreateInviteForm() {
  const [state, formAction, isPending] = useActionState(createCoachInvite, {});
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!state.inviteUrl) return;
    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card padding="md">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">Invite a coach</p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="invite-email" className="mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Coach&rsquo;s @brophyprep.org email
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            placeholder="oscar@brophyprep.org"
            required
            className={`${fieldClass} w-72`}
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create invite"}
        </Button>
      </form>

      {state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}

      {state.inviteUrl && (
        <div className="mt-3 rounded-lg bg-black/[0.03] p-3 dark:bg-white/[0.05]">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Send this link to the coach — it&rsquo;s single-use and only works with the email above.
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-black/5 px-2 py-1 text-xs text-zinc-900 dark:bg-white/10 dark:text-white">
              {state.inviteUrl}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
