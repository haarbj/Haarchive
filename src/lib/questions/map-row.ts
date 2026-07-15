import type { Question, QuestionComment } from "@/lib/questions/types";

// Supabase rows come back snake_case; every page/component in this feature
// works with the camelCase Question type instead, so this is the one place
// that translation happens.
export function mapQuestionRow(row: Record<string, unknown>): Question {
  return {
    id: row.id as string,
    type: row.type as Question["type"],
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? [],
    status: row.status as Question["status"],
    displayName: (row.display_name as string | null) ?? null,
    sourceSectionSlug: (row.source_section_slug as string | null) ?? null,
    upvoteCount: (row.upvote_count as number | null) ?? 0,
    isFaq: (row.is_faq as boolean | null) ?? false,
    adminNotes: (row.admin_notes as string | null) ?? null,
    adminResponse: (row.admin_response as string | null) ?? null,
    linkedSectionSlug: (row.linked_section_slug as string | null) ?? null,
    aiSuggestion: row.ai_suggestion ?? null,
    visible: (row.visible as boolean | null) ?? true,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    assignedTo: (row.assigned_to as string | null) ?? null,
    assignedReviewer: (row.assigned_reviewer as string | null) ?? null,
    draftAnswer: (row.draft_answer as string | null) ?? null,
  };
}

export function mapQuestionCommentRow(row: Record<string, unknown>): QuestionComment {
  return {
    id: row.id as string,
    questionId: row.question_id as string,
    userId: (row.user_id as string | null) ?? null,
    comment: row.comment as string,
    resolved: (row.resolved as boolean | null) ?? false,
    createdAt: row.created_at as string,
  };
}
