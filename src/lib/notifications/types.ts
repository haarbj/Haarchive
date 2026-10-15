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
  | "contributor_application_submitted"
  | "bug_report_submitted"
  // Private 1-on-1 coaching -- the product brief's own eight names, plus
  // coaching_invite_received (added later: an existing account invited by
  // a coach needs a way to find the invite besides the coach handing them
  // the link out-of-band -- see inviteAthlete in coaching/roster/actions.ts).
  | "coaching_invite_received"
  | "workout_assigned"
  | "workout_updated"
  | "workout_completed"
  | "workout_comment"
  | "message_received"
  | "checkin_submitted"
  | "pain_reported"
  | "race_approaching"
  | "missed_workout"
  // Post-race structured review (Part H follow-up): sent to the athlete
  // when the coach sends the post-season review, submitted to the coach
  // when the athlete finishes it.
  | "post_season_review_sent"
  | "post_season_review_submitted";
