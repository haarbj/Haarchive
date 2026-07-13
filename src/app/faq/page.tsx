import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/db/server";
import { categories } from "@/lib/sections";
import { mapQuestionRow } from "@/lib/questions/map-row";
import type { Question } from "@/lib/questions/types";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to the questions readers ask most often about The Haarchive's training content.",
};

export default async function FaqPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("visible", true)
    .eq("is_faq", true)
    .order("upvote_count", { ascending: false });

  const faqs = (data ?? []).map(mapQuestionRow);

  const grouped = new Map<string, Question[]>();
  for (const faq of faqs) {
    const key = faq.category ?? "general";
    grouped.set(key, [...(grouped.get(key) ?? []), faq]);
  }

  const orderedGroups = [
    ...categories.filter((c) => grouped.has(c.slug)).map((c) => ({ slug: c.slug, title: c.title })),
    ...(grouped.has("general") ? [{ slug: "general", title: "General" }] : []),
  ];

  return (
    <Container variant="content">
      <Link
        href="/questions"
        className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
      >
        <span aria-hidden="true">←</span> Back to Questions
      </Link>
      <Heading>FAQ</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Short answers to questions that come up often but don’t warrant their own article. Don’t see
        yours?{" "}
        <Link
          href="/questions/ask"
          className="font-semibold underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70"
        >
          Ask it
        </Link>
        .
      </p>

      {orderedGroups.length === 0 ? (
        <p className="mt-10 text-zinc-600 dark:text-zinc-300">Nothing here yet.</p>
      ) : (
        <div className="mt-10 space-y-10">
          {orderedGroups.map((group) => (
            <div key={group.slug}>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                {group.title}
              </h2>
              <div className="mt-4 space-y-4">
                {(grouped.get(group.slug) ?? []).map((faq) => (
                  <Card key={faq.id} as="details" padding="sm" shadow={false} className="group">
                    <summary className="cursor-pointer list-none text-base font-semibold tracking-tight text-zinc-900 marker:content-none dark:text-white">
                      {faq.title}
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      {faq.adminResponse}
                    </p>
                    {faq.linkedSectionSlug ? (
                      <Link
                        href={`/${faq.linkedSectionSlug}`}
                        className="mt-3 inline-flex text-sm font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
                      >
                        Read the full article →
                      </Link>
                    ) : null}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
