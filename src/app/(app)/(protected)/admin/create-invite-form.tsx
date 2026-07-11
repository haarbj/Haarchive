"use client";

import { useActionState, useState } from "react";

import { createCoachInvite } from "./actions";

const fieldClass =
  "rounded-lg border border-black/10 bg-white px-4 py-2.5 text-base text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";

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
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
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
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Creating…" : "Create invite"}
        </button>
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
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
