"use client";

import { useActionState } from "react";

import { updateUserPermissions } from "./actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  id: string;
  email: string;
  displayName: string;
  contentContributor: boolean;
  reviewer: boolean;
  trainingDashboardAccess: boolean;
};

export function UserPermissionsRow({
  id,
  email,
  displayName,
  contentContributor,
  reviewer,
  trainingDashboardAccess,
}: Props) {
  const [state, formAction, isPending] = useActionState(updateUserPermissions, {});

  return (
    <Card padding="md" as="form" action={formAction}>
      <input type="hidden" name="userId" value={id} />
      <div>
        <p className="font-semibold text-zinc-900 dark:text-white">{displayName}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{email}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="contentContributor" defaultChecked={contentContributor} />
          Content Contributor
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="reviewer" defaultChecked={reviewer} />
          Reviewer
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="trainingDashboardAccess" defaultChecked={trainingDashboardAccess} />
          Training Dashboard Access
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        {state.success && <span className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</span>}
        {state.error && (
          <span role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {state.error}
          </span>
        )}
      </div>
    </Card>
  );
}
