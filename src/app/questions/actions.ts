"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { retrieveRelevantContent, type RetrievedExcerpt } from "@/lib/ai/retrieval";
import { sections } from "@/lib/sections";
import { submitQuestionSchema } from "@/lib/validation/questions";

const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX = 5;

// Hybrid identity: a signed-in visitor's account is the identity; a
// signed-out visitor gets a cookie-issued anon id. Every write in this file
// goes through the service-role client (see the questions migration's own
// comment) -- there is no RLS write policy to satisfy here, so this
// resolution is the only place trust is actually established.
async function resolveIdentity(): Promise<{ userId: string | null; anonId: string | null }> {
  const session = await getAppSession();
  if (session) return { userId: session.userId, anonId: null };
  return { userId: null, anonId: await getOrCreateAnonId() };
}

export type SubmitQuestionState = { error?: string; success?: boolean; questionId?: string };

export async function submitQuestion(
  _prevState: SubmitQuestionState,
  formData: FormData,
): Promise<SubmitQuestionState> {
  const parsed = submitQuestionSchema.safeParse({
    type: formData.get("type") ?? undefined,
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    category: formData.get("category") ?? undefined,
    tagsInput: formData.get("tagsInput") ?? undefined,
    displayName: formData.get("displayName") ?? undefined,
    sourceSectionSlug: formData.get("sourceSectionSlug") ?? undefined,
    website: formData.get("website") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your submission" };
  }

  const { userId, anonId } = await resolveIdentity();
  const admin = createServiceRoleClient();

  const identityColumn = userId ? "user_id" : "anon_id";
  const identityValue = userId ?? anonId;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq(identityColumn, identityValue as string)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return { error: "You've submitted several questions recently — give it a bit before adding more." };
  }

  const { data, error } = await admin
    .from("questions")
    .insert({
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category: parsed.data.category ?? null,
      tags: parsed.data.tagsInput,
      display_name: parsed.data.displayName ?? null,
      source_section_slug: parsed.data.sourceSectionSlug ?? null,
      user_id: userId,
      anon_id: anonId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/questions");
  return { success: true, questionId: data.id };
}

export type ToggleUpvoteResult = { upvoted: boolean; count: number; error?: undefined } | { error: string };

export async function toggleUpvote(questionId: string): Promise<ToggleUpvoteResult> {
  const { userId, anonId } = await resolveIdentity();
  const admin = createServiceRoleClient();
  const identityColumn = userId ? "user_id" : "anon_id";
  const identityValue = userId ?? anonId;

  const { data: existing } = await admin
    .from("question_upvotes")
    .select("id")
    .eq("question_id", questionId)
    .eq(identityColumn, identityValue as string)
    .maybeSingle();

  if (existing) {
    await admin.from("question_upvotes").delete().eq("id", existing.id);
  } else {
    const { error } = await admin
      .from("question_upvotes")
      .insert({ question_id: questionId, user_id: userId, anon_id: anonId });
    // 23505 = unique-violation -- a double-click race against the partial
    // unique indexes, not a real error; the vote already exists either way.
    if (error && error.code !== "23505") return { error: error.message };
  }

  const { data: question } = await admin
    .from("questions")
    .select("upvote_count")
    .eq("id", questionId)
    .single();

  revalidatePath("/questions");
  return { upvoted: !existing, count: question?.upvote_count ?? 0 };
}

// Powers "search before asking" in the /questions/ask flow -- reuses the
// same keyword retrieval already built for the AI coach's context, zero new
// infrastructure.
export async function searchLibrary(query: string): Promise<RetrievedExcerpt[]> {
  if (!query.trim()) return [];
  return retrieveRelevantContent(query, sections, 4);
}

export type QuestionSearchResult = {
  id: string;
  title: string;
  status: string;
  upvoteCount: number;
};

// Powers the duplicate-question search box on /questions -- Postgres
// full-text search over the generated search_vector column, a public read
// under the questions_select_visible RLS policy so no service role is
// needed here.
export async function searchExistingQuestions(query: string): Promise<QuestionSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("questions")
    .select("id, title, status, upvote_count")
    .textSearch("search_vector", trimmed, { type: "plain" })
    .order("upvote_count", { ascending: false })
    .limit(8);

  return (data ?? []).map((q) => ({
    id: q.id as string,
    title: q.title as string,
    status: q.status as string,
    upvoteCount: q.upvote_count as number,
  }));
}
