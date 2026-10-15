#!/usr/bin/env -S npx tsx
// Knowledge Check Audit -- Part 10 of the feature spec. Read-only: reports
// on every section's depth tier, recommended question count, current
// coverage, and status, without writing anything to sections.ts or the
// database. Run `npm run generate:knowledge-checks` to act on what this
// reports.
//
// Deterministic top to bottom -- no LLM call happens anywhere in this
// script (Part 13). It reads the live database only to know how many
// questions already exist and what fingerprint was last stored; every
// other number (word counts, tiers, concept coverage) is computed fresh
// from src/lib/sections.ts.
//
// Usage:
//   npm run audit:knowledge-checks              # print the full report
//   npm run audit:knowledge-checks -- --check    # exit 1 if anything needs an update (CI-friendly)
//   npm run audit:knowledge-checks -- --json      # machine-readable output instead of the table

import { sections } from "@/lib/sections";
import { buildSectionReport, statusFor, type SectionReport } from "@/lib/knowledge-checks/report";
import { fetchQuestionsByTopic, fetchTopics } from "@/lib/knowledge-checks/db";

async function buildReports(): Promise<{ reports: SectionReport[]; skipped: string[] }> {
  const topics = await fetchTopics();
  const topicBySectionSlug = new Map(topics.filter((t) => t.section_slug).map((t) => [t.section_slug as string, t]));
  const questionsByTopic = await fetchQuestionsByTopic(topics.map((t) => t.id));

  const reports: SectionReport[] = [];
  const skipped: string[] = [];

  for (const section of sections) {
    if (!section.content || section.content.length === 0) {
      skipped.push(section.slug);
      continue;
    }
    const topic = topicBySectionSlug.get(section.slug);
    const existingQuestions = topic ? (questionsByTopic.get(topic.id) ?? []) : [];

    reports.push(
      buildSectionReport({
        section,
        storedFingerprint: topic?.content_fingerprint ?? null,
        storedSnapshot: topic?.content_snapshot ?? null,
        existingQuestions,
      }),
    );
  }

  return { reports, skipped };
}

function formatRow(report: SectionReport): string {
  const status = statusFor(report);
  const words = report.metrics.wordCount.toLocaleString();
  return [
    report.title,
    `  Content:           ${words} words`,
    `  Concepts:          ${report.concepts.length}`,
    `  Current questions: ${report.currentQuestionCount}`,
    `  Recommended:       ${report.assessment.recommendedQuestions} (tier: ${report.assessment.tier})`,
    `  Coverage:          ${report.coveragePercent}%`,
    `  Status:            ${status}`,
  ].join("\n");
}

function printTable(reports: SectionReport[], skipped: string[]): void {
  console.log("Knowledge Check Audit");
  console.log("─".repeat(60));
  console.log();

  const sorted = [...reports].sort((a, b) => b.metrics.wordCount - a.metrics.wordCount);
  for (const report of sorted) {
    console.log(formatRow(report));
    console.log();
  }

  const byStatus = new Map<string, number>();
  for (const report of reports) {
    const status = statusFor(report);
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
  }

  console.log("─".repeat(60));
  console.log(`Sections analyzed: ${reports.length}`);
  for (const [status, count] of byStatus) console.log(`  ${status}: ${count}`);
  if (skipped.length > 0) {
    console.log(`Skipped (no content array -- rendered by a bespoke component): ${skipped.join(", ")}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const json = args.includes("--json");

  const { reports, skipped } = await buildReports();

  if (json) {
    console.log(
      JSON.stringify(
        reports.map((r) => ({
          slug: r.slug,
          title: r.title,
          wordCount: r.metrics.wordCount,
          concepts: r.concepts.length,
          currentQuestions: r.currentQuestionCount,
          recommended: r.assessment.recommendedQuestions,
          tier: r.assessment.tier,
          coveragePercent: r.coveragePercent,
          status: statusFor(r),
          changeKind: r.change.kind,
        })),
        null,
        2,
      ),
    );
  } else {
    printTable(reports, skipped);
  }

  const needsUpdate = reports.filter((r) => statusFor(r) === "NEEDS UPDATE" || statusFor(r) === "NEW");
  if (checkOnly && needsUpdate.length > 0) {
    console.error(`\n${needsUpdate.length} section(s) need a knowledge-check update -- run \`npm run generate:knowledge-checks\`.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
