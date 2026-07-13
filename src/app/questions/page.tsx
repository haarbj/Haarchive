import type { Metadata } from "next";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { getAnonIdReadOnly } from "@/lib/anon-id";
import { createClient } from "@/lib/db/server";
import { mapQuestionRow } from "@/lib/questions/map-row";
import type { Question } from "@/lib/questions/types";
import { QuestionCard } from "@/components/questions/question-card";
import { QuestionSearchBox } from "@/app/questions/question-search-box";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Questions",
  description:
    "Ask a question, suggest a topic, or upvote what you'd like to see covered next in The Haarchive.",
};

const BUCKET_LIMIT = 6;

async function fetchUpvotedIds(questionIds: string[]): Promise<Set<string>> {
  if (questionIds.length === 0) return new Set();

  const session = await getAppSession();
  const anonId = session ? null : await getAnonIdReadOnly();
  if (!session && !anonId) return new Set();

  const supabase = await createClient();
  let query = supabase.from("question_upvotes").select("question_id").in("question_id", questionIds);
  query = session ? query.eq("user_id", session.userId) : query.eq("anon_id", anonId as string);
  const { data } = await query;

  return new Set((data ?? []).map((row) => row.question_id as string));
}

export default async function QuestionsPage() {
  const supabase = await createClient();

  const [mostRequested, recentlyAnswered, researching, newest] = await Promise.all([
    supabase
      .from("questions")
      .select("*")
      .eq("visible", true)
      .not("status", "in", "(answered,added_to_library)")
      .order("upvote_count", { ascending: false })
      .limit(BUCKET_LIMIT),
    supabase
      .from("questions")
      .select("*")
      .eq("visible", true)
      .in("status", ["answered", "added_to_library"])
      .order("updated_at", { ascending: false })
      .limit(BUCKET_LIMIT),
    supabase
      .from("questions")
      .select("*")
      .eq("visible", true)
      .eq("status", "researching")
      .order("updated_at", { ascending: false })
      .limit(BUCKET_LIMIT),
    supabase
      .from("questions")
      .select("*")
      .eq("visible", true)
      .order("created_at", { ascending: false })
      .limit(BUCKET_LIMIT),
  ]);

  const buckets: { title: string; blurb: string; questions: Question[] }[] = [
    {
      title: "Most Requested",
      blurb: "The open questions readers most want answered.",
      questions: (mostRequested.data ?? []).map(mapQuestionRow),
    },
    {
      title: "Currently Researching",
      blurb: "On the list, being worked on.",
      questions: (researching.data ?? []).map(mapQuestionRow),
    },
    {
      title: "Recently Answered",
      blurb: "Resolved into an FAQ entry or folded into an article.",
      questions: (recentlyAnswered.data ?? []).map(mapQuestionRow),
    },
    {
      title: "Newest Questions",
      blurb: "Just submitted.",
      questions: (newest.data ?? []).map(mapQuestionRow),
    },
  ];

  const allIds = Array.from(new Set(buckets.flatMap((b) => b.questions.map((q) => q.id))));
  const upvotedIds = await fetchUpvotedIds(allIds);

  return (
    <Container variant="content">
      <Heading>Questions</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        The Haarchive is a curated library, not a discussion board — this page is how you help shape
        what gets written next. Ask a question, suggest a topic, or upvote what you’d most like to see
        covered. Every submission feeds directly into the editorial pipeline: it either expands an
        existing article, becomes a new one, joins the FAQ, or gets filed as a future research topic.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button href="/questions/ask" size="lg" className="shrink-0">
          Ask a Question
        </Button>
        <Link
          href="/faq"
          className="text-sm font-semibold text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-zinc-300 dark:decoration-white/30 dark:hover:decoration-white/70"
        >
          Browse the FAQ →
        </Link>
      </div>

      <div className="mt-8">
        <QuestionSearchBox />
      </div>

      <div className="mt-14 space-y-14">
        {buckets.map((bucket) =>
          bucket.questions.length > 0 ? (
            <div key={bucket.title}>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                {bucket.title}
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{bucket.blurb}</p>
              <div className="mt-4 space-y-3">
                {bucket.questions.map((question) => (
                  <QuestionCard key={question.id} question={question} upvoted={upvotedIds.has(question.id)} />
                ))}
              </div>
            </div>
          ) : null,
        )}
      </div>
    </Container>
  );
}
