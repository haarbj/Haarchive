// Split out from create-notification.ts (which has `import "server-only"`)
// so the client-side notification bell can import just the type without
// pulling a server-only guard into a client bundle.
export type NotificationType =
  | "article_comment"
  | "question_comment"
  | "suggestion_reviewed"
  | "citation_reviewed"
  | "application_reviewed"
  | "article_status_changed"
  | "user_signed_up"
  | "question_submitted"
  | "contributor_application_submitted";
