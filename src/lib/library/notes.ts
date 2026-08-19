import type { Note } from "@/lib/notes/types";

// A note enriched with the display metadata the Library's "My Notes"
// section needs but the bare `notes` table row doesn't carry (title/
// category are derived at read time from sections.ts/the articles table,
// never duplicated into the row -- same "don't cache what you can derive"
// convention bookmarks.sql's own header comment states explicitly).
export type LibraryNote = Note & {
  topicTitle: string;
  // Null for a note on a DB-backed contributor article (see
  // library-data.ts's own resolution comment) -- those don't have a
  // taxonomy category the way a real topic does.
  categorySlug: string | null;
  categoryTitle: string | null;
};

export type NoteSort = "newest" | "oldest";

// Client-side filtering only (Phase 1, per spec -- no server search
// index). Matches against note body, the quoted passage, and the
// resolved article/topic title -- the three fields a user would
// plausibly remember and search by. Pure and independently testable from
// the component that wires it to an <input>.
export function searchNotes(notes: LibraryNote[], query: string): LibraryNote[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return notes;
  return notes.filter((note) => {
    const haystack = [note.body, note.selectedText ?? "", note.topicTitle].join(" \n ").toLowerCase();
    return haystack.includes(trimmed);
  });
}

export function filterNotesByCategory(notes: LibraryNote[], categorySlug: string | null): LibraryNote[] {
  if (!categorySlug) return notes;
  return notes.filter((note) => note.categorySlug === categorySlug);
}

export function sortNotes(notes: LibraryNote[], sort: NoteSort): LibraryNote[] {
  const sorted = [...notes].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  return sort === "newest" ? sorted.reverse() : sorted;
}

// Groups by topic in whatever order the input array is already in (the
// caller decides sort order first, then groups) -- Map preserves
// insertion order, so "group by topic" never silently re-sorts what
// sortNotes already decided.
export function groupNotesByTopic(notes: LibraryNote[]): Map<string, LibraryNote[]> {
  const groups = new Map<string, LibraryNote[]>();
  for (const note of notes) {
    const key = note.topicTitle;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(note);
  }
  return groups;
}
