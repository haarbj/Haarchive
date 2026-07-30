"use client";

import { useActionState } from "react";

import { createGroup } from "@/app/(app)/(protected)/coach/groups-actions";
import { fieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export function CreateGroupForm() {
  const [state, formAction, isPending] = useActionState(createGroup, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="group-name" className="mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          New group name
        </label>
        <input
          id="group-name"
          name="name"
          type="text"
          placeholder="e.g. Varsity Boys"
          required
          className={`${fieldClass} w-64`}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create group"}
      </Button>
      {state.error && <FormError className="w-full">{state.error}</FormError>}
    </form>
  );
}
