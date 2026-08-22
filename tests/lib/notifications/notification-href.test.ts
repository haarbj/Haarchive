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
