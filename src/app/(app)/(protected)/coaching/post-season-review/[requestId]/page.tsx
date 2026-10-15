import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { loadPostSeasonReviewForm } from "./actions";
import { PostSeasonReviewForm } from "./post-season-review-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Post-Season Review",
  robots: { index: false, follow: false },
};

export default async function PostSeasonReviewPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const view = await loadPostSeasonReviewForm({ requestId });
  if (view.error || !view.answers) redirect("/coaching");

  return (
    <Container variant="narrow">
      <BackLink href="/coaching">My Coaching</BackLink>
      <Heading>Post-Season Review{view.raceName ? `: ${view.raceName}` : ""}</Heading>
      <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        You&rsquo;ve finished the race, so before planning what&rsquo;s next let&rsquo;s capture what this cycle taught you while
        it&rsquo;s fresh. There are no wrong answers here -- the goal is to learn your own patterns so your next buildup is
        better than this one.
      </p>
      <div className="mt-8">
        <PostSeasonReviewForm requestId={requestId} initialAnswers={view.answers} submitted={view.submittedAt != null} />
      </div>
    </Container>
  );
}
