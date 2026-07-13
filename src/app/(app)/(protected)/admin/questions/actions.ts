"use server";

import { revalidatePath } from "next/cache";
import { APICallError, generateObject } from "ai";
import { z } from "zod";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { structuredOutputModel } from "@/lib/ai/model";
import { buildContentSuggestionPrompt } from "@/lib/ai/prompts";
import { retrieveRelevantContent } from "@/lib/ai/retrieval";
import { sections } from "@/lib/sections";
import { adminUpdateQuestionSchema } from "@/lib/validation/questions";

export type AdminActionState = { error?: string; success?: boolean };

export async function updateQuestion(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await getAppSession();
  if (!session?.isAdmin) return { error: "Not authorized." };

  const questionId = formData.get("questionId");
  if (typeof questionId !== "string" || !questionId) return { error: "Missing question." };

  const parsed = adminUpdateQuestionSchema.safeParse({
    title: formData.get("title") ?? undefined,
    description: formData.get("description") ?? undefined,
    category: formData.get("category") ?? undefined,
    tagsInput: formData.get("tagsInput") ?? undefined,
    status: formData.get("status") ?? undefined,
    adminNotes: formData.get("adminNotes") ?? undefined,
    adminResponse: formData.get("adminResponse") ?? undefined,
    isFaq: formData.get("isFaq") ?? undefined,
    linkedSectionSlug: formData.get("linkedSectionSlug") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  // A question can't be marked answered (or added to the public FAQ)
  // without something to actually show a reader -- the public-facing
  // response field is what fills that role.
  const needsResponse = parsed.data.status === "answered" || parsed.data.isFaq;
  if (needsResponse && !parsed.data.adminResponse) {
    return { error: "Add a response before marking this answered or adding it to the FAQ." };
  }

  const admin = createServiceRoleClient();
  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.description !== undefined) update.description = parsed.data.description ?? null;
  if (parsed.data.category !== undefined) update.category = parsed.data.category ?? null;
  if (parsed.data.tagsInput !== undefined) update.tags = parsed.data.tagsInput;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.adminNotes !== undefined) update.admin_notes = parsed.data.adminNotes ?? null;
  if (parsed.data.adminResponse !== undefined) update.admin_response = parsed.data.adminResponse ?? null;
  if (parsed.data.isFaq !== undefined) update.is_faq = parsed.data.isFaq;
  if (parsed.data.linkedSectionSlug !== undefined) update.linked_section_slug = parsed.data.linkedSectionSlug ?? null;

  const { error } = await admin.from("questions").update(update).eq("id", questionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${questionId}`);
  revalidatePath("/questions");
  revalidatePath("/faq");
  return { success: true };
}

export async function archiveQuestion(questionId: string): Promise<AdminActionState> {
  const session = await getAppSession();
  if (!session?.isAdmin) return { error: "Not authorized." };

  const admin = createServiceRoleClient();
  const { error } = await admin.from("questions").update({ visible: false }).eq("id", questionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/questions");
  revalidatePath("/questions");
  return { success: true };
}

export async function deleteQuestion(questionId: string): Promise<AdminActionState> {
  const session = await getAppSession();
  if (!session?.isAdmin) return { error: "Not authorized." };

  const admin = createServiceRoleClient();
  const { error } = await admin.from("questions").delete().eq("id", questionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/questions");
  revalidatePath("/questions");
  return { success: true };
}

// Folds source into target: unions tags, adds source's upvotes onto
// target's count, marks source invisible and pointing at target so its
// upvoters' clicks (and any future admin lookup) resolve to one place.
export async function mergeQuestions(sourceId: string, targetId: string): Promise<AdminActionState> {
  const session = await getAppSession();
  if (!session?.isAdmin) return { error: "Not authorized." };
  if (sourceId === targetId) return { error: "Can't merge a question into itself." };

  const admin = createServiceRoleClient();
  const [{ data: source }, { data: target }] = await Promise.all([
    admin.from("questions").select("tags, upvote_count").eq("id", sourceId).single(),
    admin.from("questions").select("tags, upvote_count").eq("id", targetId).single(),
  ]);
  if (!source || !target) return { error: "Question not found." };

  const mergedTags = Array.from(new Set([...(target.tags ?? []), ...(source.tags ?? [])]));

  const { error: targetError } = await admin
    .from("questions")
    .update({ tags: mergedTags, upvote_count: target.upvote_count + source.upvote_count })
    .eq("id", targetId);
  if (targetError) return { error: targetError.message };

  const { error: sourceError } = await admin
    .from("questions")
    .update({ visible: false, merged_into_id: targetId })
    .eq("id", sourceId);
  if (sourceError) return { error: sourceError.message };

  revalidatePath("/admin/questions");
  revalidatePath("/questions");
  return { success: true };
}

const contentSuggestionSchema = z.object({
  suggestedTitle: z.string(),
  category: z.string(),
  outline: z.array(z.string()),
  relatedPages: z.array(z.string()),
  internalLinkSuggestions: z.array(z.string()),
  draftBody: z.string(),
});

export type ContentSuggestion = z.infer<typeof contentSuggestionSchema>;
export type GenerateSuggestionResult = { suggestion: ContentSuggestion } | { error: string };

// The one place this codebase uses generateObject instead of generateText --
// everywhere else the model's output is read as prose by an end user; here
// the admin dashboard needs to render and act on discrete fields (title,
// outline, related pages) individually. Result is stored on the question
// row so it survives a page reload; the "Regenerate" button calls this
// again rather than anything auto-refreshing.
export async function generateContentSuggestion(
  questionId: string,
  mode: "expand" | "new_article",
): Promise<GenerateSuggestionResult> {
  const session = await getAppSession();
  if (!session?.isAdmin) return { error: "Not authorized." };

  const admin = createServiceRoleClient();
  const { data: question } = await admin
    .from("questions")
    .select("title, description, type, category")
    .eq("id", questionId)
    .single();
  if (!question) return { error: "Question not found." };

  const excerpts = retrieveRelevantContent(
    [question.title, question.description ?? ""].join(" "),
    sections,
    6,
  );
  const prompt = buildContentSuggestionPrompt(
    {
      title: question.title,
      description: question.description,
      type: question.type,
      category: question.category,
    },
    excerpts,
    mode,
  );

  let suggestion: ContentSuggestion;
  try {
    const result = await generateObject({
      model: structuredOutputModel,
      schema: contentSuggestionSchema,
      prompt,
    });
    suggestion = result.object;
  } catch (err) {
    const isRateLimited = err instanceof APICallError && err.statusCode === 429;
    return {
      error: isRateLimited
        ? "Hitting the model's rate limit right now — try again in a minute."
        : "Couldn't generate a suggestion right now — try again in a moment.",
    };
  }

  await admin.from("questions").update({ ai_suggestion: suggestion }).eq("id", questionId);
  revalidatePath(`/admin/questions/${questionId}`);
  return { suggestion };
}
