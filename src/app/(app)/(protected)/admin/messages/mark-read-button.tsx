"use client";

import { useActionState } from "react";

import { markContactMessageRead, type AdminMessageActionState } from "./actions";
import { Button } from "@/components/ui/button";

export function MarkReadButton({ id, read }: { id: string; read: boolean }) {
  const [state, formAction, isPending] = useActionState<AdminMessageActionState, FormData>(
    markContactMessageRead,
    {},
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="read" value={String(!read)} />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {read ? "Mark unread" : "Mark read"}
      </Button>
      {state.error ? (
        <span role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
