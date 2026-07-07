import type { Metadata } from "next";
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
  };
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { slug } = await params;
  const section = sectionMap.get(slug);
  const category = categoryMap.get(slug);

  if (!section && !category) {
    notFound();
  }

  // Category landing page
  if (category) {
    const members = sectionsInCategory(category.slug);

    return (
      <section className="mx-auto w-full max-w-4xl px-6 py-16 animate-fade-in">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
          Category
        </p>
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
              <h2 className="font-heading text-xl tracking-tight">
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

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16 animate-fade-in">
      <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
        Section
      </p>
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        {currentSection.title}
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        {currentSection.mission}
      </p>

      <div className="mt-10 rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Planned Topics</h2>
        <ul className="mt-4 space-y-2 text-zinc-600 dark:text-zinc-300">
          {currentSection.topics.map((topic: string) => (
            <li key={topic}>• {topic}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
