"use client";

import { useState, useTransition } from "react";

type InlineConfirmButtonProps = {
  action: () => Promise<unknown> | void;
  confirmMessage: string;
  label: string;
  pendingLabel: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  ariaLabel?: string;
};

// Same role as ConfirmButton (centralizing an "are you sure" step before a
// destructive action), but confirms inline in the page instead of via
// window.confirm(). A native confirm() dialog lives outside the DOM --
// invisible to Playwright and any other automated browser driver -- so any
// destructive flow that needs to be exercised end-to-end in a test uses
// this instead. Not a replacement for ConfirmButton everywhere; just the
// option for call sites where that matters.
export function InlineConfirmButton({
  action,
  confirmMessage,
  label,
  pendingLabel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  className,
  ariaLabel,
}: InlineConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" aria-label={ariaLabel} onClick={() => setConfirming(true)} className={className}>
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <span className="text-zinc-600 dark:text-zinc-300">{confirmMessage}</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await action();
            setConfirming(false);
          })
        }
        className="font-semibold text-accent-error underline underline-offset-2 disabled:opacity-50"
      >
        {isPending ? pendingLabel : confirmLabel}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirming(false)}
        className="font-semibold text-zinc-500 underline underline-offset-2 disabled:opacity-50 dark:text-zinc-400"
      >
        {cancelLabel}
      </button>
    </span>
  );
}
