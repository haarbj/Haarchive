"use client";

import { useActionState } from "react";

import { addTagOption, removeTagOption, type TagOptionAdminState } from "./actions";
import { titleCase } from "@/lib/format";
import { fieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormError } from "@/components/ui/form-error";
import type { TagOption } from "@/lib/articles/tag-options";

export function TagOptionsPanel({ tagOptions }: { tagOptions: TagOption[] }) {
  const [state, formAction, isPending] = useActionState<TagOptionAdminState, FormData>(addTagOption, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tagOptions.length > 0 ? (
          tagOptions.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 rounded-pill border border-black/10 py-1 pr-1 pl-3 text-sm dark:border-white/10"
            >
              <span className="text-zinc-900 dark:text-white">{titleCase(tag.name)}</span>
              <ConfirmButton
                action={() => removeTagOption(tag.id)}
                confirmMessage={`Remove "${titleCase(tag.name)}" from the tag picker? Articles that already use it keep it -- this only affects what contributors can pick going forward.`}
                label="×"
                pendingLabel="…"
                className="flex h-5 w-5 items-center justify-center rounded-full text-sm font-semibold text-zinc-500 hover:bg-black/5 hover:text-red-700 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-red-400"
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No tags yet.</p>
        )}
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input
          name="name"
          type="text"
          placeholder="e.g. tapering"
          aria-label="New tag name"
          className={`${fieldClass} w-56`}
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adding…" : "Add tag"}
        </Button>
      </form>

      {state.error ? <FormError>{state.error}</FormError> : null}
    </div>
  );
}
