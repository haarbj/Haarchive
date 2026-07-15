export type QuestionStatus =
  | "new"
  | "under_review"
  | "planned"
  | "researching"
  | "answered"
  | "added_to_library";

export type QuestionType = "question" | "topic_suggestion";

export type Question = {
  id: string;
  type: QuestionType;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  status: QuestionStatus;
  displayName: string | null;
  sourceSectionSlug: string | null;
  upvoteCount: number;
  isFaq: boolean;
  adminNotes: string | null;
  adminResponse: string | null;
  linkedSectionSlug: string | null;
  aiSuggestion: unknown;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
  // Contributor collaboration (see /contribute/questions and the
  // question-triage-panel's AssignmentPanel) -- additive to the existing
  // triage workflow above, not a replacement for adminResponse/status.
  assignedTo: string | null;
  assignedReviewer: string | null;
  draftAnswer: string | null;
};

export type QuestionComment = {
  id: string;
  questionId: string;
  userId: string | null;
  comment: string;
  resolved: boolean;
  createdAt: string;
};

export const STATUS_LABELS: Record<QuestionStatus, string> = {
  new: "New",
  under_review: "Under Review",
  planned: "Planned",
  researching: "Researching",
  answered: "Answered",
  added_to_library: "Added to Library",
};

export const STATUS_ORDER: QuestionStatus[] = [
  "new",
  "under_review",
  "planned",
  "researching",
  "answered",
  "added_to_library",
];
