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
  // Coach -> athlete, the opposite direction of checkin_submitted: a
  // "going quiet" adaptation card's own proposed action (see
  // adaptation-signals.ts) is nothing more than this one notification --
  // no new flow, just the existing check-in system's other direction.
  | "checkin_requested"
  | "pain_reported"
  | "race_approaching"
  | "missed_workout"
  // Post-race structured review (Part H follow-up): sent to the athlete
  // when the coach sends the post-season review, submitted to the coach
  // when the athlete finishes it.
  | "post_season_review_sent"
  | "post_season_review_submitted"
  // Fired once per assignProgramToAthlete call, regardless of how many
  // days/weeks it created -- that RPC writes scheduled_workouts rows
  // directly rather than through saveScheduledWorkout, so nothing else
  // notifies the athlete that a program landed on their calendar at all.
  | "program_assigned"
  // Club intake (see club-intake/actions.ts): club_intake_submitted goes
  // to admins per submission (name, proposed framework, flags) and as the
  // daily digest; club_intake_queued is the athlete-facing "you're in the
  // queue" confirmation; club_intake_interest_1on1 is the automated "yes"
  // reply for 1-on-1 interest. No separate approval notification exists --
  // "plan assigned" is already program_assigned above, fired later when a
  // coach actually generates the plan, not at queue-approval time.
  | "club_intake_submitted"
  | "club_intake_queued"
  | "club_intake_interest_1on1";
