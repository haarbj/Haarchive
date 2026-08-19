"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { fieldClass } from "@/lib/form-styles";
import { formatRelativeTime } from "@/lib/format";
import { filterNotesByCategory, groupNotesByTopic, searchNotes, sortNotes, type LibraryNote, type NoteSort } from "@/lib/library/notes";
import { EmptyState } from "@/components/ui/empty-state";

type MyNotesSectionProps = {
  notes: LibraryNote[];
};

// The centerpiece of the Library (see Phase 5's own framing) -- every note
// the user has ever taken, across every topic, searchable and sortable.
// Client-side filtering only (Phase 1, per spec): the full note set is
// already fetched server-side by the page, this just narrows what's shown.
// No folders, no manual organization -- the archive groups itself by the
// topic each note already belongs to.
export function MyNotesSection({ notes }: MyNotesSectionProps) {
  const [query, setQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [sort, setSort] = useState<NoteSort>("newest");

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const note of notes) {
      if (note.categorySlug && note.categoryTitle) seen.set(note.categorySlug, note.categoryTitle);
    }
    return [...seen.entries()];
  }, [notes]);

  const filtered = useMemo(() => {
    const bySearch = searchNotes(notes, query);
    const byCategory = filterNotesByCategory(bySearch, categorySlug);
    return sortNotes(byCategory, sort);
  }, [notes, query, categorySlug, sort]);

  const grouped = useMemo(() => groupNotesByTopic(filtered), [filtered]);

  if (notes.length === 0) {
    return (
      <div className="mt-3">
        <EmptyState>
          No notes yet. Highlight a passage on any article and add a note -- it will show up here.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="notes-search">
          Search notes
        </label>
        <input
          id="notes-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes…"
          className={`w-full max-w-xs ${fieldClass}`}
        />

        {categories.length > 0 ? (
          <>
            <label className="sr-only" htmlFor="notes-category-filter">
              Filter by category
            </label>
            <select
              id="notes-category-filter"
              value={categorySlug ?? ""}
              onChange={(event) => setCategorySlug(event.target.value || null)}
              className={fieldClass}
            >
              <option value="">All categories</option>
              {categories.map(([slug, title]) => (
                <option key={slug} value={slug}>
                  {title}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <label className="sr-only" htmlFor="notes-sort">
          Sort notes
        </label>
        <select
          id="notes-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as NoteSort)}
          className={fieldClass}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState>No notes match that search.</EmptyState>
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          {[...grouped.entries()].map(([topicTitle, topicNotes]) => (
            <div key={topicTitle}>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{topicTitle}</h3>
              <div className="mt-3 space-y-4">
                {topicNotes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/${note.contentSlug}?note=${note.id}`}
                    className="block rounded-card border border-black/10 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-card-hover dark:border-white/10 dark:bg-zinc-900"
                  >
                    {note.selectedText ? (
                      <blockquote className="border-l-2 border-zinc-900/15 pl-3 text-sm text-zinc-500 italic dark:border-white/20 dark:text-zinc-400">
                        &ldquo;{note.selectedText}&rdquo;
                      </blockquote>
                    ) : null}
                    {note.body ? (
                      <p className={`text-sm text-zinc-700 dark:text-zinc-200 ${note.selectedText ? "mt-2" : ""}`}>
                        {note.body}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                      Updated {formatRelativeTime(note.updatedAt)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
