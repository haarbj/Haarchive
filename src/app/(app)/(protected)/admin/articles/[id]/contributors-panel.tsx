"use client";

import { useActionState } from "react";

import {
  addArticleContributor,
  removeArticleContributor,
  type ArticleAdminState,
} from "@/app/(app)/(protected)/admin/articles/actions";
import { ARTICLE_CONTRIBUTOR_ROLES, ARTICLE_CONTRIBUTOR_ROLE_LABELS } from "@/lib/articles/constants";
import { fieldClass as baseFieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";

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
          contributors.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
            >
              <span className="text-zinc-900 dark:text-white">
                {c.name} <span className="text-zinc-500 dark:text-zinc-400">— {c.role}</span>
              </span>
              <button
                type="button"
                onClick={() => void removeArticleContributor(c.id, articleId)}
                className="text-xs font-semibold text-red-700 dark:text-red-400"
              >
                Remove
              </button>
            </div>
          ))
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

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
