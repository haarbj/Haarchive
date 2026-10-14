-- Knowledge Check Scaling & Automation -- adds the metadata columns the new
-- depth-aware, automated question-generation system (src/lib/knowledge-
-- checks/, scripts/audit-knowledge-checks.ts, scripts/generate-knowledge-
-- checks.ts) needs on top of the existing Phase 2 schema
-- (20260813020000_knowledge_checks.sql). Deliberately additive-only:
-- no existing column is renamed or dropped, and every new column is
-- nullable (knowledge_checks) or has a safe default, so the 29 existing
-- hand-authored rows and every existing read path keep working unchanged.
--
-- Two independent additions:
--
-- 1. Per-question generation/editorial metadata (knowledge_checks). The
--    existing `difficulty` column stays as-is (free text, 'standard' on
--    every existing row) -- new rows going forward use real values
--    ('foundational'/'intermediate'/'advanced') instead of introducing a
--    second, competing difficulty concept. `cognitive_level` is a new,
--    orthogonal axis (a "foundational" question can still be recall or
--    understand) that the existing 29 rows simply don't have yet (null is
--    the honest answer for "never classified this way"), not something
--    backfilled by guessing.
--
--    `locked` defaults to false for anything inserted from here on
--    (automation's own output, until a human reviews it), but every
--    existing row is explicitly set to true below -- these 29 questions
--    were each hand-written against the site's real prose (see that
--    migration's own header comments), and the whole point of `locked` is
--    that automation must never silently replace deliberate editorial
--    work just because the section it tests got edited later.
--
--    `concepts text[]` is deliberately NOT a second foreign key: the
--    existing `concept_id` FK into `public.concepts` stays as the
--    authoritative single link when a real curated Concept row exists for
--    what the question tests, but concepts.ts's own header comment already
--    documents that concept coverage is intentionally uneven (many topics,
--    including ones with a lot of educational content, have zero curated
--    concepts) -- requiring a real `concepts` row for every concept a
--    generated question samples would mean growing that table via a new
--    migration on every generation run, defeating the point of automating
--    this. `concepts text[]` holds plain concept-slug strings (curated
--    where one exists, a deterministic heading-derived slug otherwise) so
--    coverage tracking works everywhere, while `concept_id` still gets
--    populated whenever a generated question's primary concept genuinely
--    matches a real curated Concept.
--
--    `source_fingerprint` records which version of the section's content
--    (see #2 below) a question was generated or last validated against --
--    the traceability Part 8 of this feature's own spec asks for. A row
--    whose `source_fingerprint` no longer matches its topic's current
--    `content_fingerprint` is a candidate for revalidation, not an
--    automatic invalidation.
--
--    `flagged_reason`/`flagged_at`: set by the audit/generation pipeline
--    when a section changed enough that an existing question (locked or
--    not) might no longer be well-supported by the current text -- surfaced
--    to a human via the audit report, never auto-deleted.
--
-- 2. Per-topic content fingerprint (topics). `content_snapshot` stores the
--    exact normalized text blob (see src/lib/knowledge-checks/fingerprint.ts)
--    a topic's `content_fingerprint` hash was computed from -- storing the
--    text itself, not just its hash, is what lets a later run compute a
--    real word-level diff against the new content (distinguishing a typo
--    fix from a genuinely new subsection) instead of only being able to
--    say "something changed." Both are null until the first audit/generate
--    run touches a given topic.

alter table public.knowledge_checks
  add column locked boolean not null default false,
  add column cognitive_level text,
  add column concepts text[],
  add column generated_by text,
  add column generated_at timestamptz,
  add column source_fingerprint text,
  add column flagged_reason text,
  add column flagged_at timestamptz;

-- Every question that already existed before this feature is deliberate,
-- reviewed editorial content -- protect it from automated regeneration by
-- default (see header comment above).
update public.knowledge_checks set locked = true, generated_by = 'manual';

alter table public.topics
  add column content_fingerprint text,
  add column content_snapshot text,
  add column content_fingerprint_updated_at timestamptz;

comment on column public.knowledge_checks.locked is
  'True for manually-authored/reviewed questions the generation pipeline must never delete or silently replace. Automation may still flag a locked question (flagged_reason) if the section changed enough to warrant human review.';
comment on column public.knowledge_checks.concepts is
  'Concept slugs this question samples (see src/lib/knowledge-checks/concepts.ts) -- plain text, not a second FK, since concept coverage is intentionally broader than the curated public.concepts table today.';
comment on column public.topics.content_fingerprint is
  'sha256 of the topic''s normalized educational text (src/lib/knowledge-checks/fingerprint.ts) as of the last audit/generate run -- compared against a fresh computation to detect any change at all.';
comment on column public.topics.content_snapshot is
  'The exact normalized text content_fingerprint was hashed from, stored (not just hashed) so a later run can diff old vs. new content directly rather than only knowing that something changed.';
