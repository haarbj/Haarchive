"use client";

import { useTransition } from "react";

import { deleteContactMessage } from "./actions";

export function DeleteMessageButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (window.confirm("Delete this message? This can't be undone.")) {
          startTransition(() => deleteContactMessage(id));
        }
      }}
      className="text-sm font-semibold text-red-700 underline decoration-red-700/30 underline-offset-2 hover:decoration-red-700 disabled:opacity-50 dark:text-red-400 dark:decoration-red-400/30 dark:hover:decoration-red-400"
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
