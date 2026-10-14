"use client";

import { useActionState, useEffect, useState } from "react";

import { inviteAthlete } from "./actions";
import { ROSTER_CHANGED_EVENT } from "./roster-events";
import { fieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export function InviteAthleteForm() {
  const [state, formAction, isPending] = useActionState(inviteAthlete, {});
  const [copied, setCopied] = useState(false);
  // state.inviteUrl is local component state -- nothing about it knows
  // when that invite gets accepted, revoked, or (once accepted) the
  // resulting athlete later removed from the roster elsewhere on this same
  // page, since those all happen through sibling components and only
  // revalidate the server-rendered lists, not this form's own client
  // state. Left alone, the "send this link" card would keep showing a
  // long-dead link indefinitely. Dismissible manually, and reset back to
  // visible on every genuinely new invite -- tracked by comparing against
  // the last-seen inviteUrl during render (React's own recommended
  // "adjusting state when a prop changes" pattern) rather than a
  // useEffect, which would set state one render late and trigger an extra
  // cascading re-render for no benefit here.
  const [dismissed, setDismissed] = useState(false);
  const [lastSeenInviteUrl, setLastSeenInviteUrl] = useState(state.inviteUrl);
  if (state.inviteUrl !== lastSeenInviteUrl) {
    setLastSeenInviteUrl(state.inviteUrl);
    if (state.inviteUrl) setDismissed(false);
  }

  // Revoking a pending invite or removing an accepted athlete elsewhere on
  // this same page means whatever link this card is showing is no longer
  // worth sending, even though it's a separate mounted component with no
  // props connecting it to those actions -- see roster-events.ts for why
  // this is a DOM event rather than lifted state/context.
  useEffect(() => {
    function handleRosterChanged() {
      setDismissed(true);
    }
    window.addEventListener(ROSTER_CHANGED_EVENT, handleRosterChanged);
    return () => window.removeEventListener(ROSTER_CHANGED_EVENT, handleRosterChanged);
  }, []);

  async function handleCopy() {
    if (!state.inviteUrl) return;
    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="athlete-invite-email"
            className="mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300"
          >
            Athlete&rsquo;s email
          </label>
          <input
            id="athlete-invite-email"
            name="email"
            type="email"
            placeholder="athlete@example.com"
            required
            className={`${fieldClass} w-72`}
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Inviting…" : "Invite athlete"}
        </Button>
      </form>

      {state.error && <FormError className="mt-3">{state.error}</FormError>}

      {state.inviteUrl && !dismissed && (
        <div className="mt-3 rounded-lg bg-black/[0.03] p-3 dark:bg-white/[0.05]">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              Send this link to your athlete: it&rsquo;s single-use and only works with the email above.
            </p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="-mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
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
    </div>
  );
}
