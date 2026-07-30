"use client";

import { useActionState } from "react";

import { addAthleteToRoster } from "./actions";
import { fieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export function AddAthleteForm() {
  const [state, formAction, isPending] = useActionState(addAthleteToRoster, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="athlete-email" className="mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          Athlete&rsquo;s email
        </label>
        <input
          id="athlete-email"
          name="email"
          type="email"
          placeholder="athlete@example.com"
          required
          className={`${fieldClass} w-72`}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add to roster"}
      </Button>
      {state.error && <FormError className="w-full">{state.error}</FormError>}
      {state.success && (
        <p role="status" className="w-full text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Added.
        </p>
      )}
    </form>
  );
}
