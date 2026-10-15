#!/usr/bin/env -S npx tsx
// Knowledge Check Generation/Update -- Part 11 of the feature spec.
// Reads every section, determines which ones actually need attention
// (Part 7's fingerprint/change-detection flow, via buildSectionReport),
// generates only the missing/needed questions through the existing
// generateObject + Groq pipeline (src/lib/knowledge-checks/generate.ts),
// validates every candidate, writes what passed, and reports exactly what
// changed -- unchanged sections are never touched, and locked questions
// are never deleted or rewritten (see the migration's own header comment).
//
// Usage:
//   npm run generate:knowledge-checks                      # act on every section that needs it
//   npm run generate:knowledge-checks -- --dry-run          # compute + validate, print the plan, write nothing
//   npm run generate:knowledge-checks -- --section=<slug>   # limit to one section

import { sections } from "@/lib/sections";
import { generateQuestionsForSection } from "@/lib/knowledge-checks/generate";
import { buildSectionReport, type SectionReport } from "@/lib/knowledge-checks/report";
import {
  fetchQuestionsByTopic,
  fetchTopics,
  flagQuestions,
  insertGeneratedQuestions,
  updateTopicFingerprint,
  type TopicRow,
} from "@/lib/knowledge-checks/db";

type RunResult = {
  report: SectionReport;
  generated: number;
  flagged: number;
  fingerprintRefreshed: boolean;
  skippedReason: string | null;
};

async function processSection(params: {
  section: (typeof sections)[number];
  topic: TopicRow | undefined;
  report: SectionReport;
  existingQuestions: import("@/lib/knowledge-checks/types").ExistingQuestionSummary[];
  dryRun: boolean;
}): Promise<RunResult> {
  const { section, topic, report, existingQuestions, dryRun } = params;

  if (report.plan.action === "skip") {
    return { report, generated: 0, flagged: 0, fingerprintRefreshed: false, skippedReason: report.plan.reason };
  }

  if (!topic) {
    // A section with real content but no matching `topics` row at all --
    // can't attach a question to a topic_id that doesn't exist. Surfaced,
    // not silently dropped: see the final summary's own "no topic row"
    // callout.
    return { report, generated: 0, flagged: 0, fingerprintRefreshed: false, skippedReason: "No matching topics row (section_slug) -- add one before this section can get knowledge checks." };
  }

  let generated = 0;
  if (report.plan.questionsNeeded > 0) {
    const outcome = await generateQuestionsForSection({
      section,
      plan: report.plan,
      concepts: report.concepts,
      existingQuestions,
      sections,
    });
    if (!dryRun && outcome.accepted.length > 0) {
      generated = await insertGeneratedQuestions(topic.id, outcome.accepted, report.currentFingerprint);
    } else {
      generated = outcome.accepted.length;
    }
  }

  if (!dryRun && report.plan.flaggedQuestionIds.length > 0) {
    await flagQuestions(report.plan.flaggedQuestionIds, report.plan.reason);
  }

  const fingerprintRefreshed = report.change.kind !== "unchanged";
  if (!dryRun && fingerprintRefreshed) {
    await updateTopicFingerprint(topic.id, report.currentFingerprint, report.currentSnapshot);
  }

  return { report, generated, flagged: report.plan.flaggedQuestionIds.length, fingerprintRefreshed, skippedReason: null };
}

function printResult(result: RunResult): void {
  const { report } = result;
  if (result.skippedReason && report.plan.action === "skip") {
    return; // unchanged/already-adequate sections aren't printed at all -- see the summary's "Skipped" count instead
  }

  console.log(report.title);
  if (result.skippedReason) {
    console.log(`  ${result.skippedReason}`);
    console.log();
    return;
  }

  if (report.change.kind === "new") {
    console.log(`  New section for this pipeline`);
  } else if (report.change.kind === "material") {
    console.log(`  Content changed (${(report.change.changedWordRatio * 100).toFixed(1)}% of words)`);
  } else if (report.change.kind === "cosmetic") {
    console.log(`  Cosmetic change only (${(report.change.changedWordRatio * 100).toFixed(1)}% of words) -- fingerprint refreshed`);
  }

  const before = report.currentQuestionCount;
  const after = before + result.generated;
  console.log(`  ${before} → ${after} questions`);
  if (result.generated > 0) console.log(`  +${result.generated} generated`);
  if (before > 0) console.log(`  ${before} existing question${before === 1 ? "" : "s"} preserved`);
  if (result.flagged > 0) console.log(`  ${result.flagged} existing question(s) flagged for review`);
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const sectionArg = args.find((a) => a.startsWith("--section="))?.split("=")[1];

  const topics = await fetchTopics();
  const topicBySectionSlug = new Map(topics.filter((t) => t.section_slug).map((t) => [t.section_slug as string, t]));
  const questionsByTopic = await fetchQuestionsByTopic(topics.map((t) => t.id));

  const targetSections = sectionArg ? sections.filter((s) => s.slug === sectionArg) : sections;
  if (sectionArg && targetSections.length === 0) {
    console.error(`No section found with slug "${sectionArg}".`);
    process.exitCode = 1;
    return;
  }

  console.log("Knowledge Check Generation");
  console.log("─".repeat(60));
  console.log();
  if (dryRun) console.log("(dry run -- nothing will be written)\n");

  let changedCount = 0;
  let totalGenerated = 0;
  let totalFlagged = 0;
  let totalPreserved = 0;
  let noTopicCount = 0;

  // Built for every section up front (cheap, no API calls) so processing
  // order can be prioritized by actual need rather than sections.ts's own
  // array order. Without this, a daily token quota that runs out partway
  // through (see Part 12/13 of this feature's own spec on external rate
  // limits) always starves whichever sections happen to sit near the end
  // of the array -- a real pattern found in production: the same several
  // sections landed at 0 questions across three consecutive days' runs
  // purely because of their position in sections.ts, not anything about
  // their content. Sorting by current question count (ascending) means a
  // cut-off run still makes the most impactful progress possible: a
  // section with zero questions is worth reaching before topping up one
  // that already has some.
  type Candidate = { section: (typeof sections)[number]; topic: TopicRow | undefined; existingQuestions: import("@/lib/knowledge-checks/types").ExistingQuestionSummary[]; report: SectionReport };
  const candidates: Candidate[] = [];
  for (const section of targetSections) {
    if (!section.content || section.content.length === 0) continue;
    const topic = topicBySectionSlug.get(section.slug);
    const existingQuestions = topic ? (questionsByTopic.get(topic.id) ?? []) : [];
    const report = buildSectionReport({
      section,
      storedFingerprint: topic?.content_fingerprint ?? null,
      storedSnapshot: topic?.content_snapshot ?? null,
      existingQuestions,
    });
    if (report.plan.action === "skip") continue;
    candidates.push({ section, topic, existingQuestions, report });
  }
  candidates.sort((a, b) => a.report.currentQuestionCount - b.report.currentQuestionCount || a.report.coveragePercent - b.report.coveragePercent);

  for (const { section, topic, existingQuestions, report } of candidates) {
    const result = await processSection({ section, topic, report, existingQuestions, dryRun });
    printResult(result);

    if (result.skippedReason && !topic) {
      noTopicCount += 1;
      continue;
    }
    if (!result.skippedReason) {
      changedCount += 1;
      totalGenerated += result.generated;
      totalFlagged += result.flagged;
      totalPreserved += report.currentQuestionCount;
    }
  }

  console.log("─".repeat(60));
  console.log(`Changed sections: ${changedCount}`);
  console.log();
  console.log("Total:");
  console.log(`  ${totalGenerated} new question${totalGenerated === 1 ? "" : "s"}`);
  console.log(`  0 removed`);
  console.log(`  ${totalPreserved} preserved`);
  if (totalFlagged > 0) console.log(`  ${totalFlagged} flagged for review`);
  if (noTopicCount > 0) console.log(`  ${noTopicCount} section(s) skipped -- no matching topics row`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
