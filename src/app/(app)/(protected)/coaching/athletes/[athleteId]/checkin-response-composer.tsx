"use client";

import { useActionState, useRef, useState } from "react";

import { sendCoachAthleteMessage, type SendMessageState } from "../../messages/actions";
import type { CheckinPraiseCandidate } from "@/lib/private-coaching/checkin-praise";
import { insertTextAtCursor } from "@/lib/insert-at-cursor";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// Wooden's principle, mechanically: the platform surfaces specific,
// earned facts; the coach supplies the sincerity. A candidate is never
// auto-inserted (nothing runs on mount) and never auto-sent -- tapping a
// chip only ever edits this textarea's own value, the same box the coach
// can freely type into, edit, or clear. Whatever is actually sent is sent
// through the site's existing coach<->athlete messaging pipeline
// (sendCoachAthleteMessage), not a new storage path -- this component
// only assists what goes into that one existing textbox.
export function CheckinResponseComposer({
  coachAthleteId,
  candidates,
}: {
  coachAthleteId: string;
  candidates: CheckinPraiseCandidate[];
}) {
  const [text, setText] = useState("");
  const [state, formAction, isPending] = useActionState<SendMessageState, FormData>(sendCoachAthleteMessage.bind(null, coachAthleteId), {});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clearing the textarea once a send actually finishes successfully is
  // "adjusting state during render" per React's own guidance for this
  // exact shape (synchronizing local state to a prop/state value that
  // changed), deliberately not a hook-based side effect -- `state` is a
  // new object only when the action itself just resolved, never on an
  // unrelated re-render, so comparing identity against the last-seen one
  // is a safe, one-time trigger. MessageThread's own composer achieves
  // the same "clear after send" with formRef.current.reset() on an
  // uncontrolled field; this textarea has to be controlled instead, since
  // insertCandidate needs to read and write its value directly.
  const [handledState, setHandledState] = useState(state);
  const [justSent, setJustSent] = useState(false);
  if (state !== handledState) {
    setHandledState(state);
    if (!state.error) {
      setText("");
      setJustSent(true);
    }
  }

  // Inserts at the cursor when the textarea has a real, known selection;
  // otherwise appends -- the composer's own fallback behavior per the
  // task's own allowance, not a second insertion convention.
  function insertCandidate(candidateText: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const { text: next, cursor } = insertTextAtCursor(text, candidateText, start, end);
    setText(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="mt-4">
      {candidates.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => insertCandidate(candidate.text)}
              className="rounded-pill border border-black/10 bg-black/[0.02] px-3 py-1.5 text-left text-xs text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:bg-white/10"
              title="Add to response"
            >
              {candidate.text}
            </button>
          ))}
        </div>
      ) : null}
      <form action={formAction} className="flex items-start gap-2">
        <textarea
          ref={textareaRef}
          name="body"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setJustSent(false);
          }}
          rows={3}
          placeholder="Respond to this check-in…"
          className="min-w-0 flex-1 rounded-control border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
        />
        <Button type="submit" size="sm" disabled={isPending || text.trim().length === 0}>
          {isPending ? "Sending…" : "Send"}
        </Button>
      </form>
      {state.error ? <FormError className="mt-2">{state.error}</FormError> : null}
      {justSent ? <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Sent.</p> : null}
    </div>
  );
}
