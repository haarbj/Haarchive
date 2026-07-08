import type { Metadata } from "next";
import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  categories,
  categoryMap,
  sectionMap,
  sections,
  sectionsInCategory,
  type Category,
  type Section,
} from "@/lib/sections";
import { HeatTracker } from "@/components/heat-tracker";
import { PaceCalculator } from "@/components/pace-calculator";
import { PullQuote } from "@/components/pull-quote";

// Sections with a dedicated interactive component render that instead of
// the generic "Planned Topics" list. Add future tools as another entry here.
const sectionTools: Record<string, ComponentType> = {
  "heat-tracker": HeatTracker,
  "pace-calculator": PaceCalculator,
};

function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SectionPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  const sectionSlugs = sections.map((section: Section) => ({
    slug: section.slug,
  }));
  const categorySlugs = categories.map((category: Category) => ({
    slug: category.slug,
  }));
  return [...sectionSlugs, ...categorySlugs];
}

export async function generateMetadata({
  params,
}: SectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const section = sectionMap.get(slug);
  const category = categoryMap.get(slug);
  const entry = section ?? category;

  if (!entry) {
    return {};
  }

  return {
    title: entry.title,
    description: entry.mission,
    openGraph: {
      title: entry.title,
      description: entry.mission,
      images: ["/opengraph-image.png"],
    },
    twitter: {
      title: entry.title,
      description: entry.mission,
      images: ["/opengraph-image.png"],
    },
  };
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { slug } = await params;
  const section = sectionMap.get(slug);
  const category = categoryMap.get(slug);

  if (!section && !category) {
    notFound();
  }

  const backLinkClass =
    "mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white";

  // Category landing page
  if (category) {
    const members = sectionsInCategory(category.slug);

    return (
      <section className="mx-auto w-full max-w-4xl px-6 py-16 animate-fade-in">
        <Link href="/" className={backLinkClass}>
          <span aria-hidden="true">←</span> Back to home
        </Link>
        <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          {category.title}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          {category.mission}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {members.map((member: Section) => (
            <Link
              key={member.slug}
              href={`/${member.slug}`}
              className="group rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
            >
              <h2 className="text-xl font-semibold tracking-tight">
                {member.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {member.mission}
              </p>
              <span className="mt-4 inline-flex text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-zinc-200 dark:group-hover:text-white">
                View section →
              </span>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  // Individual section page
  const currentSection = section!;
  const parentCategory = categoryMap.get(currentSection.category)!;
  const ToolComponent = sectionTools[currentSection.slug];

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16 animate-fade-in">
      <Link href={`/${parentCategory.slug}`} className={backLinkClass}>
        <span aria-hidden="true">←</span> Back to {parentCategory.title}
      </Link>
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        {currentSection.title}
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        {currentSection.mission}
      </p>

      {ToolComponent ? (
        <ToolComponent />
      ) : currentSection.articleSlugs ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {currentSection.articleSlugs.map((articleSlug) => {
            const article = sectionMap.get(articleSlug);
            if (!article) return null;
            return (
              <Link
                key={article.slug}
                href={`/${article.slug}`}
                className="group rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
              >
                <h2 className="text-xl font-semibold tracking-tight">
                  {article.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {article.mission}
                </p>
                <span className="mt-4 inline-flex text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-zinc-200 dark:group-hover:text-white">
                  Read the essay →
                </span>
              </Link>
            );
          })}
        </div>
      ) : currentSection.content ? (
        <div className="mt-10 max-w-[66ch] space-y-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          {currentSection.content.map((block, index) => {
            if (block.type === "heading") {
              return (
                <h2
                  key={index}
                  id={headingId(block.text)}
                  className="scroll-mt-24 pt-6 text-2xl font-semibold tracking-tight text-zinc-900 first:pt-0 dark:text-white"
                >
                  {block.text}
                </h2>
              );
            }
            if (block.type === "list") {
              return (
                <ul key={index} className="space-y-3">
                  {block.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              );
            }
            if (block.type === "quote") {
              return (
                <PullQuote
                  key={index}
                  text={block.text}
                  attribution={block.attribution}
                />
              );
            }
            return (
              <p key={index}>
                {block.text}
                {block.linkHref && block.linkText ? (
                  <>
                    {" "}
                    <Link
                      href={block.linkHref}
                      className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
                    >
                      {block.linkText}
                    </Link>
                    .
                  </>
                ) : null}
              </p>
            );
          })}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Planned Topics</h2>
          <ul className="mt-4 space-y-2 text-zinc-600 dark:text-zinc-300">
            {currentSection.topics.map((topic: string) => (
              <li key={topic}>• {topic}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
