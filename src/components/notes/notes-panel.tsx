"use client";

import type { ContentBlock } from "@/lib/sections";
import type { Note, NoteAnchor } from "@/lib/notes/types";
import { NoteCard } from "@/components/notes/note-card";
import { EmptyState } from "@/components/ui/empty-state";

export type DraftNote = {
  localId: string;
  selectedText: string | null;
  anchor: NoteAnchor | null;
};

type NotesPanelProps = {
  content: ContentBlock[];
  contentSlug: string;
  notes: Note[] | null;
  drafts: DraftNote[];
  onAddGeneral: () => void;
  onDraftDeleted: (localId: string) => void;
  onNoteDeleted: (id: string) => void;
  // Only ever relevant to a highlighted-passage note -- see note-card.tsx's
  // own isSourceNavigable check -- so it's only threaded to those two
  // render sites below, not the general-note ones.
  onNavigateToSource: () => void;
};

export function NotesPanel({
  content,
  contentSlug,
  notes,
  drafts,
  onAddGeneral,
  onDraftDeleted,
  onNoteDeleted,
  onNavigateToSource,
}: NotesPanelProps) {
  if (notes === null) {
    return <p className="py-6 text-sm text-zinc-500 dark:text-zinc-400">Loading notes…</p>;
  }

  const generalDrafts = drafts.filter((d) => !d.selectedText);
  const anchoredDrafts = drafts.filter((d) => d.selectedText);
  const generalNotes = notes.filter((n) => !n.selectedText);
  const highlightedNotes = notes.filter((n) => n.selectedText);

  const isEmpty = notes.length === 0 && drafts.length === 0;

  return (
    <div>
      {/* mb-5 moved onto this wrapper, not the button itself -- the button
          below also needs -my-1 (a *different* margin-bottom value) for its
          own touch-target fix, and two utility classes writing the same
          property on the same element leaves the outcome to Tailwind's
          stylesheet generation order rather than JSX order (the same class
          of bug already found and fixed twice elsewhere in this codebase,
          for --tw-outline-style and translate-x). Separate elements, no
          collision. */}
      <div className="mb-5">
        {/* py-1 -my-1: the text alone (text-sm, no padding) was only ~20px
            tall, under the 24px WCAG 2.5.8 target-size floor -- padding
            widens the real hit area, the matching negative margin keeps the
            visible position/spacing identical to before. */}
        <button
          type="button"
          onClick={onAddGeneral}
          className="-my-1 flex items-center gap-1.5 py-1 text-sm font-semibold text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Add a general note
        </button>
      </div>

      {isEmpty ? (
        <EmptyState>
          Keep your own notes as you read. Select a passage to attach a note to it, or start a general note above.
          Notes save automatically and are private to your account.
        </EmptyState>
      ) : null}

      {anchoredDrafts.length + highlightedNotes.length > 0 ? (
        <section className="mb-6">
          {/* dark:text-zinc-500 measured 3.67:1 against the panel --
              fails the 4.5:1 normal-text floor even for this small
              uppercase eyebrow label (its size/weight don't reach WCAG's
              "large text" bold threshold, so it needs the normal-text
              ratio like any other small copy). zinc-400 measures 6.91:1. */}
          <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-zinc-400 uppercase dark:text-zinc-400">
            Highlighted passages
          </p>
          {anchoredDrafts.map((draft) => (
            <NoteCard
              key={draft.localId}
              content={content}
              contentSlug={contentSlug}
              note={{ body: "", selectedText: draft.selectedText, anchor: draft.anchor }}
              onDeleted={() => onDraftDeleted(draft.localId)}
              onNavigateToSource={onNavigateToSource}
              autoFocus
            />
          ))}
          {highlightedNotes.map((note) => (
            <NoteCard
              key={note.id}
              content={content}
              contentSlug={contentSlug}
              note={note}
              onDeleted={() => onNoteDeleted(note.id)}
              onNavigateToSource={onNavigateToSource}
            />
          ))}
        </section>
      ) : null}

      {generalDrafts.length + generalNotes.length > 0 ? (
        <section>
          {/* dark:text-zinc-500 measured 3.67:1 against the panel --
              fails the 4.5:1 normal-text floor even for this small
              uppercase eyebrow label (its size/weight don't reach WCAG's
              "large text" bold threshold, so it needs the normal-text
              ratio like any other small copy). zinc-400 measures 6.91:1. */}
          <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-zinc-400 uppercase dark:text-zinc-400">
            General
          </p>
          {generalDrafts.map((draft) => (
            <NoteCard
              key={draft.localId}
              content={content}
              contentSlug={contentSlug}
              note={{ body: "", selectedText: null, anchor: null }}
              onDeleted={() => onDraftDeleted(draft.localId)}
              autoFocus
            />
          ))}
          {generalNotes.map((note) => (
            <NoteCard
              key={note.id}
              content={content}
              contentSlug={contentSlug}
              note={note}
              onDeleted={() => onNoteDeleted(note.id)}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
