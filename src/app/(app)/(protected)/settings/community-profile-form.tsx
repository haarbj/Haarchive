"use client";

import { useId, useState } from "react";
import Link from "next/link";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { useAutoSaveForm } from "@/lib/use-auto-save-form";
import { RACE_DISTANCES } from "@/lib/race-distances";
import { updateCommunityProfile } from "./actions";
import { uploadAvatarImage } from "@/app/(app)/(protected)/settings/avatar-actions";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
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
  const { state, formRef, isPending, scheduleSave, saveNow } = useAutoSaveForm(updateCommunityProfile, {});
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        saveNow();
      }}
      className="space-y-5"
    >
      <div>
        <label htmlFor={`${baseId}-avatar`} className={labelClass}>
          Profile picture
        </label>
        <ImageUrlField
          inputId={`${baseId}-avatar`}
          value={avatarUrl}
          onChange={(url) => {
            setAvatarUrl(url);
            scheduleSave();
          }}
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
          onBlur={scheduleSave}
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
          onBlur={scheduleSave}
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
                onChange={scheduleSave}
                className="h-4 w-4 rounded border-black/20 dark:border-white/20"
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <AutoSaveStatus isPending={isPending} error={state.error} success={state.success} />
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
