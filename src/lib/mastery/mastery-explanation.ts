// Turns computeMastery's already-derived signals into one honest,
// topic-specific sentence -- "why am I at this level, and what's the next
// real step" -- instead of the generic, level-only description
// LearningProgress's "What do these levels mean?" disclosure gives every
// topic. Reuses the algorithm's own terminology and fields (MasteryResult)
// rather than deriving a second, parallel notion of progress.
//
// The one thing this file must never do: tell a user to do something
// they've already done. Advanced -> Mastered specifically has two
// independent gates (breadth: >=2 distinct correct; accuracy: >=80% of
// distinct attempted) -- get the wrong one and the copy is actively
// misleading, not just vague.

import { MASTERED_MIN_DISTINCT_CORRECT, type MasteryResult } from "@/lib/mastery/algorithm";

export type MasteryExplanationInput = MasteryResult & {
  // computeMastery has no way to know what's *available* for a topic, only
  // what already happened -- the caller (which already queries this for
  // the dashboard's "Verify your understanding" hint) supplies it, so
  // Advanced-level copy never suggests a knowledge check where none exists.
  hasKnowledgeChecksAvailable: boolean;
  // Phase 3.1 audit finding, corrected in Phase 4.1: means "this topic can
  // fire content_viewed/content_engaged," NOT "this topic has a sections.ts
  // `content` array" -- those aren't the same set. training-plans and
  // every calculator have neither (tool_used is genuinely their only
  // possible signal, contributed once as a flat, non-repeating +8 -- see
  // algorithm.ts's WEIGHT_TOOL -- which never crosses the 20-point
  // Familiar threshold, making Exploring their real, permanent ceiling).
  // But coaching-library, athlete-library, and training-philosophy *also*
  // have no sections.ts `content` array (all three are bespoke templates)
  // while genuinely firing content_viewed/content_engaged from real prose
  // elsewhere (coach/athlete detail pages, the flagship essay page) -- the
  // original Phase 3.1 logic conflated the two and told a user who'd just
  // read a real coach bio "there's no reading progress to build here,"
  // which was false. Caller-supplied for the same reason
  // hasKnowledgeChecksAvailable is: only the caller knows which of a
  // topic's routes actually wire this signal.
  hasReadableContent: boolean;
};

export type MasteryExplanation = {
  headline: string;
  // null when there's nothing concrete and true left to say (e.g.
  // Advanced with no knowledge checks available for this topic at all).
  detail: string | null;
};

export function explainMastery(input: MasteryExplanationInput): MasteryExplanation {
  const {
    level,
    conceptCount,
    activeSignalCount,
    knowledgeCheckAttempted,
    knowledgeCheckCorrect,
    hasKnowledgeChecksAvailable,
    hasReadableContent,
  } = input;

  switch (level) {
    case "exploring":
      // A tool-only topic (no readable content) that has reached Exploring
      // only got here via tool_used -- a flat, one-time signal that can
      // never cross the Familiar threshold under the current algorithm
      // (see the type's own comment above). "Familiar" isn't guarded the
      // same way below: it's structurally unreachable from a tool-only
      // topic, so there's no false claim to correct there.
      if (!hasReadableContent) {
        // `detail` (not `headline`) is the field LearningProgress actually
        // renders (see learning-progress.tsx: `{topic.explanation.detail
        // && <p>...</p>}` -- `headline` isn't read by any component in the
        // app today, for any level). A null `detail` here would render
        // nothing at all for this row, silently reproducing the exact
        // "went silent instead of being honest" bug the Advanced/no-KC
        // fix above (in `case "advanced"`) already exists to prevent.
        return {
          headline: "You've used this tool.",
          detail: "Tool use is what this topic tracks -- there's no reading progress to build here.",
        };
      }
      return {
        headline: "You've started reading this topic.",
        detail: "Keep reading, or leave a note, to build real familiarity.",
      };

    case "familiar":
      return {
        headline: "You've spent real time reading this topic.",
        detail: "Reading alone caps here -- a note, a return visit, or a related tool moves you toward Proficient.",
      };

    case "proficient": {
      // Advanced needs score >= 75 AND (2+ concepts OR 4+ active signals).
      // If breadth is already satisfied, the real remaining blocker is
      // just accumulated engagement (score), not a specific missing action
      // -- naming a specific one there would be a guess, not a fact.
      const needsBreadth = conceptCount < 2 && activeSignalCount < 4;
      return {
        headline: "You've engaged actively with this topic, not just read it.",
        detail: needsBreadth
          ? "Explore more of this topic's concepts, or keep engaging, to reach Advanced."
          : "Keep engaging with this topic to reach Advanced.",
      };
    }

    case "advanced": {
      // Mastered's only remaining gate is knowledge-check breadth/accuracy
      // -- if this topic has no knowledge checks at all, that gate is
      // genuinely unreachable right now. That's a real product-coverage
      // fact, not a personal shortfall, so this says so plainly instead of
      // silently omitting a detail line (which read as "nothing left to
      // say," implying the user was already done, when Mastered was in
      // fact just unreachable for reasons outside their control).
      if (!hasKnowledgeChecksAvailable) {
        return {
          headline: "You've built broad engagement with this topic.",
          detail: "No verification available yet -- you've reached the current ceiling for this topic.",
        };
      }
      if (knowledgeCheckAttempted === 0) {
        return {
          headline: "You've built broad engagement with this topic.",
          detail: "Verify your understanding with a knowledge check to reach Mastered.",
        };
      }
      if (knowledgeCheckCorrect < MASTERED_MIN_DISTINCT_CORRECT) {
        return {
          headline: "You've built broad engagement with this topic.",
          detail:
            knowledgeCheckCorrect === 0
              ? "Answer a knowledge check correctly to reach Mastered."
              : "Answer one more knowledge check correctly to reach Mastered.",
        };
      }
      // Breadth (>=2 distinct correct) is satisfied -- the only way to
      // still be Advanced, not Mastered, is the accuracy gate.
      return {
        headline: "You've built broad engagement with this topic.",
        detail: "Your knowledge-check accuracy needs to improve to reach Mastered.",
      };
    }

    case "mastered": {
      const parts: string[] = [];
      if (knowledgeCheckCorrect > 0) {
        parts.push(`${knowledgeCheckCorrect} knowledge check${knowledgeCheckCorrect === 1 ? "" : "s"} correct`);
      }
      if (conceptCount > 0) {
        parts.push(`${conceptCount} concept${conceptCount === 1 ? "" : "s"} explored`);
      }
      return {
        headline: "You've demonstrated broad engagement and verified your understanding.",
        detail: parts.length > 0 ? parts.join(" · ") : null,
      };
    }
  }
}
