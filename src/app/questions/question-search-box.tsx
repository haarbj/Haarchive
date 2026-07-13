"use client";

import { useEffect, useRef, useState } from "react";

import { searchExistingQuestions, type QuestionSearchResult } from "@/app/questions/actions";
import { STATUS_LABELS, type QuestionStatus } from "@/lib/questions/types";
import { fieldClass } from "@/lib/form-styles";

export function QuestionSearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuestionSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      const data = await searchExistingQuestions(query);
      setResults(data);
      setLoading(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search existing questions before asking a new one…"
        className={`${fieldClass} w-full`}
        aria-label="Search existing questions"
      />

      {query.trim() && (loading || results.length > 0) ? (
        <div className="mt-3 space-y-2 rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
          {loading ? (
            <p className="px-2 py-1 text-sm text-zinc-500 dark:text-zinc-400">Searching…</p>
          ) : (
            <>
              <p className="px-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Already asked — upvote instead of duplicating
              </p>
              {results.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm"
                >
                  <span className="text-zinc-800 dark:text-zinc-200">{result.title}</span>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {STATUS_LABELS[result.status as QuestionStatus] ?? result.status} · {result.upvoteCount} upvotes
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
