import { describe, it, expect } from "vitest";
import {
  TRAINING_BACKGROUND_SOURCES,
  describeBackgroundForCoach,
  intakeQuestionsFor,
  resolveAnchorPeakMileage,
  type TrainingBackground,
} from "@/lib/private-coaching/training-background";

function background(overrides: Partial<TrainingBackground> = {}): TrainingBackground {
  return {
    source: "self_trained",
    coachName: null,
    programName: null,
    recentTypicalMileage: null,
    peakMileage: null,
    summary: null,
    injuryHistory: null,
    ...overrides,
  };
}

describe("intakeQuestionsFor (conditional onboarding, acceptance criterion)", () => {
  it("asks a self-trained athlete what their buildup actually looked like", () => {
    const questions = intakeQuestionsFor("self_trained").map((q) => q.prompt).join(" ");
    expect(questions).toMatch(/peak week/i);
    expect(questions).toMatch(/what did that buildup actually look like/i);
  });

  it("asks a brand-new runner nothing about a buildup or peak mileage", () => {
    const questions = intakeQuestionsFor("new_to_structured");
    const joined = questions.map((q) => q.prompt).join(" ");
    expect(joined).not.toMatch(/peak week/i);
    expect(joined).not.toMatch(/buildup/i);
    expect(questions.length).toBeGreaterThan(0); // still asks what they're doing now / injury history
  });

  it("asks for the previous coach's name and their peak under that coach", () => {
    const questions = intakeQuestionsFor("previous_coach").map((q) => q.prompt).join(" ");
    expect(questions).toMatch(/who was coaching them/i);
    expect(questions).toMatch(/peak week/i);
  });

  it("asks which plan or app for other_plan_or_app", () => {
    const questions = intakeQuestionsFor("other_plan_or_app").map((q) => q.prompt).join(" ");
    expect(questions).toMatch(/which plan or app/i);
  });

  it("covers every declared source", () => {
    for (const source of TRAINING_BACKGROUND_SOURCES) {
      expect(intakeQuestionsFor(source).length).toBeGreaterThan(0);
    }
  });
});

describe("describeBackgroundForCoach (copy audit: no unconditioned 'your last plan' copy)", () => {
  it("describes self-trained without assuming a platform cycle", () => {
    const ctx = describeBackgroundForCoach(background({ source: "self_trained", summary: "Peaked at 45 mi/week." }));
    expect(ctx.title).toBe("Self-trained");
    expect(ctx.detail).toMatch(/Peaked at 45 mi\/week/);
    expect(ctx.detail).not.toMatch(/last plan|last cycle with/i);
  });

  it("records a previous coach as neutral context, never a judgment", () => {
    const ctx = describeBackgroundForCoach(background({ source: "previous_coach", coachName: "Jane Smith" }));
    expect(ctx.title).toMatch(/Jane Smith/);
    expect(ctx.detail).toMatch(/neutral context/);
    expect(ctx.detail).not.toMatch(/wrong|bad|inferior/i);
  });

  it("records another plan or app as neutral context", () => {
    const ctx = describeBackgroundForCoach(background({ source: "other_plan_or_app", programName: "Some App" }));
    expect(ctx.title).toMatch(/Some App/);
    expect(ctx.detail).toMatch(/neutral context/);
  });

  it("routes a brand-new runner to the Crash Course and assumes nothing", () => {
    const ctx = describeBackgroundForCoach(background({ source: "new_to_structured" }));
    expect(ctx.detail).toMatch(/assume nothing/i);
    expect(ctx.detail).toMatch(/5K Crash Course/);
  });

  it("attaches the medical note only when injury history is actually recorded", () => {
    const withInjury = describeBackgroundForCoach(background({ injuryHistory: "IT band, 2025" }));
    expect(withInjury.medicalNote).toMatch(/nothing here is a diagnosis/i);
    const without = describeBackgroundForCoach(background());
    expect(without.medicalNote).toBeNull();
  });

  it("says nothing is recorded yet when there's no background at all", () => {
    const ctx = describeBackgroundForCoach(null);
    expect(ctx.title).toMatch(/No training background on file/);
  });
});

describe("resolveAnchorPeakMileage (Part D/G anchor, never an assumed prior Brody cycle)", () => {
  it("anchors on a recorded self-trained peak, marked reliable", () => {
    const anchor = resolveAnchorPeakMileage({
      background: background({ source: "self_trained", peakMileage: 50 }),
      currentWeeklyMileage: 20,
    });
    expect(anchor.peakMileage).toBe(50);
    expect(anchor.reliable).toBe(true);
    expect(anchor.note).toMatch(/self-trained buildup/);
    expect(anchor.note).toMatch(/not an assumed prior cycle/);
  });

  it("anchors on a recorded previous-coach peak and names the coach", () => {
    const anchor = resolveAnchorPeakMileage({
      background: background({ source: "previous_coach", coachName: "Jane Smith", peakMileage: 60 }),
      currentWeeklyMileage: null,
    });
    expect(anchor.peakMileage).toBe(60);
    expect(anchor.reliable).toBe(true);
    expect(anchor.note).toMatch(/Jane Smith/);
  });

  it("falls back to current mileage, unreliable, when no background is recorded", () => {
    const anchor = resolveAnchorPeakMileage({ background: null, currentWeeklyMileage: 30 });
    expect(anchor.peakMileage).toBe(30);
    expect(anchor.reliable).toBe(false);
    expect(anchor.note).toMatch(/No recorded training-history peak/);
    expect(anchor.note).toMatch(/confirm/i);
  });

  it("has nothing to anchor on when neither background nor current mileage is known", () => {
    const anchor = resolveAnchorPeakMileage({ background: null, currentWeeklyMileage: null });
    expect(anchor.peakMileage).toBeNull();
    expect(anchor.reliable).toBe(false);
  });

  it("defaults conservatively (no peak) for a brand-new runner regardless of current mileage", () => {
    const anchor = resolveAnchorPeakMileage({
      background: background({ source: "new_to_structured" }),
      currentWeeklyMileage: 20,
    });
    expect(anchor.peakMileage).toBeNull();
    expect(anchor.reliable).toBe(false);
    expect(anchor.note).toMatch(/Crash Course/);
  });
});
