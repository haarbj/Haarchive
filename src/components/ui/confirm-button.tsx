"use client";

import { useTransition } from "react";

type ConfirmButtonProps = {
  action: () => Promise<unknown> | void;
  confirmMessage: string;
  label: string;
  pendingLabel: string;
  className?: string;
};

// The "if (window.confirm(...)) startTransition(() => action())" pattern,
// centralized -- previously reimplemented slightly differently (or skipped
// entirely) across every destructive-action button in the app. Routing all
// of them through here means no future delete/remove/revoke button can
// silently ship without a confirmation step.
export function ConfirmButton({ action, confirmMessage, label, pendingLabel, className }: ConfirmButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
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
