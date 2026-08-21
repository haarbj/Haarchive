import { describe, expect, it } from "vitest";

import { summarizeConversionEvents, type ConversionEventRow } from "@/lib/conversion/aggregate";

function row(overrides: Partial<ConversionEventRow>): ConversionEventRow {
  return {
    event_type: "cta_shown",
    feature: "bookmark",
    user_id: null,
    anon_id: "anon-1",
    created_at: "2026-08-19T00:00:00Z",
    ...overrides,
  };
}

describe("summarizeConversionEvents", () => {
  it("returns all-zero counts and a null date range for no events", () => {
    const summary = summarizeConversionEvents([]);
    expect(summary.totalEvents).toBe(0);
    expect(summary.dateRange).toEqual({ earliest: null, latest: null });
    expect(summary.overall.cta_shown).toBe(0);
    expect(summary.byFeature.bookmark).toEqual({ ctaShown: 0, ctaClicked: 0, firstLearningAction: 0 });
  });

  it("counts overall totals per event type", () => {
    const summary = summarizeConversionEvents([
      row({ event_type: "cta_shown" }),
      row({ event_type: "cta_shown" }),
      row({ event_type: "cta_clicked" }),
      row({ event_type: "google_signup_clicked" }),
      row({ event_type: "account_created" }),
      row({ event_type: "first_learning_action" }),
    ]);
    expect(summary.overall).toMatchObject({
      cta_shown: 2,
      cta_clicked: 1,
      google_signup_clicked: 1,
      account_created: 1,
      first_learning_action: 1,
    });
    expect(summary.totalEvents).toBe(6);
  });

  it("breaks cta_shown/cta_clicked/first_learning_action down per feature", () => {
    const summary = summarizeConversionEvents([
      row({ event_type: "cta_shown", feature: "knowledge_check" }),
      row({ event_type: "cta_shown", feature: "knowledge_check" }),
      row({ event_type: "cta_clicked", feature: "knowledge_check" }),
      row({ event_type: "cta_shown", feature: "notes" }),
      row({ event_type: "first_learning_action", feature: "bookmark", user_id: "user-1" }),
    ]);
    expect(summary.byFeature.knowledge_check).toEqual({ ctaShown: 2, ctaClicked: 1, firstLearningAction: 0 });
    expect(summary.byFeature.notes).toEqual({ ctaShown: 1, ctaClicked: 0, firstLearningAction: 0 });
    expect(summary.byFeature.bookmark).toEqual({ ctaShown: 0, ctaClicked: 0, firstLearningAction: 1 });
  });

  it("REGRESSION: google_signup_clicked and account_created never affect any per-feature bucket, even though every write site tags them with a feature", () => {
    // These two event types are not reliably attributable to a specific
    // originating CTA (see conversion-actions.ts / oauth-buttons.tsx) --
    // if a future change accidentally started counting them per-feature,
    // the readout would silently start implying an attribution the data
    // doesn't support.
    const summary = summarizeConversionEvents([
      row({ event_type: "google_signup_clicked", feature: "learning_progress" }),
      row({ event_type: "account_created", feature: "learning_progress" }),
    ]);
    expect(summary.byFeature.learning_progress).toEqual({ ctaShown: 0, ctaClicked: 0, firstLearningAction: 0 });
    expect(summary.overall.google_signup_clicked).toBe(1);
    expect(summary.overall.account_created).toBe(1);
  });

  it("shows every known feature, including one with zero real data (e.g. project, which has no live CTA yet)", () => {
    const summary = summarizeConversionEvents([row({ feature: "bookmark" })]);
    expect(summary.byFeature.project).toEqual({ ctaShown: 0, ctaClicked: 0, firstLearningAction: 0 });
    expect(summary.byFeature.calculator).toEqual({ ctaShown: 0, ctaClicked: 0, firstLearningAction: 0 });
  });

  it("buckets an unrecognized event_type under overall.other rather than dropping or crashing", () => {
    const summary = summarizeConversionEvents([row({ event_type: "some_future_event_type" })]);
    expect(summary.overall.other).toBe(1);
    expect(summary.totalEvents).toBe(1);
  });

  it("buckets an unrecognized feature under byFeature.other rather than dropping or crashing", () => {
    const summary = summarizeConversionEvents([row({ event_type: "cta_shown", feature: "some_future_feature" })]);
    expect(summary.byFeature.other).toEqual({ ctaShown: 1, ctaClicked: 0, firstLearningAction: 0 });
  });

  it("counts events with a null user_id (anonymous) the same as events with a real user_id", () => {
    const summary = summarizeConversionEvents([
      row({ event_type: "cta_shown", user_id: null }),
      row({ event_type: "cta_shown", user_id: "user-1" }),
    ]);
    expect(summary.overall.cta_shown).toBe(2);
    expect(summary.byFeature.bookmark.ctaShown).toBe(2);
  });

  it("computes the real earliest/latest created_at regardless of input order", () => {
    const summary = summarizeConversionEvents([
      row({ created_at: "2026-08-15T12:00:00Z" }),
      row({ created_at: "2026-08-19T09:00:00Z" }),
      row({ created_at: "2026-08-10T00:00:00Z" }),
    ]);
    expect(summary.dateRange).toEqual({ earliest: "2026-08-10T00:00:00Z", latest: "2026-08-19T09:00:00Z" });
  });
});
