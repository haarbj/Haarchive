"use client";

import { useActionState, useState, useTransition, type ChangeEvent } from "react";

import {
  addArticleContributor,
  removeArticleContributor,
  updateArticleContributorRole,
  type ArticleAdminState,
} from "@/app/(app)/(protected)/admin/articles/actions";
import { ARTICLE_CONTRIBUTOR_ROLES, ARTICLE_CONTRIBUTOR_ROLE_LABELS } from "@/lib/articles/constants";
import { fieldClass as baseFieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormError } from "@/components/ui/form-error";

const fieldClass = baseFieldClass;

export type ContributorRow = {
  id: string;
  userId: string;
  name: string;
  role: string;
};

export function ContributorsPanel({
  articleId,
  contributors,
  users,
}: {
  articleId: string;
  contributors: ContributorRow[];
  users: { id: string; email: string; displayName: string }[];
}) {
  const [state, formAction, isPending] = useActionState<ArticleAdminState, FormData>(addArticleContributor, {});

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {contributors.length > 0 ? (
          contributors.map((c) => <ContributorItem key={c.id} contributor={c} articleId={articleId} />)
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No contributors yet.</p>
        )}
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="articleId" value={articleId} />
        <select name="userId" defaultValue="" className={fieldClass}>
          <option value="" disabled>
            Choose a person…
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} ({u.email})
            </option>
          ))}
        </select>
        <select name="contributorRole" defaultValue="author" className={fieldClass}>
          {ARTICLE_CONTRIBUTOR_ROLES.map((role) => (
            <option key={role} value={role}>
              {ARTICLE_CONTRIBUTOR_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adding…" : "Add"}
        </Button>
      </form>

      {state.error ? <FormError>{state.error}</FormError> : null}
    </div>
  );
}

// Changing someone's role in place (author added by mistake who should be
// a contributor, say) instead of forcing a remove-then-re-add through the
// "add a person" form above -- updateArticleContributorRole just updates
// the existing row.
function ContributorItem({ contributor, articleId }: { contributor: ContributorRow; articleId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRoleChange(e: ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value;
    setError(null);
    startTransition(async () => {
      const result = await updateArticleContributorRole(contributor.id, articleId, role);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
      <span className="text-zinc-900 dark:text-white">{contributor.name}</span>
      <div className="flex items-center gap-3">
        <select
          value={contributor.role}
          onChange={handleRoleChange}
          disabled={isPending}
          aria-label={`Role for ${contributor.name}`}
          className={`${fieldClass} py-1 text-xs`}
        >
          {ARTICLE_CONTRIBUTOR_ROLES.map((role) => (
            <option key={role} value={role}>
              {ARTICLE_CONTRIBUTOR_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <ConfirmButton
          action={() => removeArticleContributor(contributor.id, articleId)}
          confirmMessage={`Remove ${contributor.name} as a contributor on this article?`}
          label="Remove"
          pendingLabel="Removing…"
          className="text-xs font-semibold text-red-700 dark:text-red-400"
        />
      </div>
      {error ? <FormError className="w-full">{error}</FormError> : null}
    </div>
  );
}
