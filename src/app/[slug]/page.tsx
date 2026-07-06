import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { sectionMap, sections } from "@/lib/sections";

type SectionPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return sections.map((section) => ({ slug: section.slug }));
}

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const section = sectionMap.get(slug);

  if (!section) {
    return {};
  }

  return {
    title: section.title,
    description: section.mission,
  };
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { slug } = await params;
  const section = sectionMap.get(slug);

  if (!section) {
    notFound();
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16 animate-fade-in">
      <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">Section</p>
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{section.title}</h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{section.mission}</p>

      <div className="mt-10 rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Planned Topics</h2>
        <ul className="mt-4 space-y-2 text-zinc-600 dark:text-zinc-300">
          {section.topics.map((topic) => (
            <li key={topic}>• {topic}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
