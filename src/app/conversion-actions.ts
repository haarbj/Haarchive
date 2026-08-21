"use server";

// Phase 12A: account-conversion funnel instrumentation. Deliberately
// separate from learning-actions.ts -- conversion_events is product/growth
// analytics, not a learning signal, and must never feed computeMastery()
// or be readable by recommend.ts. Same identity convention as every other
// server action in this codebase (supabase.auth.getClaims(), never a
// client-supplied user id) -- but unlike those, a missing session here
// isn't an error case to reject, it's the expected, common case (an
// anonymous visitor's own funnel events).

import { createClient } from "@/lib/db/server";
import { getOrCreateAnonId } from "@/lib/anon-id";

export type ConversionEventType =
  | "cta_shown"
  | "cta_clicked"
  | "google_signup_clicked"
  | "account_created"
  | "first_learning_action";

// "project"/"calculator" have no reachable CTA yet in this phase (Projects
// don't exist; the calculator Save button never renders for an anonymous
// visitor -- see save-calculation-button.tsx's own early return) but are
// kept in this union now rather than added later, matching this table's
// own header comment about not needing a migration change to extend the
// allowed set (event_type/feature are plain text, not a DB enum).
export type ConversionFeature = "knowledge_check" | "bookmark" | "notes" | "project" | "learning_progress" | "calculator";

// The single write path for every conversion event in the app. Fire-and-
// forget by every call site (never awaited on the interaction's own
// success path -- see each call site's own comment for why) and fails
// open here too: a conversion-tracking failure must never surface to the
// user or block the actual feature, so every possible failure (a missing
// cookie store outside a request context, a transient DB error, an RLS
// rejection) is swallowed silently rather than thrown.
//
// Also the mechanism behind first_learning_action: called with that event
// type from three specific, already-authenticated learning actions
// (knowledge-check.tsx, bookmark-button.tsx, article-notes.tsx) rather
// than from logLearningEvent() itself. That function is this codebase's
// most heavily audited/regression-tested write path (see Phase 8's exact
// call-count tests in tests/app/learning-actions.test.ts) -- adding a
// query/insert there would both risk breaking that test suite's own
// step-by-step assertions and blur the line between "learning system" and
// "conversion analytics" the two systems are deliberately kept apart by.
// Idempotency for repeated first_learning_action attempts across those
// three call sites is the migration's own partial unique index on
// (user_id, event_type), not a read-before-write check here.
export async function recordConversionEvent(
  eventType: ConversionEventType,
  feature: ConversionFeature,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createClient();
    const anonId = await getOrCreateAnonId();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub ?? null;

    await supabase.from("conversion_events").insert({
      anon_id: anonId,
      user_id: userId,
      event_type: eventType,
      feature,
      metadata,
    });
  } catch {
    // See this function's own header comment: analytics must never break
    // the product it's measuring. Nothing here is worth surfacing to the
    // user or retrying.
  }
}
