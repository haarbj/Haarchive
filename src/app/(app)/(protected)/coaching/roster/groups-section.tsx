"use client";

import { type FormEvent, useState, useTransition, useActionState } from "react";

import { addGroupMember, createGroup, deleteGroup, removeGroupMember, renameGroup } from "./groups-actions";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormError } from "@/components/ui/form-error";
import { InlineConfirmButton } from "@/components/ui/inline-confirm-button";

export type RosterAthlete = { id: string; name: string };
export type TrainingGroup = {
  id: string;
  name: string;
  description: string | null;
  members: { membershipId: string; athleteId: string }[];
};

// Groups organize a coach's own roster by ability/focus (see
// 20261013010000_private_coaching_training_groups.sql's own header
// comment) -- program assignment per group is a later, separate change,
// not implied here. Lives on /coaching/roster rather than its own
// top-level section: a group only ever makes sense in terms of athletes
// already on this roster.
export function GroupsSection({ groups, rosterAthletes }: { groups: TrainingGroup[]; rosterAthletes: RosterAthlete[] }) {
  const nameById = new Map(rosterAthletes.map((a) => [a.id, a.name]));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(groupId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return (
    <div className="mt-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Groups</p>
      <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
        Organize your roster by ability or focus. A program can eventually be assigned to a whole group at once.
      </p>

      <div className="mt-4">
        <NewGroupForm />
      </div>

      {groups.length > 0 ? (
        <div className="mt-4 space-y-2">
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              isExpanded={expanded.has(group.id)}
              onToggle={() => toggle(group.id)}
              nameById={nameById}
              rosterAthletes={rosterAthletes}
            />
          ))}
        </div>
      ) : (
        <EmptyState className="mt-4">No groups yet. Create one to organize your roster by ability.</EmptyState>
      )}
    </div>
  );
}

function NewGroupForm() {
  const [state, formAction, isPending] = useActionState(createGroup, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="group-name" className={labelClass}>
          Group name
        </label>
        <input
          id="group-name"
          name="name"
          type="text"
          placeholder="A group — sub-17 5K"
          required
          className={`${fieldClass} w-56`}
        />
      </div>
      <div>
        <label htmlFor="group-description" className={labelClass}>
          Description (optional)
        </label>
        <input
          id="group-description"
          name="description"
          type="text"
          placeholder="Sub-17 5K, marathon block"
          className={`${fieldClass} w-64`}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "New group"}
      </Button>
      {state.error && <FormError className="w-full">{state.error}</FormError>}
    </form>
  );
}

function GroupRow({
  group,
  isExpanded,
  onToggle,
  nameById,
  rosterAthletes,
}: {
  group: TrainingGroup;
  isExpanded: boolean;
  onToggle: () => void;
  nameById: Map<string, string>;
  rosterAthletes: RosterAthlete[];
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(group.name);
  const [renameError, setRenameError] = useState<string | undefined>();
  const [isRenamePending, startRename] = useTransition();

  function handleRenameSubmit(event: FormEvent) {
    event.preventDefault();
    startRename(async () => {
      const result = await renameGroup(group.id, renameValue);
      if (result.error) {
        setRenameError(result.error);
      } else {
        setRenameError(undefined);
        setIsRenaming(false);
      }
    });
  }

  const memberAthleteIds = new Set(group.members.map((m) => m.athleteId));
  const nonMembers = rosterAthletes.filter((a) => !memberAthleteIds.has(a.id));

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left">
          <span
            aria-hidden="true"
            className={`shrink-0 text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          >
            ▸
          </span>
          <span className="min-w-0">
            <span className="font-medium text-zinc-900 dark:text-white">{group.name}</span>
            <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
              {group.members.length} {group.members.length === 1 ? "athlete" : "athletes"}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-3 text-xs">
          {!isRenaming && (
            <button
              type="button"
              onClick={() => {
                setRenameValue(group.name);
                setIsRenaming(true);
              }}
              className="font-semibold text-zinc-500 underline underline-offset-2 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            >
              Rename
            </button>
          )}
          <InlineConfirmButton
            action={() => deleteGroup(group.id)}
            confirmMessage={`Delete "${group.name}"? Athletes keep their training history either way — this only removes the group.`}
            label="Delete"
            pendingLabel="Deleting…"
            ariaLabel={`Delete ${group.name}`}
            className="font-semibold text-zinc-500 underline underline-offset-2 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          />
        </div>
      </div>

      {isRenaming ? (
        <form onSubmit={handleRenameSubmit} className="mt-3 flex flex-wrap items-end gap-2">
          <input
            type="text"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            autoFocus
            className={`${fieldClass} w-56`}
          />
          <Button type="submit" size="sm" disabled={isRenamePending}>
            {isRenamePending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isRenamePending} onClick={() => setIsRenaming(false)}>
            Cancel
          </Button>
          {renameError && <FormError className="w-full">{renameError}</FormError>}
        </form>
      ) : (
        group.description && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{group.description}</p>
      )}

      {isExpanded && (
        <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
          {group.members.length > 0 ? (
            <div className="space-y-2">
              {group.members.map((member) => (
                <MemberRow
                  key={member.membershipId}
                  membershipId={member.membershipId}
                  athleteName={nameById.get(member.athleteId) ?? "Athlete"}
                  groupName={group.name}
                />
              ))}
            </div>
          ) : (
            <EmptyState>No athletes in this group yet.</EmptyState>
          )}

          <div className="mt-3">
            <AddMemberControl groupId={group.id} athletes={nonMembers} />
          </div>
        </div>
      )}
    </Card>
  );
}

function MemberRow({
  membershipId,
  athleteName,
  groupName,
}: {
  membershipId: string;
  athleteName: string;
  groupName: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900">
      <span className="text-zinc-900 dark:text-white">{athleteName}</span>
      <InlineConfirmButton
        action={() => removeGroupMember(membershipId)}
        confirmMessage={`Remove ${athleteName} from "${groupName}"?`}
        label="Remove"
        pendingLabel="Removing…"
        ariaLabel={`Remove ${athleteName} from ${groupName}`}
        className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
      />
    </div>
  );
}

function AddMemberControl({ groupId, athletes }: { groupId: string; athletes: RosterAthlete[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  if (athletes.length === 0) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400">Every roster athlete is already in this group.</p>;
  }

  return (
    <div>
      <select
        defaultValue=""
        disabled={isPending}
        onChange={(event) => {
          const athleteId = event.target.value;
          if (!athleteId) return;
          event.target.value = "";
          startTransition(async () => {
            const result = await addGroupMember(groupId, athleteId);
            setError(result.error);
          });
        }}
        className={`${fieldClass} w-56`}
      >
        <option value="" disabled>
          {isPending ? "Adding…" : "Add an athlete…"}
        </option>
        {athletes.map((athlete) => (
          <option key={athlete.id} value={athlete.id}>
            {athlete.name}
          </option>
        ))}
      </select>
      {error && <FormError className="mt-1">{error}</FormError>}
    </div>
  );
}
