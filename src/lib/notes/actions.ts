"use server";

import { createClient } from "@/lib/db/server";
import type { NoteAnchor } from "@/lib/notes/types";
import { logLearningEvent } from "@/app/learning-actions";

// Same shape as pace-calculator-actions.ts (the established pattern for a
// personal, RLS-owned table): the RLS-scoped server client, not
// service-role -- notes_insert_own/update_own/delete_own already enforce
// ownership at the database, so there's nothing a service-role bypass would
// add here, and using it would be a real, unnecessary privilege escalation
// for a table that's supposed to be strictly per-user.

export type CreateNoteInput = {
  contentSlug: string;
  body: string;
  selectedText?: string | null;
  anchor?: NoteAnchor | null;
};

export type NoteActionResult = { id: string } | { error: string };

export async function createNote(input: CreateNoteInput): Promise<NoteActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sign in to take notes." };

  const { data: row, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      content_slug: input.contentSlug,
      body: input.body,
      selected_text: input.selectedText ?? null,
      anchor: input.anchor ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // A note is a genuine active-engagement signal (unlike a passive scroll)
  // -- only fired here, on creation, not from updateNoteBody's autosave
  // edits below, so retyping an existing note doesn't re-earn the signal.
  // No-ops silently if input.contentSlug isn't a recognized learning topic.
  //
  // Gated on real length (this table's own body column has no minimum --
  // Notes stays a personal tool with no such restriction): note_taken has
  // no "once ever" DB cap the way content_viewed/tool_used do (distinct
  // notes over time are a legitimately repeatable signal), but it is now
  // day-scoped like content_engaged/topic_revisited (see
  // note_taken_daily_cap migration, added in the Phase 3.1 integrity
  // audit) -- the diminishing-returns curve in algorithm.ts never floors
  // at zero, so an unlimited same-day count of notes could otherwise buy
  // real score in a single sitting without ever coming back on a
  // different day. A short pause mid-thought could make a note that grows
  // substantial later miss the length gate (autosave's 600ms debounce
  // means createNote only ever sees the value at the moment of that first
  // pause) -- an accepted trade-off, since under-counting is always safer
  // here than a real inflation vector.
  if (input.body.trim().length >= 15) {
    await logLearningEvent(input.contentSlug, "note_taken");
  }

  return { id: row.id as string };
}

export async function updateNoteBody(id: string, body: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sign in to take notes." };

  // .eq("user_id", userId) alongside RLS, not instead of it -- defense in
  // depth, same as deleteSavedCalculation's own comment-free convention in
  // pace-calculator-actions.ts.
  const { error } = await supabase.from("notes").update({ body }).eq("id", id).eq("user_id", userId);
  if (error) return { error: error.message };
  return {};
}

export async function deleteNote(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sign in to take notes." };

  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: error.message };
  return {};
}
