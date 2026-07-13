"use client";

import { useEffect, useRef, useState, useActionState, useTransition } from "react";
import Link from "next/link";

import { submitQuestion, searchLibrary } from "@/app/questions/actions";
import type { RetrievedExcerpt } from "@/lib/ai/retrieval";
import { categories } from "@/lib/sections";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";

type AskQuestionFormProps = {
  sourceSectionSlug?: string;
};

export function AskQuestionForm({ sourceSectionSlug }: AskQuestionFormProps) {
  const [state, formAction, isPending] = useActionState(submitQuestion, {});
  const [title, setTitle] = useState("");
  const [matches, setMatches] = useState<RetrievedExcerpt[]>([]);
  const [searching, startSearch] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (title.trim().length < 8) {
        setMatches([]);
        return;
      }
      startSearch(async () => {
        const results = await searchLibrary(title);
        setMatches(results);
      });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title]);

  if (state.success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 dark:border-emerald-400/30 dark:bg-emerald-400/5">
        <p className="text-lg font-semibold text-zinc-900 dark:text-white">Thanks — that’s in the queue.</p>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          It’ll show up on the Questions page right away, and it factors into what gets written next.
        </p>
        <Link
          href="/questions"
          className="mt-4 inline-flex text-sm font-semibold underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70"
        >
          Back to Questions →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <span className={labelClass}>This is a</span>
        <div className="mt-1 flex gap-4 text-sm text-zinc-700 dark:text-zinc-300">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="type" value="question" defaultChecked className="accent-zinc-900 dark:accent-white" />
            Question
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="type" value="topic_suggestion" className="accent-zinc-900 dark:accent-white" />
            Topic suggestion
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={8}
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Why doesn't easy running build fast-twitch fibers?"
          className={`${fieldClass} w-full`}
        />
      </div>

      {title.trim().length >= 8 && (searching || matches.length > 0) ? (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 dark:border-sky-400/30 dark:bg-sky-400/5">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {searching ? "Checking the library…" : "We may already have an article that answers this."}
          </p>
          {!searching ? (
            <ul className="mt-2 space-y-1.5">
              {matches.map((match, i) => (
                <li key={`${match.sectionSlug}-${i}`}>
                  <Link
                    href={`/${match.sectionSlug}`}
                    target="_blank"
                    className="text-sm font-medium text-sky-700 underline decoration-sky-700/30 underline-offset-2 hover:decoration-sky-700/70 dark:text-sky-300 dark:decoration-sky-300/30"
                  >
                    {match.sectionTitle}
                    {match.heading ? ` — ${match.heading}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {!searching ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Take a look — if it doesn’t fully answer this, go ahead and submit below anyway.
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <label htmlFor="description" className={labelClass}>
          More detail (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          placeholder="Anything that helps clarify what you're actually asking."
          className={`${fieldClass} w-full`}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelClass}>
            Category (optional)
          </label>
          <select id="category" name="category" defaultValue="" className={`${fieldClass} w-full`}>
            <option value="">No category</option>
            {categories
              .filter((category) => category.slug !== "tools")
              .map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.title}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="tagsInput" className={labelClass}>
            Tags (optional, comma-separated)
          </label>
          <input id="tagsInput" name="tagsInput" placeholder="threshold, marathon" className={`${fieldClass} w-full`} />
        </div>
      </div>

      <div>
        <label htmlFor="displayName" className={labelClass}>
          Name (optional)
        </label>
        <input
          id="displayName"
          name="displayName"
          maxLength={60}
          placeholder="Leave blank to post anonymously"
          className={`${fieldClass} w-full`}
        />
      </div>

      {sourceSectionSlug ? <input type="hidden" name="sourceSectionSlug" value={sourceSectionSlug} /> : null}

      {/* Honeypot -- invisible to real visitors, irresistible to bots that
          fill every field. A non-empty value here silently fails validation. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}
