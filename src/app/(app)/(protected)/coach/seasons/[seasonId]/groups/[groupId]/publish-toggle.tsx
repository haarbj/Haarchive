"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { publishGroupPlan, unpublishGroupPlan } from "@/app/(app)/(protected)/coach/group-plans-actions";
import { formatDate } from "@/lib/format";

export function PublishToggle({ groupPlanId, publishedAt }: { groupPlanId: string; publishedAt: string | null }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      if (publishedAt) await unpublishGroupPlan(groupPlanId);
      else await publishGroupPlan(groupPlanId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      {publishedAt ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Published</span> since{" "}
          {formatDate(publishedAt.slice(0, 10))} — visible to this group&rsquo;s athletes.
        </p>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          <span className="font-semibold text-amber-700 dark:text-amber-400">Not published</span> — athletes in this
          group can&rsquo;t see this schedule yet.
        </p>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Saving…" : publishedAt ? "Unpublish" : "Publish"}
      </button>
    </div>
  );
}
