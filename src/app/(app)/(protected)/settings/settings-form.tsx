"use client";

import { useActionState, useId } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

const fieldClass = `w-full ${baseFieldClass}`;

type SettingsFormProps = {
  initialDisplayName: string;
  initialUnits: "mi" | "km";
  initialEmailUnsubscribed: boolean;
  email: string;
};

export function SettingsForm({ initialDisplayName, initialUnits, initialEmailUnsubscribed, email }: SettingsFormProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateProfile, {});

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className={labelClass}>Email</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{email}</p>
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        {/* Lets the action tell "still checked, nothing changed" apart from
            "just checked it" -- without this, re-saving the form for an
            unrelated field (display name, units) would stamp a fresh
            email_unsubscribed_at every time, erasing the real original
            unsubscribe date (or one an admin set from /admin/users). */}
        <input type="hidden" name="wasEmailUnsubscribed" value={initialEmailUnsubscribed ? "true" : "false"} />
        <input
          type="checkbox"
          name="emailUnsubscribed"
          defaultChecked={initialEmailUnsubscribed}
          className="mt-0.5 accent-zinc-900 dark:accent-white"
        />
        <span>
          Don&rsquo;t email me about new articles, tools, or site updates
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            The Haarchive doesn&rsquo;t send automated emails today -- this only controls whether you&rsquo;d be
            included if that ever changes.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor={`${baseId}-display-name`} className={labelClass}>
          Display name
        </label>
        <input
          id={`${baseId}-display-name`}
          name="displayName"
          type="text"
          defaultValue={initialDisplayName}
          required
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${baseId}-units`} className={labelClass}>
          Units
        </label>
        <select
          id={`${baseId}-units`}
          name="units"
          defaultValue={initialUnits}
          className={fieldClass}
        >
          <option value="mi">Miles</option>
          <option value="km">Kilometers</option>
        </select>
      </div>

      {state.error && (
        <FormError>{state.error}</FormError>
      )}
      {state.success && (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
