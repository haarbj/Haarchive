import type { NotificationType } from "@/lib/notifications/types";

// Every place a notification's related_entity_id can actually be resolved
// to a page the recipient has access to -- see the trigger call sites
// (contribute/review/actions.ts, admin/articles/actions.ts,
// bug-report-actions.ts, etc.) for why each of these specifically, e.g.
// article_comment links to the author's own edit page rather than the
// reviewer-only /contribute/review/[id], which the author has no access to.
// Extracted from notification-bell.tsx (its only consumer) so this pure
// mapping is unit-testable under tests/lib/ -- this project has no
// tests/components/ precedent, and everything else this shape of pure/
// testable lives in src/lib/.
export function notificationHref(type: NotificationType, relatedEntityId: string | null): string | null {
  if (type === "article_comment" || type === "article_status_changed") {
    return relatedEntityId ? `/contribute/articles/${relatedEntityId}` : null;
  }
  if (type === "question_comment") {
    return relatedEntityId ? `/contribute/questions/${relatedEntityId}` : null;
  }
  if (type === "suggestion_reviewed") {
    return "/contribute/suggestions";
  }
  if (type === "user_signed_up") {
    return "/admin/users";
  }
  if (type === "contributor_application_submitted") {
    return "/admin/contributor-applications";
  }
  if (type === "question_submitted") {
    return relatedEntityId ? `/admin/questions/${relatedEntityId}` : "/admin/questions";
  }
  if (type === "bug_report_submitted") {
    // No per-report detail page exists (out of scope for this feature) --
    // relatedEntityId is still stored on the notification (see
    // bug-report-actions.ts) so a future detail page can deep-link into it
    // without a data migration; for now every bug-report notification lands
    // the same place, the inbox itself.
    return "/admin/bug-reports";
  }
  return null;
}
