import { describe, expect, it } from "vitest";

import { ORIENTATION_ENTRY_TOPIC, recommendNextTopic, type TopicProgress } from "@/lib/mastery/recommend";
import { LEARNING_PATHS } from "@/lib/mastery/paths";
import { TOPIC_SEEDS } from "@/lib/mastery/taxonomy";

const topicSlugs = new Set(TOPIC_SEEDS.map((t) => t.slug));

describe("recommendNextTopic", () => {
  it("matches the exact orientation -> entry topic mapping from the feature spec", () => {
    expect(ORIENTATION_ENTRY_TOPIC.new_runner).toBe("how-to-start-running");
    expect(ORIENTATION_ENTRY_TOPIC.training_goal).toBe("the-aerobic-base");
    expect(ORIENTATION_ENTRY_TOPIC.science).toBe("exercise-physiology");
    expect(ORIENTATION_ENTRY_TOPIC.coaching).toBe("coaching-library");
    expect(ORIENTATION_ENTRY_TOPIC.exploring).toBe("how-to-start-running");
  });

  it("recommends the entry topic for a brand-new user with no progress, for every orientation", () => {
    for (const orientation of ["new_runner", "training_goal", "science", "coaching", "exploring"] as const) {
      const result = recommendNextTopic(orientation, []);
      expect(result.topicSlug).toBe(ORIENTATION_ENTRY_TOPIC[orientation]);
      expect(result.title.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the 'exploring' entry topic when orientation is null (e.g. skipped onboarding)", () => {
    const result = recommendNextTopic(null, []);
    expect(result.topicSlug).toBe(ORIENTATION_ENTRY_TOPIC.exploring);
  });

  it("resolves every real topic slug it can recommend to a title that exists in TOPIC_SEEDS", () => {
    for (const orientation of ["new_runner", "training_goal", "science", "coaching", "exploring"] as const) {
      const result = recommendNextTopic(orientation, []);
      expect(topicSlugs.has(result.topicSlug)).toBe(true);
    }
  });

  it("moves on to the next topic in the matched path once the entry topic is already Proficient", () => {
    const progress: TopicProgress[] = [{ topicSlug: "how-to-start-running", level: "proficient" }];
    const result = recommendNextTopic("new_runner", progress);
    expect(result.topicSlug).not.toBe("how-to-start-running");
    expect(topicSlugs.has(result.topicSlug)).toBe(true);
  });

  it("skips every topic already at Proficient or above, not just the first one", () => {
    const progress: TopicProgress[] = [
      { topicSlug: "how-to-start-running", level: "proficient" },
      { topicSlug: "training-philosophy", level: "advanced" },
    ];
    const result = recommendNextTopic("new_runner", progress);
    expect(["how-to-start-running", "training-philosophy"]).not.toContain(result.topicSlug);
  });

  it("prioritizes breadth: moves on to the next unvisited topic even if the first is only Familiar", () => {
    // Reading topic 1 in full without ever leaving an active signal caps
    // it at Familiar (see algorithm.ts's guardrail) -- the recommendation
    // should still nudge forward to a genuinely unvisited topic rather
    // than repeating the same one forever.
    const progress: TopicProgress[] = [{ topicSlug: "how-to-start-running", level: "familiar" }];
    const result = recommendNextTopic("new_runner", progress);
    expect(result.topicSlug).toBe("training-philosophy");
  });

  it("falls back to depth (the shallowest topic short of Proficient) once every path topic has some engagement", () => {
    const progress: TopicProgress[] = [
      { topicSlug: "how-to-start-running", level: "proficient" },
      { topicSlug: "training-philosophy", level: "exploring" },
      { topicSlug: "the-philosophy-of-running", level: "familiar" },
      { topicSlug: "the-aerobic-base", level: "exploring" },
      { topicSlug: "exercise-physiology", level: "exploring" },
    ];
    const result = recommendNextTopic("new_runner", progress);
    // Every "start-here" topic has at least some engagement, so this falls
    // through to the depth pass -- the first one below Proficient, in path
    // order, which is "training-philosophy".
    expect(result.topicSlug).toBe("training-philosophy");
  });

  it("falls back to the path's own entry point once every topic in it is already Proficient+", () => {
    const progress: TopicProgress[] = [
      { topicSlug: "how-to-start-running", level: "advanced" },
      { topicSlug: "training-philosophy", level: "advanced" },
      { topicSlug: "the-philosophy-of-running", level: "advanced" },
      { topicSlug: "the-aerobic-base", level: "advanced" },
      { topicSlug: "exercise-physiology", level: "advanced" },
    ];
    const result = recommendNextTopic("new_runner", progress);
    expect(result.topicSlug).toBe("how-to-start-running");
  });

  it("is deterministic for the same inputs", () => {
    const progress: TopicProgress[] = [{ topicSlug: "exercise-physiology", level: "familiar" }];
    const first = recommendNextTopic("science", progress);
    const second = recommendNextTopic("science", [...progress]);
    expect(second).toEqual(first);
  });

  describe("path metadata", () => {
    it("attaches real path id/title/index/length matching paths.ts for a normal recommendation", () => {
      const result = recommendNextTopic("science", []);
      const path = LEARNING_PATHS.find((p) => p.id === "understand-the-science")!;
      expect(result.pathId).toBe("understand-the-science");
      expect(result.pathTitle).toBe(path.title);
      expect(result.pathLength).toBe(path.topicSlugs.length);
      // exercise-physiology is topicSlugs[0] -- 1-based index.
      expect(result.pathIndex).toBe(1);
      expect(path.topicSlugs[result.pathIndex! - 1]).toBe(result.topicSlug);
    });

    it("reports the correct 1-based index for a topic later in the path", () => {
      const progress: TopicProgress[] = [{ topicSlug: "how-to-start-running", level: "proficient" }];
      const result = recommendNextTopic("new_runner", progress);
      expect(result.topicSlug).toBe("training-philosophy");
      expect(result.pathIndex).toBe(2);
      expect(result.pathId).toBe("start-here");
    });
  });

  describe("interest-category tiebreaker", () => {
    it("with no interests, behaves identically to omitting the argument entirely", () => {
      const withEmptyArray = recommendNextTopic("training_goal", [], []);
      const omitted = recommendNextTopic("training_goal", []);
      expect(withEmptyArray).toEqual(omitted);
    });

    it("prefers a candidate whose category matches a stated interest over plain path order", () => {
      // marathon-training path order: the-aerobic-base (physiology),
      // marathon-training (practice), nutrition-and-fueling (physiology),
      // recovery (physiology), marathon-pacing-calculator (tools). With no
      // interests, a brand-new user gets the path's first topic
      // (the-aerobic-base). With a "practice" interest -- which the first
      // candidate does NOT match -- the earliest matching candidate
      // (marathon-training) should win instead.
      const withoutInterest = recommendNextTopic("training_goal", []);
      expect(withoutInterest.topicSlug).toBe("the-aerobic-base");

      const withInterest = recommendNextTopic("training_goal", [], ["practice"]);
      expect(withInterest.topicSlug).toBe("marathon-training");
      expect(withInterest.pathId).toBe("marathon-training");
    });

    it("orientation still picks the path -- interests only reorder within it, never switch paths", () => {
      // new_runner's path (start-here) has no "tools" topic at all, so an
      // unrelated interest can't smuggle in a topic from a different path.
      const result = recommendNextTopic("new_runner", [], ["tools"]);
      expect(result.pathId).toBe("start-here");
      expect(LEARNING_PATHS.find((p) => p.id === "start-here")!.topicSlugs).toContain(result.topicSlug);
    });

    it("falls back to plain path order when no candidate matches any stated interest (never gets stuck)", () => {
      // "psychology" matches none of marathon-training's 5 topics.
      const result = recommendNextTopic("training_goal", [], ["psychology"]);
      expect(result.topicSlug).toBe("the-aerobic-base");
    });

    it("interests only apply within the already-valid breadth/depth tier, not as a filter across tiers", () => {
      // how-to-start-running is already Proficient (not eligible), so even
      // though it happens to be the entry topic, the breadth tier should
      // still recommend the next real unvisited topic regardless of
      // whether that topic's category matches the stated interest.
      const progress: TopicProgress[] = [{ topicSlug: "how-to-start-running", level: "proficient" }];
      const result = recommendNextTopic("new_runner", progress, ["tools"]); // no "tools" topic in start-here
      expect(result.topicSlug).toBe("training-philosophy");
    });
  });

  describe("Phase 4.1 audit: full coverage for every path, not just start-here", () => {
    it("coaching-philosophy: breadth-first walk visits every topic before falling back to depth", () => {
      // paths.ts: coaching-library, training-philosophy, workout-library,
      // athlete-library, for-coaches -- this path had almost no direct
      // test coverage before this audit (only the generic entry-topic loop
      // touched it at all).
      expect(recommendNextTopic("coaching", []).topicSlug).toBe("coaching-library");

      const afterFirst: TopicProgress[] = [{ topicSlug: "coaching-library", level: "proficient" }];
      expect(recommendNextTopic("coaching", afterFirst).topicSlug).toBe("training-philosophy");

      const afterSecond: TopicProgress[] = [
        ...afterFirst,
        { topicSlug: "training-philosophy", level: "mastered" },
      ];
      expect(recommendNextTopic("coaching", afterSecond).topicSlug).toBe("workout-library");
    });

    it("mastered topics are excluded from both breadth and depth tiers, exactly like proficient/advanced", () => {
      const progress: TopicProgress[] = [
        { topicSlug: "coaching-library", level: "mastered" },
        { topicSlug: "training-philosophy", level: "mastered" },
        { topicSlug: "workout-library", level: "mastered" },
        { topicSlug: "athlete-library", level: "mastered" },
        { topicSlug: "for-coaches", level: "mastered" },
      ];
      const result = recommendNextTopic("coaching", progress);
      // Every topic Mastered (not just Proficient+) -- falls back to the
      // path's own entry point, the same fallback used for all-Proficient.
      expect(result.topicSlug).toBe("coaching-library");
    });

    it("a topic shared across two paths (training-philosophy: start-here + coaching-philosophy) reflects the same progress in both", () => {
      // Progress is keyed by topic slug, not by (path, topic) -- so
      // finishing training-philosophy via one path must be honored when
      // walking the other path too, not tracked separately per path.
      const progress: TopicProgress[] = [
        { topicSlug: "how-to-start-running", level: "proficient" },
        { topicSlug: "training-philosophy", level: "proficient" },
      ];
      const startHereResult = recommendNextTopic("new_runner", progress);
      expect(startHereResult.topicSlug).not.toBe("training-philosophy");
      expect(startHereResult.topicSlug).toBe("the-philosophy-of-running");

      const coachingProgress: TopicProgress[] = [
        { topicSlug: "coaching-library", level: "proficient" },
        { topicSlug: "training-philosophy", level: "proficient" },
      ];
      const coachingResult = recommendNextTopic("coaching", coachingProgress);
      expect(coachingResult.topicSlug).not.toBe("training-philosophy");
      expect(coachingResult.topicSlug).toBe("workout-library");
    });

    it("understand-the-science: full breadth-first walk across all 6 topics", () => {
      const path = LEARNING_PATHS.find((p) => p.id === "understand-the-science")!;
      let progress: TopicProgress[] = [];
      const visited: string[] = [];
      for (let i = 0; i < path.topicSlugs.length; i++) {
        const result = recommendNextTopic("science", progress);
        visited.push(result.topicSlug);
        progress = [...progress, { topicSlug: result.topicSlug, level: "proficient" }];
      }
      // Every real path topic gets recommended exactly once during a clean
      // breadth-first walk, in path order -- no repeats, nothing skipped.
      expect(visited).toEqual(path.topicSlugs);
    });
  });

  describe("tools-category path members never get stuck at their honest ceiling", () => {
    // Phase 4 path-verification finding: a "tools" topic (marathon-pacing-
    // calculator is Marathon Training's own) can only ever fire tool_used,
    // a flat, once-ever, non-repeating score contribution well under the
    // Familiar threshold -- it can never reach Proficient the way every
    // other path member eventually can. Without excluding it once visited,
    // the "shallow" depth tier would recommend it forever, since it can
    // never graduate to PROGRESSED_LEVELS alongside its path-mates.
    it("stops recommending an already-visited tools-category topic once every other path member is Proficient+", () => {
      const progress: TopicProgress[] = [
        { topicSlug: "the-aerobic-base", level: "proficient" },
        { topicSlug: "marathon-training", level: "proficient" },
        { topicSlug: "nutrition-and-fueling", level: "proficient" },
        { topicSlug: "recovery", level: "proficient" },
        // Permanently capped at exploring -- tools-category, already visited.
        { topicSlug: "marathon-pacing-calculator", level: "exploring" },
      ];
      const result = recommendNextTopic("training_goal", progress);
      expect(result.topicSlug).not.toBe("marathon-pacing-calculator");
      // Falls back to the path's own entry point, matching the existing
      // "every topic already Proficient+" fallback exactly.
      expect(result.topicSlug).toBe("the-aerobic-base");
    });

    it("still recommends an unvisited tools-category topic once (breadth-first tier is unaffected)", () => {
      const progress: TopicProgress[] = [
        { topicSlug: "the-aerobic-base", level: "proficient" },
        { topicSlug: "marathon-training", level: "proficient" },
        { topicSlug: "nutrition-and-fueling", level: "proficient" },
        { topicSlug: "recovery", level: "proficient" },
        // marathon-pacing-calculator deliberately omitted -- never visited.
      ];
      const result = recommendNextTopic("training_goal", progress);
      expect(result.topicSlug).toBe("marathon-pacing-calculator");
    });
  });
});
