// Pure aggregation over already-fetched conversion_events rows -- no
// Supabase/service-role import here on purpose, so the counting logic
// itself is testable without mocking a DB client (the same "keep the math
// pure and separately testable" split this codebase already uses for
// calculator physics -- see CLAUDE.md's tool/calculator architecture
// section). The one caller (the admin readout page) does the actual
// service-role fetch and passes the rows in.
//
// Deliberately conservative about what it claims: cta_shown/cta_clicked/
// first_learning_action are recorded with a real `feature` at every
// instrumented call site (see conversion-actions.ts's call sites), so a
// per-feature breakdown of those three is defensible. google_signup_clicked
// and account_created are NOT feature-attributed today -- every
// google_signup_clicked fires with a fixed placeholder feature regardless
// of which CTA (if any) led the visitor there (see oauth-buttons.tsx's own
// comment), so this module deliberately never breaks those two down by
// feature, only reports them as an overall total. Pretending otherwise
// would fabricate an attribution the schema can't actually support.

export type ConversionEventRow = {
  event_type: string;
  feature: string;
  user_id: string | null;
  anon_id: string;
  created_at: string;
};

export const KNOWN_EVENT_TYPES = [
  "cta_shown",
  "cta_clicked",
  "google_signup_clicked",
  "account_created",
  "first_learning_action",
] as const;
export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];

// The six values conversion-actions.ts's ConversionFeature type allows.
// "project" is included even though nothing emits it yet (Projects don't
// exist) so the readout can show it explicitly at zero rather than
// silently omitting a row a reader might otherwise assume was forgotten.
export const KNOWN_FEATURES = ["knowledge_check", "bookmark", "notes", "learning_progress", "project", "calculator"] as const;
export type KnownFeature = (typeof KNOWN_FEATURES)[number];

// Bucket for anything outside the known sets above -- a schema drift
// (event_type/feature are plain text, no DB check constraint, see the
// migration's own comment) should be visible in the readout, never
// silently dropped or silently crash the page.
const OTHER = "other";

export type FeatureBreakdown = {
  ctaShown: number;
  ctaClicked: number;
  firstLearningAction: number;
};

export type ConversionSummary = {
  totalEvents: number;
  dateRange: { earliest: string | null; latest: string | null };
  // Keyed by event_type; always includes every KNOWN_EVENT_TYPES key (even
  // at 0) plus "other" for anything unrecognized.
  overall: Record<string, number>;
  // Keyed by feature; always includes every KNOWN_FEATURES key (even at
  // all-zero) plus "other" for anything unrecognized. Deliberately only
  // three of the five event types (see this file's own header comment).
  byFeature: Record<string, FeatureBreakdown>;
};

function emptyBreakdown(): FeatureBreakdown {
  return { ctaShown: 0, ctaClicked: 0, firstLearningAction: 0 };
}

export function summarizeConversionEvents(rows: ConversionEventRow[]): ConversionSummary {
  const overall: Record<string, number> = Object.fromEntries(KNOWN_EVENT_TYPES.map((t) => [t, 0]));
  overall[OTHER] = 0;

  const byFeature: Record<string, FeatureBreakdown> = Object.fromEntries(
    KNOWN_FEATURES.map((f) => [f, emptyBreakdown()]),
  );
  byFeature[OTHER] = emptyBreakdown();

  let earliest: string | null = null;
  let latest: string | null = null;

  for (const row of rows) {
    const eventKey = (KNOWN_EVENT_TYPES as readonly string[]).includes(row.event_type) ? row.event_type : OTHER;
    overall[eventKey] = (overall[eventKey] ?? 0) + 1;

    const featureKey = (KNOWN_FEATURES as readonly string[]).includes(row.feature) ? row.feature : OTHER;
    const bucket = byFeature[featureKey];
    if (row.event_type === "cta_shown") bucket.ctaShown += 1;
    else if (row.event_type === "cta_clicked") bucket.ctaClicked += 1;
    else if (row.event_type === "first_learning_action") bucket.firstLearningAction += 1;
    // google_signup_clicked / account_created / an unrecognized event_type
    // intentionally do not affect any per-feature bucket -- see header.

    if (earliest === null || row.created_at < earliest) earliest = row.created_at;
    if (latest === null || row.created_at > latest) latest = row.created_at;
  }

  return {
    totalEvents: rows.length,
    dateRange: { earliest, latest },
    overall,
    byFeature,
  };
}
