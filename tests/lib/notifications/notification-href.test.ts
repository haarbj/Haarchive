import { describe, expect, it } from "vitest";

import { notificationHref } from "@/lib/notifications/notification-href";

describe("notificationHref -- existing types (regression, unchanged by the bug-report integration)", () => {
  it("article_comment links to the article edit page when an id is present", () => {
    expect(notificationHref("article_comment", "article-1")).toBe("/contribute/articles/article-1");
  });

  it("article_comment returns null without an id", () => {
    expect(notificationHref("article_comment", null)).toBeNull();
  });

  it("article_status_changed links to the article edit page", () => {
    expect(notificationHref("article_status_changed", "article-2")).toBe("/contribute/articles/article-2");
  });

  it("question_comment links to the question edit page when an id is present", () => {
    expect(notificationHref("question_comment", "question-1")).toBe("/contribute/questions/question-1");
  });

  it("question_comment returns null without an id", () => {
    expect(notificationHref("question_comment", null)).toBeNull();
  });

  it("suggestion_reviewed always links to the suggestions inbox, regardless of id", () => {
    expect(notificationHref("suggestion_reviewed", null)).toBe("/contribute/suggestions");
    expect(notificationHref("suggestion_reviewed", "some-id")).toBe("/contribute/suggestions");
  });

  it("user_signed_up always links to /admin/users", () => {
    expect(notificationHref("user_signed_up", null)).toBe("/admin/users");
  });

  it("contributor_application_submitted always links to /admin/contributor-applications", () => {
    expect(notificationHref("contributor_application_submitted", null)).toBe("/admin/contributor-applications");
  });

  it("question_submitted deep-links to the specific question when an id is present", () => {
    expect(notificationHref("question_submitted", "question-9")).toBe("/admin/questions/question-9");
  });

  it("question_submitted falls back to the index without an id", () => {
    expect(notificationHref("question_submitted", null)).toBe("/admin/questions");
  });

  it("citation_reviewed and application_reviewed (no destination wired up) return null", () => {
    expect(notificationHref("citation_reviewed", "id")).toBeNull();
    expect(notificationHref("application_reviewed", "id")).toBeNull();
  });
});

describe("notificationHref -- private coaching", () => {
  it("coaching_invite_received deep-links to the invite page (relatedEntityId = invite token)", () => {
    expect(notificationHref("coaching_invite_received", "token-1")).toBe("/coaching-invite/token-1");
  });

  it("coaching_invite_received falls back to /coaching without an id", () => {
    expect(notificationHref("coaching_invite_received", null)).toBe("/coaching");
  });

  it.each(["workout_assigned", "workout_completed", "workout_comment", "missed_workout"] as const)(
    "%s deep-links to the specific workout when an id is present",
    (type) => {
      expect(notificationHref(type, "workout-1")).toBe("/coaching/workouts/workout-1");
    },
  );

  it.each(["workout_assigned", "workout_completed", "workout_comment", "missed_workout"] as const)(
    "%s falls back to /coaching without an id",
    (type) => {
      expect(notificationHref(type, null)).toBe("/coaching");
    },
  );

  it("message_received deep-links to the specific thread (relatedEntityId = coach_athlete_id)", () => {
    expect(notificationHref("message_received", "rel-1")).toBe("/coaching/messages/rel-1");
  });

  it("message_received falls back to /coaching without an id", () => {
    expect(notificationHref("message_received", null)).toBe("/coaching");
  });

  it("checkin_submitted deep-links to the athlete's page (relatedEntityId = athlete user id)", () => {
    expect(notificationHref("checkin_submitted", "athlete-1")).toBe("/coaching/athletes/athlete-1");
  });

  it("checkin_submitted falls back to /coaching without an id", () => {
    expect(notificationHref("checkin_submitted", null)).toBe("/coaching");
  });

  it("post_season_review_sent deep-links the athlete to their own form (relatedEntityId = request id)", () => {
    expect(notificationHref("post_season_review_sent", "request-1")).toBe("/coaching/post-season-review/request-1");
  });

  it("post_season_review_sent falls back to /coaching without an id", () => {
    expect(notificationHref("post_season_review_sent", null)).toBe("/coaching");
  });

  it("post_season_review_submitted deep-links the coach to the athlete detail page, not .../schedule -- PostSeasonReviewSection there lists every sent review regardless of goal-race status, which PostRacePanel on the schedule page cannot for a manually-sent one", () => {
    expect(notificationHref("post_season_review_submitted", "athlete-1")).toBe("/coaching/athletes/athlete-1");
  });

  it("post_season_review_submitted falls back to /coaching without an id", () => {
    expect(notificationHref("post_season_review_submitted", null)).toBe("/coaching");
  });

  it("program_assigned always links to /coaching/your-plan -- the onboarding payoff built for this exact moment, not the coach-only schedule page relatedEntityId would otherwise point at", () => {
    expect(notificationHref("program_assigned", "athlete-1")).toBe("/coaching/your-plan");
    expect(notificationHref("program_assigned", null)).toBe("/coaching/your-plan");
  });

  it.each(["pain_reported", "race_approaching"] as const)(
    "%s always links to /coaching -- relatedEntityId shape is ambiguous (pain_reported) or never fired yet (race_approaching)",
    (type) => {
      expect(notificationHref(type, "some-id")).toBe("/coaching");
      expect(notificationHref(type, null)).toBe("/coaching");
    },
  );
});

describe("notificationHref -- bug_report_submitted", () => {
  it("links to the bug-report inbox", () => {
    expect(notificationHref("bug_report_submitted", "report-1")).toBe("/admin/bug-reports");
  });

  it("links to the same inbox even without a related entity id", () => {
    expect(notificationHref("bug_report_submitted", null)).toBe("/admin/bug-reports");
  });

  it("does not deep-link to a per-report page -- none exists yet", () => {
    const href = notificationHref("bug_report_submitted", "report-1");
    expect(href).not.toContain("report-1");
  });
});
