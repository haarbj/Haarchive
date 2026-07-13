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
import { ArticleLayout } from "@/components/article-layout";
import { Card } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

// Sections with a dedicated interactive component render that instead of
// the generic "Planned Topics" list. Add future tools as another entry here.
const sectionTools: Record<string, ComponentType> = {
  "heat-tracker": HeatTracker,
  "pace-calculator": PaceCalculator,
};

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
      <Container variant="content">
        <Link href="/" className={backLinkClass}>
          <span aria-hidden="true">←</span> Back to home
        </Link>
        <Heading>
          {category.title}
        </Heading>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          {category.mission}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {members.map((member: Section) => (
            <CardLink key={member.slug} href={`/${member.slug}`}>
              <h2 className="text-xl font-semibold tracking-tight">
                {member.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {member.mission}
              </p>
              <span className="mt-4 inline-flex text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
                View section →
              </span>
            </CardLink>
          ))}
        </div>
      </Container>
    );
  }

  // Individual section page
  const currentSection = section!;
  const parentCategory = categoryMap.get(currentSection.category)!;
  const ToolComponent = sectionTools[currentSection.slug];
  const content = currentSection.content;
  const isArticle = !!content && content.length > 0;

  // Same width as a category landing -- including for articles, which have
  // plenty of room for their sticky TOC + prose grid (see article-layout.tsx)
  // well under this width.
  return (
    <Container variant="content">
      <Link href={`/${parentCategory.slug}`} className={backLinkClass}>
        <span aria-hidden="true">←</span> Back to {parentCategory.title}
      </Link>
      <Heading>
        {currentSection.title}
      </Heading>
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
              <CardLink key={article.slug} href={`/${article.slug}`}>
                <h2 className="text-xl font-semibold tracking-tight">
                  {article.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {article.mission}
                </p>
                <span className="mt-4 inline-flex text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
                  Read the essay →
                </span>
              </CardLink>
            );
          })}
        </div>
      ) : isArticle ? (
        <ArticleLayout section={currentSection} category={parentCategory} content={content} />
      ) : (
        <Card padding="lg" className="mt-10">
          <h2 className="text-lg font-semibold">Planned Topics</h2>
          <ul className="mt-4 space-y-2 text-zinc-600 dark:text-zinc-300">
            {currentSection.topics.map((topic: string) => (
              <li key={topic}>• {topic}</li>
            ))}
          </ul>
        </Card>
      )}
    </Container>
  );
}
