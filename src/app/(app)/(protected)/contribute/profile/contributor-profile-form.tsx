"use client";

import { useActionState, useId, useState } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { updateContributorProfile } from "./actions";
import { uploadAvatarImage } from "@/app/(app)/(protected)/settings/avatar-actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImageUrlField } from "@/components/ui/image-url-field";

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

      <div>
        <label htmlFor={`${baseId}-avatar`} className={labelClass}>
          Profile picture
        </label>
        <ImageUrlField
          inputId={`${baseId}-avatar`}
          value={avatarPreview}
          onChange={setAvatarPreview}
          uploadAction={uploadAvatarImage}
          placeholder="https://…"
        />
        <input type="hidden" name="avatarUrl" value={avatarPreview} />
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

      {state.error && <FormError>{state.error}</FormError>}
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
