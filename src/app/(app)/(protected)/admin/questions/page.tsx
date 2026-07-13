import type { Metadata } from "next";
import Link from "next/link";

import { createServiceRoleClient } from "@/lib/db/service-role";
import { categoryMap } from "@/lib/sections";
import { formatRelativeTime } from "@/lib/format";
import { computeKnowledgeGaps } from "@/lib/questions/knowledge-gaps";
import { mapQuestionRow } from "@/lib/questions/map-row";
import { StatusBadge } from "@/components/questions/status-badge";
import { Container } from "@/components/ui/container";
import { ListRow } from "@/components/ui/list-row";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = { title: "Questions Admin" };

type SortKey = "newest" | "upvotes" | "category" | "unanswered" | "status";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "upvotes", label: "Most Requested" },
  { key: "unanswered", label: "Unanswered" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
];

type AdminQuestionsPageProps = {
  searchParams: Promise<{ sort?: string }>;
};

export default async function AdminQuestionsPage({ searchParams }: AdminQuestionsPageProps) {
  const { sort } = await searchParams;
  const sortKey: SortKey = SORT_OPTIONS.some((o) => o.key === sort) ? (sort as SortKey) : "newest";

  // gated by admin/layout.tsx (isAdmin redirect) -- the service-role read
  // here is what lets the dashboard see archived/invisible questions too,
  // which the public RLS policy deliberately hides from everyone else.
  const admin = createServiceRoleClient();
  let query = admin.from("questions").select("*");

  if (sortKey === "unanswered") {
    query = query.not("status", "in", "(answered,added_to_library)").order("upvote_count", { ascending: false });
  } else if (sortKey === "upvotes") {
    query = query.order("upvote_count", { ascending: false });
  } else if (sortKey === "category") {
    query = query.order("category", { ascending: true, nullsFirst: false });
  } else if (sortKey === "status") {
    query = query.order("status", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data } = await query.limit(200);
  const questions = (data ?? []).map(mapQuestionRow);
  const gaps = computeKnowledgeGaps(
    questions.filter((q) => q.visible).map((q) => ({ category: q.category, tags: q.tags, status: q.status })),
  ).filter((gap) => gap.count >= 3);

  return (
    <Container variant="dashboard">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading>Questions</Heading>
        <Link
          href="/admin"
          className="text-sm font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-zinc-400 dark:decoration-white/30"
        >
          ← Admin home
        </Link>
      </div>
      <p className="mt-4 text-zinc-600 dark:text-zinc-300">
        {questions.length} question{questions.length === 1 ? "" : "s"} total.
      </p>

      {gaps.length > 0 ? (
        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 dark:border-amber-400/30 dark:bg-amber-400/5">
          <p className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-white">
            Knowledge Gaps
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {gaps.map((gap) => (
              <span
                key={`${gap.kind}-${gap.label}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
                  gap.flagged
                    ? "bg-amber-500/20 font-semibold text-amber-900 dark:bg-amber-400/20 dark:text-amber-200"
                    : "bg-black/5 text-zinc-700 dark:bg-white/10 dark:text-zinc-300"
                }`}
              >
                {gap.kind === "category" ? categoryMap.get(gap.label)?.title ?? gap.label : `#${gap.label}`}
                <span className="opacity-70">· {gap.count}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
            Highlighted buckets have 8+ open questions — consider a dedicated article or a real expansion.
          </p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2">
        {SORT_OPTIONS.map((option) => (
          <Link
            key={option.key}
            href={`/admin/questions?sort=${option.key}`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              sortKey === option.key
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/20"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {questions.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No questions yet.</p>
        ) : (
          questions.map((question) => (
            <ListRow
              key={question.id}
              href={`/admin/questions/${question.id}`}
              muted={!question.visible}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-900 dark:text-white">{question.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {question.category ? categoryMap.get(question.category)?.title ?? question.category : "Uncategorized"}
                  {" · "}
                  {formatRelativeTime(question.createdAt)}
                  {!question.visible ? " · archived/removed" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  {question.upvoteCount} upvotes
                </span>
                <StatusBadge status={question.status} />
              </div>
            </ListRow>
          ))
        )}
      </div>
    </Container>
  );
}

export const dynamic = "force-dynamic";
