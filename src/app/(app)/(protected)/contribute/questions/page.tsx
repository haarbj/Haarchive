import type { Metadata } from "next";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { mapQuestionRow } from "@/lib/questions/map-row";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Assigned Questions",
};

export default async function AssignedQuestionsPage() {
  const session = await getAppSession(); // non-null: contribute/layout.tsx already gated
  const admin = createServiceRoleClient();

  const [{ data: toAnswerRows }, { data: toReviewRows }] = await Promise.all([
    admin.from("questions").select("*").eq("assigned_to", session!.userId).returns<Record<string, unknown>[]>(),
    admin
      .from("questions")
      .select("*")
      .eq("assigned_reviewer", session!.userId)
      .returns<Record<string, unknown>[]>(),
  ]);

  const toAnswer = (toAnswerRows ?? []).map(mapQuestionRow);
  const toReview = (toReviewRows ?? []).map(mapQuestionRow);

  return (
    <Container variant="dashboard">
      <BackLink href="/contribute">Back to Contribute</BackLink>
      <Heading>Assigned Questions</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Reader questions an admin has asked you to answer or review.
      </p>

      <div className="mt-10">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          To answer
        </h2>
        <div className="mt-3 space-y-2">
          {toAnswer.length > 0 ? (
            toAnswer.map((q) => (
              <Link key={q.id} href={`/contribute/questions/${q.id}`} className="group block">
                <Card
                  padding="md"
                  className="transition group-hover:-translate-y-0.5 group-hover:shadow-card-hover"
                >
                  <p className="font-semibold text-zinc-900 dark:text-white">{q.title}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {q.draftAnswer ? "Draft in progress" : "Not started"}
                  </p>
                </Card>
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing assigned to you yet.</p>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          To review
        </h2>
        <div className="mt-3 space-y-2">
          {toReview.length > 0 ? (
            toReview.map((q) => (
              <Link key={q.id} href={`/contribute/questions/${q.id}`} className="group block">
                <Card
                  padding="md"
                  className="transition group-hover:-translate-y-0.5 group-hover:shadow-card-hover"
                >
                  <p className="font-semibold text-zinc-900 dark:text-white">{q.title}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {q.draftAnswer ? "Ready for review" : "No draft yet"}
                  </p>
                </Card>
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing to review right now.</p>
          )}
        </div>
      </div>
    </Container>
  );
}
