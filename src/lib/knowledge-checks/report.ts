// Ties depth + concepts + coverage + fingerprint + planning together into
// one per-section report -- the shared core both scripts/audit-knowledge-
// checks.ts and scripts/generate-knowledge-checks.ts build on. Pure: given
// a section and whatever's already been fetched from the database for it,
// no I/O happens here.

import { assessSectionDepth } from "@/lib/knowledge-checks/depth";
import { deriveConcepts } from "@/lib/knowledge-checks/concepts";
import { computeCoverage } from "@/lib/knowledge-checks/coverage";
import { computeContentSnapshot, computeFingerprint, classifyChange } from "@/lib/knowledge-checks/fingerprint";
import { planGeneration } from "@/lib/knowledge-checks/generate";
import type { ChangeClassification, ConceptCandidate, DepthAssessment, ExistingQuestionSummary, GenerationPlan, SectionForAnalysis, SectionMetrics } from "@/lib/knowledge-checks/types";

export type SectionReport = {
  slug: string;
  title: string;
  metrics: SectionMetrics;
  assessment: DepthAssessment;
  concepts: ConceptCandidate[];
  coveragePercent: number;
  uncoveredConcepts: string[];
  currentQuestionCount: number;
  change: ChangeClassification;
  plan: GenerationPlan;
  currentSnapshot: string;
  currentFingerprint: string;
};

export function buildSectionReport(params: {
  section: SectionForAnalysis;
  storedFingerprint: string | null;
  storedSnapshot: string | null;
  existingQuestions: ExistingQuestionSummary[];
}): SectionReport {
  const { section, storedFingerprint, storedSnapshot, existingQuestions } = params;

  const concepts = deriveConcepts(section);
  const { metrics, assessment } = assessSectionDepth(section, concepts);
  const coverage = computeCoverage(concepts, existingQuestions);
  const currentSnapshot = computeContentSnapshot(section);
  const currentFingerprint = computeFingerprint(currentSnapshot);
  const change = classifyChange(storedFingerprint, storedSnapshot, currentSnapshot);
  const plan = planGeneration({ assessment, coverage, change, existingQuestions });

  return {
    slug: section.slug,
    title: section.title,
    metrics,
    assessment,
    concepts,
    coveragePercent: coverage.coveragePercent,
    uncoveredConcepts: coverage.uncovered.map((c) => c.slug),
    currentQuestionCount: existingQuestions.length,
    change,
    plan,
    currentSnapshot,
    currentFingerprint,
  };
}

export type ReportStatus = "OK" | "NEEDS UPDATE" | "NEW" | "OVER-QUESTIONED";

export function statusFor(report: SectionReport): ReportStatus {
  if (report.plan.action === "skip") {
    return report.currentQuestionCount > report.assessment.recommendedQuestions + 2 ? "OVER-QUESTIONED" : "OK";
  }
  if (report.change.kind === "new" && report.currentQuestionCount === 0) return "NEW";
  return "NEEDS UPDATE";
}
