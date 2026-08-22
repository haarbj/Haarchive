"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";

import { setUserEmailUnsubscribed, updateUserPermissions } from "./actions";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/ui/form-error";

type Props = {
  id: string;
  email: string;
  displayName: string;
  contentContributor: boolean;
  reviewer: boolean;
  trainingDashboardAccess: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  status: "active" | "pending";
  emailUnsubscribedAt: string | null;
};

export function UserPermissionsRow({
  id,
  email,
  displayName,
  contentContributor,
  reviewer,
  trainingDashboardAccess,
  isAdmin,
  createdAt,
  lastSignInAt,
  status,
  emailUnsubscribedAt,
}: Props) {
  const [state, formAction, isPending] = useActionState(updateUserPermissions, {});

  // Separate from the permissions form above -- an email preference, not a
  // permission, and fires immediately on click rather than needing its own
  // "Save changes" step (see setUserEmailUnsubscribed's own comment).
  const [unsubscribed, setUnsubscribed] = useState(emailUnsubscribedAt !== null);
  const [isTogglingSub, startTogglingSub] = useTransition();
  const [subError, setSubError] = useState<string | null>(null);

  function toggleUnsubscribed() {
    setSubError(null);
    const next = !unsubscribed;
    startTogglingSub(async () => {
      const result = await setUserEmailUnsubscribed(id, next);
      if (result.error) {
        setSubError(result.error);
        return;
      }
      setUnsubscribed(next);
    });
  }

  return (
    <Card padding="md" as="form" action={formAction}>
      <input type="hidden" name="userId" value={id} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-zinc-900 dark:text-white">{displayName}</p>
            {/* Read-only -- admin is never grantable from this form, see the
                page's own copy above. Shown so the new Admin filter pill has
                a visible reason a row matched it. */}
            {isAdmin && <Badge tone="research">Admin</Badge>}
            {status === "pending" && <Badge tone="warning">Pending</Badge>}
            {unsubscribed && <Badge tone="error">Unsubscribed</Badge>}
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{email}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Joined {formatDate(createdAt.slice(0, 10))}
            {lastSignInAt ? ` · Last active ${formatRelativeTime(lastSignInAt)}` : " · Never signed in again"}
          </p>
          <button
            type="button"
            onClick={toggleUnsubscribed}
            disabled={isTogglingSub}
            className="mt-1 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-60 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            {isTogglingSub ? "Saving…" : unsubscribed ? "Mark subscribed" : "Mark unsubscribed from emails"}
          </button>
          {subError && <FormError as="p" className="mt-1 text-xs">{subError}</FormError>}
        </div>
        <Link
          href={`/admin/users/${id}`}
          className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          View details →
        </Link>
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
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {state.success && <span className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</span>}
        {state.error && <FormError as="span">{state.error}</FormError>}
      </div>
    </Card>
  );
}
