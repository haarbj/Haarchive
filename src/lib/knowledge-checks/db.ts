// Data access for the audit/generate scripts -- the only module in this
// directory that touches the database. Can't reuse createServiceRoleClient
// (src/lib/db/service-role.ts) as-is: that file starts with `import
// "server-only"`, whose guard works by having bundlers (webpack/turbopack)
// swap in a throwing stub for client-bundled code -- a real, useful
// protection inside Next.js, but under plain Node (these scripts run via
// `tsx`, outside any Next.js build) that package's own unconditional
// `require` entry point throws unconditionally instead of silently no-
// op'ing. This constructs the identical client (same two env vars, same
// options) directly instead, so the credential logic stays the same even
// though the import can't be shared verbatim. knowledge_checks has no
// authenticated/public read policy at all (see its own migration), so
// every one of these functions has to authenticate as service-role
// regardless of who's running the script.

import { createClient } from "@supabase/supabase-js";
import type { ExistingQuestionSummary, GeneratedQuestionCandidate } from "@/lib/knowledge-checks/types";

function createServiceRoleClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type TopicRow = {
  id: string;
  slug: string;
  section_slug: string | null;
  content_fingerprint: string | null;
  content_snapshot: string | null;
};

export async function fetchTopics(): Promise<TopicRow[]> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("topics")
    .select("id, slug, section_slug, content_fingerprint, content_snapshot")
    .returns<TopicRow[]>();
  if (error) throw new Error(`Failed to fetch topics: ${error.message}`);
  return data ?? [];
}

type KnowledgeCheckFullRow = {
  id: string;
  topic_id: string;
  concept_id: string | null;
  question: string;
  concepts: string[] | null;
  locked: boolean;
  source_fingerprint: string | null;
  cognitive_level: string | null;
  difficulty: string | null;
};

export async function fetchQuestionsByTopic(topicIds: string[]): Promise<Map<string, ExistingQuestionSummary[]>> {
  if (topicIds.length === 0) return new Map();
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("knowledge_checks")
    .select("id, topic_id, concept_id, question, concepts, locked, source_fingerprint, cognitive_level, difficulty")
    .in("topic_id", topicIds)
    .returns<KnowledgeCheckFullRow[]>();
  if (error) throw new Error(`Failed to fetch knowledge_checks: ${error.message}`);

  const byTopic = new Map<string, ExistingQuestionSummary[]>();
  for (const row of data ?? []) {
    const summary: ExistingQuestionSummary = {
      id: row.id,
      concepts: row.concepts ?? [],
      conceptId: row.concept_id,
      locked: row.locked,
      sourceFingerprint: row.source_fingerprint,
      question: row.question,
      cognitiveLevel: (row.cognitive_level as ExistingQuestionSummary["cognitiveLevel"]) ?? null,
      difficulty: row.difficulty,
    };
    const list = byTopic.get(row.topic_id) ?? [];
    list.push(summary);
    byTopic.set(row.topic_id, list);
  }
  return byTopic;
}

export async function updateTopicFingerprint(topicId: string, fingerprint: string, snapshot: string): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service
    .from("topics")
    .update({ content_fingerprint: fingerprint, content_snapshot: snapshot, content_fingerprint_updated_at: new Date().toISOString() })
    .eq("id", topicId);
  if (error) throw new Error(`Failed to update topic fingerprint: ${error.message}`);
}

export async function flagQuestions(questionIds: string[], reason: string): Promise<void> {
  if (questionIds.length === 0) return;
  const service = createServiceRoleClient();
  const { error } = await service
    .from("knowledge_checks")
    .update({ flagged_reason: reason, flagged_at: new Date().toISOString() })
    .in("id", questionIds);
  if (error) throw new Error(`Failed to flag questions: ${error.message}`);
}

// A concept only gets concept_id populated (the legacy FK) when a real
// public.concepts row exists for this exact slug+topic -- otherwise it's
// left null and the plain-text `concepts` column is the only record of
// what this question tests. See the migration's own comment on why this
// isn't a hard requirement.
async function resolveConceptId(topicId: string, conceptSlug: string | undefined): Promise<string | null> {
  if (!conceptSlug) return null;
  const service = createServiceRoleClient();
  const { data } = await service.from("concepts").select("id").eq("topic_id", topicId).eq("slug", conceptSlug).maybeSingle();
  return data?.id ?? null;
}

export async function insertGeneratedQuestions(
  topicId: string,
  candidates: GeneratedQuestionCandidate[],
  sourceFingerprint: string,
): Promise<number> {
  if (candidates.length === 0) return 0;
  const service = createServiceRoleClient();

  const rows = await Promise.all(
    candidates.map(async (c) => ({
      topic_id: topicId,
      concept_id: await resolveConceptId(topicId, c.concepts[0]),
      question: c.question,
      options: c.options,
      correct_option_id: c.correctOptionId,
      explanation: c.explanation,
      difficulty: c.difficulty,
      cognitive_level: c.cognitiveLevel,
      concepts: c.concepts,
      locked: false,
      generated_by: "llm",
      generated_at: new Date().toISOString(),
      source_fingerprint: sourceFingerprint,
    })),
  );

  const { error } = await service.from("knowledge_checks").insert(rows);
  if (error) throw new Error(`Failed to insert generated questions: ${error.message}`);
  return rows.length;
}
