"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { RACE_DISTANCES } from "@/lib/race-distances";
import { updateCommunityProfile } from "./actions";
import { uploadAvatarImage } from "@/app/(app)/(protected)/settings/avatar-actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImageUrlField } from "@/components/ui/image-url-field";

const fieldClass = `w-full ${baseFieldClass}`;

type CommunityProfileFormProps = {
  userId: string;
  hasProfile: boolean;
  initialAvatarUrl: string;
  initialBio: string;
  initialLocation: string;
  initialFavoriteDistances: string[];
};

export function CommunityProfileForm({
  userId,
  hasProfile,
  initialAvatarUrl,
  initialBio,
  initialLocation,
  initialFavoriteDistances,
}: CommunityProfileFormProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateCommunityProfile, {});
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor={`${baseId}-avatar`} className={labelClass}>
          Profile picture
        </label>
        <ImageUrlField
          inputId={`${baseId}-avatar`}
          value={avatarUrl}
          onChange={setAvatarUrl}
          uploadAction={uploadAvatarImage}
          placeholder="https://…"
        />
        <input type="hidden" name="avatarUrl" value={avatarUrl} />
      </div>

      <div>
        <label htmlFor={`${baseId}-bio`} className={labelClass}>
          Bio
        </label>
        <textarea
          id={`${baseId}-bio`}
          name="bio"
          rows={4}
          maxLength={1000}
          defaultValue={initialBio}
          placeholder="Your running background, how you got into it, what you're chasing next..."
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${baseId}-location`} className={labelClass}>
          Location
        </label>
        <input
          id={`${baseId}-location`}
          name="location"
          type="text"
          maxLength={100}
          defaultValue={initialLocation}
          placeholder="e.g. Portland, OR"
          className={fieldClass}
        />
      </div>

      <div>
        <p className={labelClass}>Favorite distances</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {RACE_DISTANCES.map((d) => (
            <label key={d.key} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
              <input
                type="checkbox"
                name="favoriteDistances"
                value={d.key}
                defaultChecked={initialFavoriteDistances.includes(d.key)}
                className="h-4 w-4 rounded border-black/20 dark:border-white/20"
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      {state.error && <FormError>{state.error}</FormError>}
      {state.success && (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {hasProfile && (
          <Link
            href={`/community/${userId}`}
            className="text-sm font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white"
          >
            View how this looks to others →
          </Link>
        )}
      </div>
    </form>
  );
}
