import Link from "next/link";

import { sections } from "@/lib/sections";

export default function Home() {
  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pt-16 pb-8 animate-fade-in">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
          Distance Running Knowledge Hub
        </p>
        <h1 className="max-w-4xl text-5xl leading-tight font-semibold tracking-tight sm:text-6xl">
          For runners who want to understand the sport at the deepest level.
        </h1>
        <p className="max-w-3xl text-xl leading-9 text-zinc-600 dark:text-zinc-300">
          WetBulb is a long-term resource dedicated to the science, psychology, philosophy, and
          practice of distance running—helping athletes learn not only how to train, but how to
          think about training.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/training-philosophy"
            className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Explore Training Philosophy
          </Link>
          <Link
            href="/articles"
            className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Read the Articles
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <article
            key={section.slug}
            className="group rounded-2xl border border-black/8 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
          >
            <h2 className="font-heading text-2xl tracking-tight">{section.title}</h2>
            <p className="mt-3 text-zinc-600 dark:text-zinc-300">{section.mission}</p>
            <Link
              href={`/${section.slug}`}
              className="mt-5 inline-flex text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-zinc-200 dark:group-hover:text-white"
            >
              View section →
            </Link>
          </article>
        ))}
      </section>
    </>
  );
}
