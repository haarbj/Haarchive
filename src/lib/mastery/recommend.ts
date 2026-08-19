// Simple, deterministic "Continue Learning" recommendation -- not ML, not
// a recommendation engine. Map the user's stated orientation to a learning
// path, then walk it breadth-first, then depth-first: first recommend the
// earliest topic in the path with no engagement at all (keep moving
// forward through the path), and only once every topic has at least been
// visited, recommend the earliest one still short of Proficient (go
// deeper). Without the breadth-first pass, someone who read topic 1 in
// full but never left an active signal (still capped at Familiar -- see
// algorithm.ts's guardrail) would be recommended that same topic forever,
// never nudged toward topic 2. A brand-new user (no progress at all)
// always gets the path's own entry topic, which is also the fixed
// orientation->topic mapping the onboarding completion message shows.
//
// Interest categories (onboarding Step 2, learning_preferences.interest_
// category_slugs) are a secondary tiebreaker, not a filter: orientation
// still picks the path and still decides breadth-vs-depth eligibility:
// interests only choose *which* eligible candidate to prefer when more
// than one exists in the same tier, and only ever narrow down within an
// already-valid candidate set -- never eliminate every candidate, so a
// path with no interest-matching topic simply falls back to path order,
// exactly like a user with no interests set at all. That's what keeps the
// recommendation from ever "getting stuck."

import type { MasteryLevel } from "./algorithm";
import { LEARNING_PATHS, type LearningPath } from "./paths";
import { TOPIC_SEEDS } from "./taxonomy";

export type Orientation = "new_runner" | "training_goal" | "science" | "coaching" | "exploring";

// The exact mapping given in the feature spec. Also what the onboarding
// completion screen's "Start with -> X" recommendation is built from.
export const ORIENTATION_ENTRY_TOPIC: Record<Orientation, string> = {
  new_runner: "how-to-start-running",
  training_goal: "the-aerobic-base",
  science: "exercise-physiology",
  coaching: "coaching-library",
  exploring: "how-to-start-running",
};

const ORIENTATION_PATH_ID: Record<Orientation, string> = {
  new_runner: "start-here",
  training_goal: "marathon-training",
  science: "understand-the-science",
  coaching: "coaching-philosophy",
  exploring: "start-here",
};

const PROGRESSED_LEVELS = new Set<MasteryLevel>(["proficient", "advanced", "mastered"]);

export type TopicProgress = { topicSlug: string; level: MasteryLevel };

export type Recommendation = {
  topicSlug: string;
  title: string;
  // Path context -- undefined when a recommendation didn't come from a
  // real path walk (the theoretical no-path fallback below), so the UI
  // has a clean signal to omit path context rather than ever showing
  // fabricated membership. pathIndex is 1-based (matches how "3 of 6"
  // reads to a person, not a 0-based array index).
  pathId?: string;
  pathTitle?: string;
  pathIndex?: number;
  pathLength?: number;
};

function topicTitle(slug: string): string {
  return TOPIC_SEEDS.find((t) => t.slug === slug)?.title ?? slug;
}

function categorySlugForTopic(slug: string): string | undefined {
  return TOPIC_SEEDS.find((t) => t.slug === slug)?.categorySlug;
}

// Among an already-eligible candidate list (breadth or depth tier, in path
// order), prefer the first one whose topic category matches a stated
// interest; otherwise keep the existing path-order pick. Never removes a
// candidate -- only reorders preference within the set the caller already
// decided was valid.
function pickPreferred(candidates: string[], interestCategorySlugs: string[]): string {
  if (interestCategorySlugs.length > 0) {
    const matching = candidates.find((slug) => {
      const category = categorySlugForTopic(slug);
      return !!category && interestCategorySlugs.includes(category);
    });
    if (matching) return matching;
  }
  return candidates[0];
}

function withPathMeta(path: LearningPath, topicSlug: string): Recommendation {
  const index = path.topicSlugs.indexOf(topicSlug);
  return {
    topicSlug,
    title: topicTitle(topicSlug),
    pathId: path.id,
    pathTitle: path.title,
    pathIndex: index + 1,
    pathLength: path.topicSlugs.length,
  };
}

export function recommendNextTopic(
  orientation: Orientation | null,
  progress: TopicProgress[],
  interestCategorySlugs: string[] = [],
): Recommendation {
  const effectiveOrientation = orientation ?? "exploring";
  const path = LEARNING_PATHS.find((p) => p.id === ORIENTATION_PATH_ID[effectiveOrientation]);
  const progressBySlug = new Map(progress.map((p) => [p.topicSlug, p.level]));

  if (path) {
    const unvisited = path.topicSlugs.filter((slug) => !progressBySlug.has(slug));
    if (unvisited.length > 0) {
      return withPathMeta(path, pickPreferred(unvisited, interestCategorySlugs));
    }

    // Phase 4 path-verification finding: a "tools" category topic has
    // exactly one possible signal (tool_used, a once-ever DB constraint)
    // and is structurally incapable of exceeding Exploring under the
    // current algorithm -- a flat, non-repeating score contribution well
    // under the Familiar threshold (see mastery-explanation.ts's
    // hasReadableContent comment for the full mechanism). Without this
    // exclusion, a path ending in a tools-category topic (e.g. Marathon
    // Training's own marathon-pacing-calculator) could recommend that
    // same already-used topic forever once every other path member
    // reaches Proficient+, since it can never join them there. Only
    // excludes it once already visited -- an unvisited tool topic still
    // gets recommended once, via the breadth-first `unvisited` tier above.
    const shallow = path.topicSlugs.filter((slug) => {
      const level = progressBySlug.get(slug) as MasteryLevel;
      if (PROGRESSED_LEVELS.has(level)) return false;
      if (categorySlugForTopic(slug) === "tools") return false;
      return true;
    });
    if (shallow.length > 0) {
      return withPathMeta(path, pickPreferred(shallow, interestCategorySlugs));
    }

    // Every topic in the matched path is already Proficient+ -- fall back
    // to the path's own entry point rather than recommending nothing.
    return withPathMeta(path, path.topicSlugs[0]);
  }

  const entry = ORIENTATION_ENTRY_TOPIC[effectiveOrientation];
  return { topicSlug: entry, title: topicTitle(entry) };
}
