import { describe, expect, it } from "vitest";
import { buildAdaptationSystemPrompt, buildRetrievalQuery, buildSystemPrompt } from "@/lib/ai/prompts";
import type { CoachingContext } from "@/lib/ai/context";
import type { RetrievedExcerpt } from "@/lib/ai/retrieval";

const EMPTY_CONTEXT: CoachingContext = {
  goal: null,
  workout: null,
  recentCompletions: [],
  recentCheckin: null,
};

describe("buildRetrievalQuery", () => {
  it("includes workout-type keywords", () => {
    expect(buildRetrievalQuery("tempo", null)).toMatch(/tempo/i);
    expect(buildRetrievalQuery("long", null)).toMatch(/long run/i);
    expect(buildRetrievalQuery("vo2", null)).toMatch(/vo2max|interval/i);
  });

  it("includes phase keywords when a phase is given", () => {
    const withPhase = buildRetrievalQuery("easy", "base");
    const withoutPhase = buildRetrievalQuery("easy", null);
    expect(withPhase).toMatch(/aerobic base/i);
    expect(withPhase.length).toBeGreaterThan(withoutPhase.length);
  });

  it("produces a distinct query per phase", () => {
    const queries = (["base", "build", "peak", "taper", "recovery"] as const).map((phase) =>
      buildRetrievalQuery("easy", phase),
    );
    expect(new Set(queries).size).toBe(queries.length);
  });

  it("folds in the athlete's own message when given", () => {
    const query = buildRetrievalQuery("tempo", "build", "I missed yesterday's run");
    expect(query).toContain("I missed yesterday's run");
  });
});

describe("buildAdaptationSystemPrompt", () => {
  it("includes the shared guardrails and names all four tools", () => {
    const prompt = buildAdaptationSystemPrompt(EMPTY_CONTEXT, []);
    expect(prompt).toMatch(/never state a race-time prediction as a certainty/i);
    expect(prompt).toMatch(/never diagnose an injury/i);
    expect(prompt).toContain("compressWorkout");
    expect(prompt).toContain("substituteForSurface");
    expect(prompt).toContain("insertRecoveryDay");
    expect(prompt).toContain("adjustForHeat");
  });

  it("instructs the model not to invent numbers itself", () => {
    const prompt = buildAdaptationSystemPrompt(EMPTY_CONTEXT, []);
    // \s+ rather than literal spaces -- this prose can reflow across lines
    // in the source without changing its meaning, and the test shouldn't
    // be brittle against exactly where that happens to wrap.
    expect(prompt).toMatch(/never invent a new workout or new\s+numbers yourself/i);
  });

  it("still includes the same athlete/workout data block as the explain prompt", () => {
    const context: CoachingContext = {
      ...EMPTY_CONTEXT,
      goal: { raceName: "Chicago Marathon", distanceM: 42195, goalTimeS: 12600, goalDate: "2026-10-25" },
    };
    const prompt = buildAdaptationSystemPrompt(context, []);
    expect(prompt).toContain("Chicago Marathon");
  });
});

describe("buildSystemPrompt", () => {
  it("always includes the core guardrails regardless of context", () => {
    const prompt = buildSystemPrompt(EMPTY_CONTEXT, []);
    expect(prompt).toMatch(/never state a race-time prediction as a certainty/i);
    expect(prompt).toMatch(/never diagnose an injury/i);
    expect(prompt).toMatch(/name the tradeoff/i);
  });

  it("includes the goal, workout, and phase when present", () => {
    const context: CoachingContext = {
      goal: { raceName: "Chicago Marathon", distanceM: 42195, goalTimeS: 12600, goalDate: "2026-10-25" },
      workout: {
        workoutType: "tempo",
        prescription: { kind: "tempo", warmupM: 1600, tempoM: 4800, cooldownM: 1600, paceRangeSecPerKm: [260, 270] },
        scheduledDate: "2026-07-15",
        phase: "build",
        focusNotes: "Add tempo work on top of the base you've built.",
      },
      recentCompletions: [],
      recentCheckin: null,
    };
    const prompt = buildSystemPrompt(context, []);
    expect(prompt).toContain("Chicago Marathon");
    expect(prompt).toMatch(/"tempo" session/);
    expect(prompt).toContain("Training phase: build");
    expect(prompt).toContain("Add tempo work on top of the base you've built.");
  });

  it("includes recent completions and check-in data when present", () => {
    const context: CoachingContext = {
      ...EMPTY_CONTEXT,
      recentCompletions: [
        { scheduledDate: "2026-07-13", workoutType: "long", actualDistanceM: 19312, actualTimeS: 9300, rpe: 6 },
      ],
      recentCheckin: { weekStart: "2026-07-06", fatigue: 3, soreness: 2, sleepQuality: 4, stress: 2 },
    };
    const prompt = buildSystemPrompt(context, []);
    expect(prompt).toMatch(/12\.0 mi/); // 19312m -> 12.0 mi
    expect(prompt).toMatch(/RPE 6\/10/);
    expect(prompt).toMatch(/fatigue 3, soreness 2, sleep quality 4, stress 2/i);
  });

  it("cites retrieved excerpts with a numbered reference", () => {
    const excerpts: RetrievedExcerpt[] = [
      { sectionSlug: "the-aerobic-base", sectionTitle: "The Aerobic Base", heading: "Why Miles in the Bank Actually Works", text: "Oxygen acts as a catalyst...", score: 5 },
    ];
    const prompt = buildSystemPrompt(EMPTY_CONTEXT, excerpts);
    expect(prompt).toContain("[1] The Aerobic Base -- Why Miles in the Bank Actually Works");
  });

  it("says explicitly when no excerpts were retrieved", () => {
    const prompt = buildSystemPrompt(EMPTY_CONTEXT, []);
    expect(prompt).toMatch(/no specific reference material retrieved/i);
  });
});
