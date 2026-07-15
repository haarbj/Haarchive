import { describe, expect, it } from "vitest";

import { mapQuestionCommentRow, mapQuestionRow } from "@/lib/questions/map-row";

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    type: "question",
    title: "Why does easy running matter?",
    description: null,
    category: null,
    tags: [],
    status: "new",
    display_name: null,
    source_section_slug: null,
    upvote_count: 0,
    is_faq: false,
    admin_notes: null,
    admin_response: null,
    linked_section_slug: null,
    ai_suggestion: null,
    visible: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("mapQuestionRow", () => {
  it("defaults assignedTo/assignedReviewer/draftAnswer to null when columns are absent", () => {
    const result = mapQuestionRow(baseRow());
    expect(result.assignedTo).toBeNull();
    expect(result.assignedReviewer).toBeNull();
    expect(result.draftAnswer).toBeNull();
  });

  it("maps assigned_to/assigned_reviewer/draft_answer when present", () => {
    const result = mapQuestionRow(
      baseRow({ assigned_to: "user-1", assigned_reviewer: "user-2", draft_answer: "Here's a draft." }),
    );
    expect(result.assignedTo).toBe("user-1");
    expect(result.assignedReviewer).toBe("user-2");
    expect(result.draftAnswer).toBe("Here's a draft.");
  });

  it("still maps every pre-existing field unchanged", () => {
    const result = mapQuestionRow(baseRow({ title: "A real question", is_faq: true }));
    expect(result.title).toBe("A real question");
    expect(result.isFaq).toBe(true);
  });
});

describe("mapQuestionCommentRow", () => {
  it("maps snake_case columns to camelCase fields", () => {
    const result = mapQuestionCommentRow({
      id: "comment-1",
      question_id: "q-1",
      user_id: "user-2",
      comment: "Needs more nuance.",
      resolved: false,
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(result.questionId).toBe("q-1");
    expect(result.userId).toBe("user-2");
    expect(result.resolved).toBe(false);
  });

  it("defaults resolved to false and userId to null when absent", () => {
    const result = mapQuestionCommentRow({
      id: "comment-1",
      question_id: "q-1",
      comment: "General note.",
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(result.userId).toBeNull();
    expect(result.resolved).toBe(false);
  });
});
