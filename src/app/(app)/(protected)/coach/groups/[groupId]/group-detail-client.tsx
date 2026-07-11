"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addAthleteToGroup,
  deleteGroup,
  removeAthleteFromGroup,
  renameGroup,
} from "@/app/(app)/(protected)/coach/groups-actions";

const fieldClass =
  "rounded-lg border border-black/10 bg-white px-4 py-2.5 text-base text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";

type Athlete = { id: string; display_name: string };

export function RenameGroupForm({ groupId, name }: { groupId: string; name: string }) {
  const [state, formAction, isPending] = useActionState(renameGroup, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="groupId" value={groupId} />
      <div>
        <label htmlFor="rename-group" className="mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          Group name
        </label>
        <input id="rename-group" name="name" type="text" defaultValue={name} required className={`${fieldClass} w-64`} />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {state.success && <span className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</span>}
      {state.error && <span className="text-sm font-medium text-red-700 dark:text-red-400">{state.error}</span>}
    </form>
  );
}

export function DeleteGroupButton({ groupId }: { groupId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-semibold text-red-700 underline decoration-red-700/30 underline-offset-2 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/30 dark:hover:decoration-red-400"
      >
        Delete group
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-700 dark:text-zinc-200">Delete this group? This can&rsquo;t be undone.</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteGroup(groupId);
            router.push("/coach/groups");
          })
        }
        className="font-semibold text-red-700 disabled:opacity-60 dark:text-red-400"
      >
        {isPending ? "Deleting…" : "Confirm delete"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-zinc-500 dark:text-zinc-400">
        Cancel
      </button>
    </div>
  );
}

export function MembershipRoster({
  groupId,
  athletes,
  memberIds,
  otherGroupNamesByAthlete,
}: {
  groupId: string;
  athletes: Athlete[];
  memberIds: string[];
  otherGroupNamesByAthlete: Record<string, string[]>;
}) {
  const [members, setMembers] = useState(new Set(memberIds));
  const [isPending, startTransition] = useTransition();

  function toggle(athleteId: string, athleteName: string) {
    const isMember = members.has(athleteId);
    if (!isMember) {
      const otherNames = otherGroupNamesByAthlete[athleteId] ?? [];
      if (otherNames.length > 0) {
        const proceed = window.confirm(
          `${athleteName} is already in ${otherNames.join(", ")}. Add them to this group too?`,
        );
        if (!proceed) return;
      }
    }
    startTransition(async () => {
      if (isMember) {
        await removeAthleteFromGroup(groupId, athleteId);
      } else {
        await addAthleteToGroup(groupId, athleteId);
      }
      setMembers((prev) => {
        const next = new Set(prev);
        if (isMember) next.delete(athleteId);
        else next.add(athleteId);
        return next;
      });
    });
  }

  if (athletes.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-300">No athletes have joined yet.</p>;
  }

  return (
    <div className="space-y-1.5">
      {athletes.map((athlete) => (
        <label key={athlete.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={members.has(athlete.id)}
            disabled={isPending}
            onChange={() => toggle(athlete.id, athlete.display_name)}
          />
          {athlete.display_name}
        </label>
      ))}
    </div>
  );
}
