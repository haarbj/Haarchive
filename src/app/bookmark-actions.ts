"use server";

// "Saved Topics" (Phase 5) server actions. Same identity convention as
// notes/actions.ts and learning-actions.ts (supabase.auth.getClaims(),
// never a client-supplied user id), and the same RLS-scoped (not
// service-role) client notes/actions.ts uses -- bookmarks_insert_own/
// delete_own/select_own already enforce ownership at the database, so
// there's nothing a service-role bypass would add here.

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { mapBookmarkRow, type BookmarkRow } from "@/lib/bookmarks/types";

export type BookmarkActionResult = { bookmarked: boolean } | { error: string };

// Idempotent by design (matches "one-click toggle, no duplicate rows"):
// the table's own unique(user_id, topic_slug) constraint is the real
// guarantee, not just this check -- a race between two rapid clicks (or a
// replayed request) can never produce two rows for the same topic. A
// unique_violation here just means it was already bookmarked, which is
// exactly the state the caller wanted, so it's treated as success, not an
// error surfaced to the user.
export async function addBookmark(topicSlug: string): Promise<BookmarkActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sign in to save topics." };

  const { error } = await supabase.from("bookmarks").insert({ user_id: userId, topic_slug: topicSlug });
  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath("/library");
  return { bookmarked: true };
}

// Equally idempotent the other direction -- deleting a row that's already
// gone (a double-click, a stale optimistic retry) matches 0 rows and
// returns success rather than an error.
export async function removeBookmark(topicSlug: string): Promise<BookmarkActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sign in to save topics." };

  const { error } = await supabase.from("bookmarks").delete().eq("user_id", userId).eq("topic_slug", topicSlug);
  if (error) return { error: error.message };

  revalidatePath("/library");
  return { bookmarked: false };
}

// Server-side initial state for a topic page's BookmarkButton -- avoids a
// client-side flash from "not bookmarked" to "bookmarked" for the minority
// of visitors who already saved this topic (the same reasoning
// knowledge-check-actions.ts's getKnowledgeCheckForTopic already applies
// to its own currentLevel field). Returns false without querying at all
// for a signed-out visitor, matching every other learning-feature action's
// anonymous-visitor no-op convention.
export async function getBookmarkStatus(topicSlug: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return false;

  const { data: row } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("topic_slug", topicSlug)
    .maybeSingle();
  return !!row;
}

// Library page's own bulk fetch -- one query for every bookmark this user
// has, rather than N calls to getBookmarkStatus. RLS already scopes this
// to the caller's own rows.
export async function getAllBookmarks() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return [];

  const { data: rows } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<BookmarkRow[]>();
  return (rows ?? []).map(mapBookmarkRow);
}
