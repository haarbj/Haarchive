"use client";

import { useTransition } from "react";

type ConfirmButtonProps = {
  action: () => Promise<unknown> | void;
  confirmMessage: string;
  label: string;
  pendingLabel: string;
  className?: string;
  // Overrides the accessible name while `label` still renders as the
  // visible text -- for a caller that renders several identical-looking
  // ConfirmButtons at once (e.g. one "Delete" per note in a list), where a
  // screen reader user tabbing through would otherwise hear the same
  // undifferentiated "Delete, button" repeated with no way to tell them
  // apart. Must still contain the visible label text somewhere (WCAG 2.5.3
  // Label in Name) -- callers are responsible for that, this doesn't
  // enforce it.
  ariaLabel?: string;
};

// The "if (window.confirm(...)) startTransition(() => action())" pattern,
// centralized -- previously reimplemented slightly differently (or skipped
// entirely) across every destructive-action button in the app. Routing all
// of them through here means no future delete/remove/revoke button can
// silently ship without a confirmation step.
export function ConfirmButton({ action, confirmMessage, label, pendingLabel, className, ariaLabel }: ConfirmButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-label={ariaLabel}
      onClick={() => {
        if (window.confirm(confirmMessage)) {
          startTransition(async () => {
            await action();
          });
        }
      }}
      className={className}
    >
      {isPending ? pendingLabel : label}
    </button>
  );
}
