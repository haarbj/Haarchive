"use client";

import { useActionState, useId, useState } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { updateContributorProfile } from "./actions";
import { Button } from "@/components/ui/button";

const fieldClass = `w-full ${baseFieldClass}`;

type Props = {
  displayName: string;
  initialAvatarUrl: string;
  initialTitle: string;
  initialBio: string;
  initialExpertise: string;
};

export function ContributorProfileForm({
  displayName,
  initialAvatarUrl,
  initialTitle,
  initialBio,
  initialExpertise,
}: Props) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateContributorProfile, {});
  const [avatarPreview, setAvatarPreview] = useState(initialAvatarUrl);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className={labelClass}>Name</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{displayName}</p>
      </div>

      <div className="flex items-center gap-4">
        {avatarPreview ? (
          // Arbitrary external URL pasted by the contributor, not a local/
          // optimized asset -- next/image would need remotePatterns for
          // every possible host, so a plain <img> is the deliberate choice
          // for this MVP paste-a-URL flow.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarPreview}
            alt=""
            className="h-16 w-16 rounded-full border border-black/10 object-cover dark:border-white/10"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-black/5 dark:bg-white/10" />
        )}
        <div className="flex-1">
          <label htmlFor={`${baseId}-avatar`} className={labelClass}>
            Profile picture URL
          </label>
          <input
            id={`${baseId}-avatar`}
            name="avatarUrl"
            type="text"
            defaultValue={initialAvatarUrl}
            onChange={(e) => setAvatarPreview(e.target.value)}
            placeholder="https://…"
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${baseId}-title`} className={labelClass}>
          Title / role
        </label>
        <input
          id={`${baseId}-title`}
          name="title"
          type="text"
          defaultValue={initialTitle}
          placeholder="e.g. Elite Distance Runner"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${baseId}-bio`} className={labelClass}>
          Bio
        </label>
        <textarea id={`${baseId}-bio`} name="bio" defaultValue={initialBio} rows={4} className={fieldClass} />
      </div>

      <div>
        <label htmlFor={`${baseId}-expertise`} className={labelClass}>
          Areas of expertise
        </label>
        <input
          id={`${baseId}-expertise`}
          name="expertiseInput"
          type="text"
          defaultValue={initialExpertise}
          placeholder="Marathon training, Fueling, Recovery"
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Separate with commas.</p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
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
