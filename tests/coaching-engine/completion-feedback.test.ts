import { describe, expect, it } from "vitest";
import { generateCompletionFeedback } from "@/lib/coaching-engine/completion-feedback";
import type { WorkoutPrescription } from "@/lib/coaching-engine/types";

const easy: WorkoutPrescription = { kind: "easy", distanceM: 8000, paceRangeSecPerKm: [300, 330] };
const tempo: WorkoutPrescription = {
  kind: "tempo",
  warmupM: 1600,
  tempoM: 4800,
  cooldownM: 1600,
  paceRangeSecPerKm: [240, 250],
};
const race: WorkoutPrescription = { kind: "race", distanceM: 42195 };

describe("generateCompletionFeedback", () => {
  it("returns null when nothing was logged", () => {
    expect(generateCompletionFeedback(easy, { actualDistanceM: null, actualTimeS: null, rpe: null })).toBeNull();
  });

  it("returns null for a race with no RPE logged", () => {
    expect(generateCompletionFeedback(race, { actualDistanceM: 42195, actualTimeS: 10000, rpe: null })).toBeNull();
  });

  it("acknowledges race day whenever an RPE is logged", () => {
    const feedback = generateCompletionFeedback(race, { actualDistanceM: 42195, actualTimeS: 10000, rpe: 9 });
    expect(feedback).toMatch(/race day/i);
  });

  it("affirms an easy run that stayed in range with no RPE logged", () => {
    const feedback = generateCompletionFeedback(easy, { actualDistanceM: 8000, actualTimeS: 2520, rpe: null });
    expect(feedback).toMatch(/comfortably aerobic/i);
  });

  it("affirms an easy run run slower than the range (still easy)", () => {
    const feedback = generateCompletionFeedback(easy, { actualDistanceM: 8000, actualTimeS: 2720, rpe: null });
    expect(feedback).toMatch(/comfortably aerobic/i);
  });

  it("cautions when an easy run was run faster than its range", () => {
    const feedback = generateCompletionFeedback(easy, { actualDistanceM: 8000, actualTimeS: 2320, rpe: null });
    expect(feedback).toMatch(/harder than an easy day/i);
  });

  it("cautions when an easy run's RPE is unexpectedly high even though pace was in range", () => {
    const feedback = generateCompletionFeedback(easy, { actualDistanceM: 8000, actualTimeS: 2520, rpe: 8 });
    expect(feedback).toMatch(/harder than an easy day/i);
  });

  it("uses RPE alone when no distance/time was logged for an easy run", () => {
    const low = generateCompletionFeedback(easy, { actualDistanceM: null, actualTimeS: null, rpe: 3 });
    expect(low).toMatch(/comfortably aerobic/i);
    const high = generateCompletionFeedback(easy, { actualDistanceM: null, actualTimeS: null, rpe: 9 });
    expect(high).toMatch(/harder than an easy day/i);
  });

  it("affirms a tempo run that hit pace with reasonable RPE", () => {
    const feedback = generateCompletionFeedback(tempo, { actualDistanceM: 8000, actualTimeS: 1960, rpe: 7 });
    expect(feedback).toMatch(/controlled-hard effort/i);
  });

  it("flags a tempo run that hit pace but cost more than expected", () => {
    const feedback = generateCompletionFeedback(tempo, { actualDistanceM: 8000, actualTimeS: 1960, rpe: 9 });
    expect(feedback).toMatch(/cost more than this session/i);
  });

  it("reframes a tempo run that came in slower than target without alarming language", () => {
    const feedback = generateCompletionFeedback(tempo, { actualDistanceM: 8000, actualTimeS: 2080, rpe: 6 });
    expect(feedback).toMatch(/slower than the target/i);
    expect(feedback).not.toMatch(/paying attention/i);
  });

  it("combines slower-than-target pace with high RPE into one caution", () => {
    const feedback = generateCompletionFeedback(tempo, { actualDistanceM: 8000, actualTimeS: 2080, rpe: 9 });
    expect(feedback).toMatch(/slower than target/i);
    expect(feedback).toMatch(/paying attention/i);
  });

  it("never suggests it has automatically changed another workout", () => {
    const cases = [
      generateCompletionFeedback(easy, { actualDistanceM: 8000, actualTimeS: 2320, rpe: null }),
      generateCompletionFeedback(tempo, { actualDistanceM: 8000, actualTimeS: 2080, rpe: 9 }),
    ];
    for (const feedback of cases) {
      expect(feedback).not.toMatch(/tomorrow's workout has been/i);
      expect(feedback).not.toMatch(/has been adjusted/i);
    }
  });
});
