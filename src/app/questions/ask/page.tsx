import type { Metadata } from "next";
import Link from "next/link";

import { sectionMap } from "@/lib/sections";
import { AskQuestionForm } from "@/app/questions/ask/ask-question-form";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Ask a Question",
  description: "Ask a question, or suggest a topic you'd like to see covered in The Haarchive.",
};

type AskPageProps = {
  searchParams: Promise<{ from?: string }>;
};

export default async function AskQuestionPage({ searchParams }: AskPageProps) {
  const { from } = await searchParams;
  const sourceSection = from ? sectionMap.get(from) : undefined;

  return (
    <Container variant="narrow">
      <Link
        href="/questions"
        className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
      >
        <span aria-hidden="true">←</span> Back to Questions
      </Link>
      <Heading>Ask a Question</Heading>
      <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        {sourceSection
          ? `Asking about "${sourceSection.title}." `
          : ""}
        Every question and topic suggestion goes straight into the editorial pipeline — nothing here is a
        comment thread. Post it, upvote what you’d like to see prioritized, and check back on the{" "}
        <Link
          href="/questions"
          className="font-semibold underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70"
        >
          Questions
        </Link>{" "}
        page for progress.
      </p>

      <div className="mt-10">
        <AskQuestionForm sourceSectionSlug={sourceSection?.slug} />
      </div>
    </Container>
  );
}
