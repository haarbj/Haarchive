// Content fingerprint / change detection -- Part 7 of the feature spec.
// Two layers on purpose:
//   1. An exact hash (`computeFingerprint`) -- cheap, deterministic, tells
//      you *whether* anything changed at all. Used to skip untouched
//      sections without even looking at their text.
//   2. A word-level diff against the *previous* snapshot (`diffMagnitude`)
//      -- tells you *how much* changed, so a one-word typo fix and a new
//      paragraph don't get treated the same way. This needs the actual
//      previous text, not just its hash (a hash can't be diffed against),
//      which is why topics.content_snapshot stores the real text alongside
//      topics.content_fingerprint (see the migration's own header comment).
//
// Deliberately no LLM anywhere in this file (Part 13).

import { createHash } from "node:crypto";

import { extractSectionUnits, tokenize } from "@/lib/knowledge-checks/extract";
import type { ChangeClassification, SectionForAnalysis } from "@/lib/knowledge-checks/types";

// Normalized to exactly the educational text a reader would actually
// learn from -- heading text plus every extracted unit's text, one per
// line, in document order. Whitespace-normalized so re-wrapping or
// re-indenting source (which doesn't change what's rendered) doesn't
// register as a content change; anything that changes the actual words
// does.
export function computeContentSnapshot(section: SectionForAnalysis): string {
  const lines: string[] = [];
  for (const block of section.content ?? []) {
    if (block.type === "heading") lines.push(`H: ${block.text.trim()}`);
  }
  for (const unit of extractSectionUnits(section)) {
    const normalized = unit.text.replace(/\s+/g, " ").trim();
    if (normalized) lines.push(normalized);
  }
  return lines.join("\n");
}

export function computeFingerprint(snapshot: string): string {
  return createHash("sha256").update(snapshot, "utf8").digest("hex");
}

// Fraction of the *larger* of the two word-sets that changed (added or
// removed), a simple bag-of-words symmetric difference -- not a real
// sequence diff (no need for one here: this only has to distinguish
// "basically the same text" from "genuinely different text," not produce a
// human-readable diff). A pure word-order shuffle would under-count as
// "changed" by this measure, which is an acceptable tradeoff: this
// codebase doesn't reorder prose without also rewording it in practice.
export function wordChangeRatio(oldSnapshot: string, newSnapshot: string): number {
  if (oldSnapshot === newSnapshot) return 0;
  const oldWords = tokenize(oldSnapshot);
  const newWords = tokenize(newSnapshot);
  if (oldWords.length === 0 && newWords.length === 0) return 0;

  const oldCounts = new Map<string, number>();
  for (const w of oldWords) oldCounts.set(w, (oldCounts.get(w) ?? 0) + 1);
  const newCounts = new Map<string, number>();
  for (const w of newWords) newCounts.set(w, (newCounts.get(w) ?? 0) + 1);

  let changed = 0;
  const allWords = new Set([...oldCounts.keys(), ...newCounts.keys()]);
  for (const w of allWords) {
    changed += Math.abs((oldCounts.get(w) ?? 0) - (newCounts.get(w) ?? 0));
  }

  const denominator = Math.max(oldWords.length, newWords.length, 1);
  return changed / denominator;
}

// Below this ratio, a change is "cosmetic" (a typo fix, a punctuation
// tweak, a single reworded sentence) and doesn't warrant regenerating or
// re-flagging anything -- just refresh the stored fingerprint/snapshot so
// the next run doesn't re-diff the same already-seen change. Chosen
// deliberately low: even a single added sentence in a short section should
// usually register as material, since short sections are exactly where one
// new sentence can introduce a genuinely new, untested concept.
const COSMETIC_CHANGE_THRESHOLD = 0.03;

export function classifyChange(
  storedFingerprint: string | null,
  storedSnapshot: string | null,
  currentSnapshot: string,
): ChangeClassification {
  const currentFingerprint = computeFingerprint(currentSnapshot);

  if (storedFingerprint === null || storedSnapshot === null) {
    return { kind: "new", reason: "No stored fingerprint for this topic yet." };
  }
  if (storedFingerprint === currentFingerprint) {
    return { kind: "unchanged" };
  }

  const ratio = wordChangeRatio(storedSnapshot, currentSnapshot);
  return ratio < COSMETIC_CHANGE_THRESHOLD ? { kind: "cosmetic", changedWordRatio: ratio } : { kind: "material", changedWordRatio: ratio };
}
