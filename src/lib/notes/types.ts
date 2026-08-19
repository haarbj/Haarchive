// A text-quote anchor, not a character offset or bare array index -- see
// the notes migration's own comment for why. blockIndex is a fast-path
// resolution hint only, never trusted without also matching prefix/suffix
// (or, failing that, an unambiguous quote-alone match) against the
// article's *current* content -- see resolveAnchor in anchor.ts.
export type NoteAnchor = {
  prefix: string;
  suffix: string;
  blockIndex: number;
};

export type Note = {
  id: string;
  userId: string;
  contentSlug: string;
  body: string;
  selectedText: string | null;
  anchor: NoteAnchor | null;
  createdAt: string;
  updatedAt: string;
};

export type NoteRow = {
  id: string;
  user_id: string;
  content_slug: string;
  body: string;
  selected_text: string | null;
  anchor: NoteAnchor | null;
  created_at: string;
  updated_at: string;
};

export function mapNoteRow(row: NoteRow): Note {
  return {
    id: row.id,
    userId: row.user_id,
    contentSlug: row.content_slug,
    body: row.body,
    selectedText: row.selected_text,
    anchor: row.anchor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
