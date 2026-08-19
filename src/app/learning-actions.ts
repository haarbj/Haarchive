"use server";

// Learning Progress (Phase 1) server actions. Identity is always derived
// server-side from the authenticated session (supabase.auth.getClaims(),
// matching src/lib/notes/actions.ts and settings/actions.ts exactly) --
// never trusted from a client-supplied user id. Anonymous visitors get no
// persistent record: every function below returns a no-op the moment
// getClaims() comes back empty, rather than falling back to writing
// anything.

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { computeMastery, type LearningEventType, type MasteryResult } from "@/lib/mastery/algorithm";
import { recommendNextTopic, type Orientation, type Recommendation } from "@/lib/mastery/recommend";
import { learningPreferencesSchema } from "@/lib/validation/learning";

export type SaveLearningPreferencesState = {
  error?: string;
  success?: boolean;
  recommendation?: Recommendation;
};

export async function saveLearningPreferences(
  _prevState: SaveLearningPreferencesState,
  formData: FormData,
): Promise<SaveLearningPreferencesState> {
  const rawOrientation = formData.get("orientation");
  const rawInterests = formData.getAll("interests");

  const parsed = learningPreferencesSchema.safeParse({
    orientation: rawOrientation ? rawOrientation : null,
    interestCategorySlugs: rawInterests,
  });
  if (!parsed.success) {
    return { error: "Something about that selection wasn't recognized. Try again." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired. Sign in again." };
  }

  // Editing preferences later (Settings) shouldn't reset when onboarding
  // was first completed -- only stamp onboarding_completed_at the first
  // time a real submission happens.
  const { data: existing } = await supabase
    .from("learning_preferences")
    .select("onboarding_completed_at")
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("learning_preferences").upsert({
    user_id: userId,
    orientation: parsed.data.orientation,
    interest_category_slugs: parsed.data.interestCategorySlugs,
    onboarding_completed_at: existing?.onboarding_completed_at ?? new Date().toISOString(),
    onboarding_skipped_at: null,
  });
  if (error) {
    return { error: error.message };
  }

  const progress = await fetchTopicProgress(supabase, userId);
  const recommendation = recommendNextTopic(
    parsed.data.orientation as Orientation | null,
    progress,
    parsed.data.interestCategorySlugs,
  );

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { success: true, recommendation };
}

export type SkipOnboardingState = { error?: string; success?: boolean };

export async function skipLearningOnboarding(): Promise<SkipOnboardingState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired. Sign in again." };
  }

  const { error } = await supabase.from("learning_preferences").upsert({
    user_id: userId,
    onboarding_skipped_at: new Date().toISOString(),
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export type DbClient = Awaited<ReturnType<typeof createClient>>;

async function fetchTopicProgress(supabase: DbClient, userId: string) {
  const { data } = await supabase
    .from("user_topic_mastery")
    .select("topic_id, level, topics(slug)")
    .eq("user_id", userId);

  return (data ?? [])
    .map((row) => {
      const topic = row.topics as unknown as { slug: string } | null;
      return topic ? { topicSlug: topic.slug, level: row.level as MasteryLevelString } : null;
    })
    .filter((row): row is { topicSlug: string; level: MasteryLevelString } => row !== null);
}

type MasteryLevelString = "exploring" | "familiar" | "proficient" | "advanced" | "mastered";

// Exported -- knowledge-check-actions.ts reuses this exact recomputation
// path rather than re-deriving mastery its own way, per this feature's own
// standing rule that user_topic_mastery is always a recomputable cache
// derived from the full learning_events history, never hand-written.
export async function recomputeTopicMastery(
  supabase: DbClient,
  userId: string,
  topicId: string,
): Promise<MasteryResult> {
  const { data: events, error: eventsError } = await supabase
    .from("learning_events")
    .select("event_type, concept_id, created_at, metadata")
    .eq("user_id", userId)
    .eq("topic_id", topicId);
  // A failed read must never be treated as "no events" -- computeMastery([])
  // produces a legitimate-looking Exploring/score-0 result, and the upsert
  // below would then overwrite a real (possibly much higher) cached level
  // with it. Throwing, rather than returning a fabricated result, matches
  // this file's existing convention (no try/catch anywhere) of letting a
  // genuine Supabase failure surface as an uncaught error, instead of
  // inventing a second, error-shaped return contract that both call sites
  // (which currently destructure `.level` unchecked) would need to start
  // handling.
  if (eventsError) {
    throw new Error(`Failed to load learning events for mastery recomputation: ${eventsError.message}`);
  }

  const result = computeMastery(
    (events ?? []).map((e) => ({
      eventType: e.event_type as string,
      conceptId: e.concept_id as string | null,
      createdAt: e.created_at as string,
      metadata: e.metadata as Record<string, unknown> | null,
    })),
  );

  const { error: upsertError } = await supabase.from("user_topic_mastery").upsert({
    user_id: userId,
    topic_id: topicId,
    score: result.score,
    level: result.level,
    last_event_at: new Date().toISOString(),
  });
  // Same reasoning as above -- a failed write must not look like a
  // successful recompute to the caller.
  if (upsertError) {
    throw new Error(`Failed to write recomputed mastery: ${upsertError.message}`);
  }

  return result;
}

// Logs one learning signal against a topic (resolved by its section slug,
// i.e. the same slug the page already routes on) and recomputes that
// topic's cached mastery row from the full event history. Safe to call
// with a duplicate signal -- a unique-violation from the DB's own
// idempotency constraints (see the learning_progress migration) is treated
// as a harmless no-op, not an error, since it just means this exact signal
// was already recorded.
//
// Deliberately bindable: a Server Component can only pass a "use server"
// reference (or a .bind() of one) as a prop to a Client Component, so
// article-layout.tsx wires ReadingProgressBar's onDeepScroll as
// `logLearningEvent.bind(null, section.slug, "content_engaged")`.
export async function logLearningEvent(
  contentSlug: string,
  eventType: LearningEventType,
  conceptSlug?: string | null,
): Promise<{ error?: string } | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return; // anonymous visitors: no persistent learning history

  const { data: topic } = await supabase
    .from("topics")
    .select("id")
    .eq("section_slug", contentSlug)
    .maybeSingle();
  if (!topic) return; // not a recognized topic -- silently skip, not an error

  let conceptId: string | null = null;
  if (conceptSlug) {
    const { data: concept } = await supabase
      .from("concepts")
      .select("id")
      .eq("slug", conceptSlug)
      .maybeSingle();
    conceptId = concept?.id ?? null;
  }

  const { error } = await supabase.from("learning_events").insert({
    user_id: userId,
    event_type: eventType,
    topic_id: topic.id,
    concept_id: conceptId,
    content_slug: contentSlug,
  });

  // Postgres unique_violation -- the DB-level idempotency constraint doing
  // its job (e.g. a second "content_engaged" the same day). Not a real error.
  if (error && error.code !== "23505") {
    return { error: error.message };
  }

  // "content_viewed" only ever fires once (see the migration's once-ever
  // partial unique index) -- a unique_violation here specifically means
  // this is a returning visit, not a first one. If the very first view was
  // on an earlier calendar day, that's a genuine spaced return (not just a
  // same-session reload), so it also earns the "topic_revisited" signal.
  if (eventType === "content_viewed" && error?.code === "23505") {
    const { data: firstView } = await supabase
      .from("learning_events")
      .select("created_at")
      .eq("user_id", userId)
      .eq("topic_id", topic.id)
      .eq("event_type", "content_viewed")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const firstViewDay = firstView ? new Date(firstView.created_at as string).toISOString().slice(0, 10) : null;
    const today = new Date().toISOString().slice(0, 10);
    if (firstViewDay && firstViewDay !== today) {
      await supabase.from("learning_events").insert({
        user_id: userId,
        event_type: "topic_revisited",
        topic_id: topic.id,
        content_slug: contentSlug,
      });
      // Idempotency for this insert is the once-per-day partial unique
      // index -- a second revisit later the same day silently no-ops, same
      // as any other duplicate signal.
    }
  }

  await recomputeTopicMastery(supabase, userId, topic.id);
  revalidatePath("/dashboard");
}
