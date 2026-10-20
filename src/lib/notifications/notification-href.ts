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
  if (type === "coaching_invite_received") {
    // relatedEntityId is the invite's token (see inviteAthlete) -- routes
    // straight to the same accept-or-sign-in page the copy-link workflow
    // already uses, /coaching-invite/[token], not a separate destination.
    return relatedEntityId ? `/coaching-invite/${relatedEntityId}` : "/coaching";
  }
  if (
    type === "workout_assigned" ||
    type === "workout_updated" ||
    type === "workout_completed" ||
    type === "workout_comment" ||
    type === "missed_workout"
  ) {
    return relatedEntityId ? `/coaching/workouts/${relatedEntityId}` : "/coaching";
  }
  if (type === "message_received") {
    // relatedEntityId is the coach_athlete_id (see sendCoachAthleteMessage)
    // -- routes straight into that specific thread, which now exists
    // (/coaching/messages/[coachAthleteId]).
    return relatedEntityId ? `/coaching/messages/${relatedEntityId}` : "/coaching";
  }
  if (type === "checkin_requested") {
    // The coach's own "send a check-in request" adaptation-card action --
    // routes straight to the athlete's existing check-in submission page,
    // the exact same destination checkin_submitted's own coach-side view
    // is about.
    return "/coaching/checkin";
  }
  if (type === "checkin_submitted") {
    // relatedEntityId is the submitting athlete's user id (see
    // checkin/actions.ts) -- the coach's per-athlete page now renders their
    // latest check-in directly.
    return relatedEntityId ? `/coaching/athletes/${relatedEntityId}` : "/coaching";
  }
  if (type === "post_season_review_sent") {
    // relatedEntityId is the post_season_review_requests id (see
    // sendPostSeasonReview) -- routes the athlete straight to their own
    // structured form for it.
    return relatedEntityId ? `/coaching/post-season-review/${relatedEntityId}` : "/coaching";
  }
  if (type === "post_season_review_submitted") {
    // relatedEntityId is the submitting athlete's user id (see
    // submitPostSeasonReview). Routes to the athlete detail page, not
    // .../schedule -- that's where PostSeasonReviewSection lives, and
    // unlike the schedule page's own PostRacePanel (which only renders
    // once a goal race has passed), it lists every review ever sent for
    // this athlete regardless of whether one was sent manually (no goal
    // race at all) or through the goal-race flow. A review sent manually
    // had genuinely nowhere to be found from this link before -- see the
    // bug report this fixed.
    return relatedEntityId ? `/coaching/athletes/${relatedEntityId}` : "/coaching";
  }
  if (type === "program_assigned") {
    // Recipient is the athlete themselves (see assignProgramToAthlete),
    // and relatedEntityId is their own user id -- not useful as a path
    // segment here since the coach-only /coaching/athletes/[athleteId]/
    // schedule route would just redirect them away (requireCoachOf-gated).
    // /coaching/training is the athlete-facing equivalent, where the newly
    // assigned phase actually shows.
    return "/coaching/training";
  }
  if (type === "pain_reported" || type === "race_approaching") {
    // pain_reported is fired from two different places with two different
    // relatedEntityId shapes (checkin/actions.ts passes the athlete's user
    // id; completion-actions.ts passes a scheduled_workout id) -- there's
    // no way to tell which one a bare id is here, so this deliberately
    // stays on the generic, always-valid /coaching landing rather than
    // guessing and risking a 404 for the other source. race_approaching is
    // never actually fired yet (see attention.ts) -- same safe fallback.
    return "/coaching";
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
