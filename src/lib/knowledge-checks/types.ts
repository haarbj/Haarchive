// Shared types for the knowledge-check depth/coverage/generation engine.
// This module has no side effects and no imports beyond `@/lib/sections`'s
// types -- every other module in this directory builds on these.

import type { Section } from "@/lib/sections";

export type DepthTier = "very_short" | "short" | "moderate" | "long" | "very_long";

// Orthogonal to `difficulty` (a question's overall difficulty tier) --
// cognitiveLevel is *how* a question tests understanding, not how hard it
// is. A "foundational" question can still be phrased as recall or
// understanding; an "advanced" one can still be a recall question about an
// advanced fact. Matches Part 4/6 of the feature spec.
export type CognitiveLevel = "recall" | "understand" | "apply" | "reason";
export type QuestionDifficulty = "foundational" | "intermediate" | "advanced";

export type SectionMetrics = {
  slug: string;
  wordCount: number;
  headingCount: number;
  h2Count: number;
  paragraphCount: number;
  listItemCount: number;
  calloutCounts: Record<string, number>;
  // Rough density signals -- deliberately cheap regex counts, not NLP. See
  // depth.ts for exactly what each pattern matches.
  numericSignalCount: number;
  citationSignalCount: number;
  conceptCount: number;
};

export type DepthAssessment = {
  tier: DepthTier;
  score: number;
  recommendedQuestions: number;
  // Target count per cognitive level for a *newly generated* batch of
  // `recommendedQuestions` size -- a guide for generation, not a hard
  // per-question requirement (existing/locked questions may not carry a
  // cognitiveLevel at all, see the migration's own header comment).
  cognitiveLevelTargets: Record<CognitiveLevel, number>;
};

export type ConceptSource = "curated" | "heading";

export type ConceptCandidate = {
  slug: string;
  title: string;
  source: ConceptSource;
  // Only set when source === "curated" and a real public.concepts row
  // exists for this slug+topic -- lets generation populate the legacy
  // concept_id FK when it genuinely can, without requiring one to exist.
  conceptId?: string;
};

export type ConceptCoverage = {
  concepts: ConceptCandidate[];
  coveredSlugs: Set<string>;
  uncovered: ConceptCandidate[];
  coveragePercent: number;
};

export type ContentFingerprint = {
  snapshot: string;
  hash: string;
};

export type ChangeClassification =
  | { kind: "new"; reason: string }
  | { kind: "unchanged" }
  | { kind: "cosmetic"; changedWordRatio: number }
  | { kind: "material"; changedWordRatio: number };

export type ExistingQuestionSummary = {
  id: string;
  concepts: string[];
  conceptId: string | null;
  locked: boolean;
  sourceFingerprint: string | null;
  question: string;
  cognitiveLevel: CognitiveLevel | null;
  difficulty: string | null;
};

export type GeneratedQuestionCandidate = {
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  difficulty: QuestionDifficulty;
  cognitiveLevel: CognitiveLevel;
  concepts: string[];
};

export type ValidationIssue = { code: string; message: string; severity: "reject" | "warn" };

export type ValidationResult = { valid: boolean; issues: ValidationIssue[] };

export type SectionForAnalysis = Pick<Section, "slug" | "title" | "mission" | "topics" | "content">;

export type GenerationAction = "skip" | "new" | "top_up" | "cosmetic_refresh";

export type GenerationPlan = {
  action: GenerationAction;
  reason: string;
  questionsNeeded: number;
  targetConcepts: ConceptCandidate[];
  cognitiveLevelTargets: Partial<Record<CognitiveLevel, number>>;
  flaggedQuestionIds: string[];
};
