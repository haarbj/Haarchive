import { describe, expect, it } from "vitest";

import { initialFatigueState, stepFatigueState, type PhysiologyProfile } from "@/lib/marathon-pacing/physiology-engine";

const PROFILE: PhysiologyProfile = {
  criticalSpeedMS: 4.0, // ~6:42/mi
  vo2maxSpeedMS: 5.2,
  weightKg: 70,
  durability: "average",
};

describe("initialFatigueState", () => {
  it("starts fully rested and fully fueled", () => {
    const state = initialFatigueState(PROFILE);
    expect(state.wPrimeBalanceFraction).toBe(1);
    expect(state.glycogenRemainingFraction).toBe(1);
    expect(state.cardiacDriftFraction).toBe(0);
    expect(state.cumulativeEccentricDamageScore).toBe(0);
  });

  it("gives a more durable runner a larger W'-balance reserve", () => {
    const poor = initialFatigueState({ ...PROFILE, durability: "poor" });
    const excellent = initialFatigueState({ ...PROFILE, durability: "excellent" });
    expect(excellent.wPrimeBalanceM).toBeGreaterThan(poor.wPrimeBalanceM);
  });
});

describe("stepFatigueState -- W'-balance", () => {
  it("depletes when running above critical speed, by exactly (speed - CS) * duration", () => {
    const state = initialFatigueState(PROFILE);
    const speedMS = PROFILE.criticalSpeedMS + 0.5;
    const distanceM = 1000;
    const durationSeconds = distanceM / speedMS;
    const next = stepFatigueState(state, PROFILE, { grade: 0, speedMS, distanceM });

    const expectedDepletion = (speedMS - PROFILE.criticalSpeedMS) * durationSeconds;
    expect(state.wPrimeBalanceM - next.wPrimeBalanceM).toBeCloseTo(expectedDepletion, 6);
  });

  it("never depletes below zero, even under sustained above-CS running", () => {
    let state = initialFatigueState(PROFILE);
    for (let i = 0; i < 50; i++) {
      state = stepFatigueState(state, PROFILE, { grade: 0, speedMS: PROFILE.criticalSpeedMS + 1, distanceM: 1000 });
    }
    expect(state.wPrimeBalanceM).toBe(0);
    expect(state.wPrimeBalanceFraction).toBe(0);
  });

  it("recovers toward full when running below critical speed", () => {
    let state = initialFatigueState(PROFILE);
    // Deplete first.
    state = stepFatigueState(state, PROFILE, { grade: 0, speedMS: PROFILE.criticalSpeedMS + 1, distanceM: 2000 });
    const depletedBalance = state.wPrimeBalanceM;
    expect(depletedBalance).toBeLessThan(initialFatigueState(PROFILE).wPrimeBalanceM);

    // Recover over a long easy stretch.
    for (let i = 0; i < 20; i++) {
      state = stepFatigueState(state, PROFILE, { grade: 0, speedMS: PROFILE.criticalSpeedMS - 1, distanceM: 1000 });
    }
    expect(state.wPrimeBalanceM).toBeGreaterThan(depletedBalance);
    expect(state.wPrimeBalanceFraction).toBeLessThanOrEqual(1);
  });
});

describe("stepFatigueState -- glycogen", () => {
  it("burns glycogen at any real running effort", () => {
    const state = initialFatigueState(PROFILE);
    const next = stepFatigueState(state, PROFILE, { grade: 0, speedMS: 3.5, distanceM: 1609.344 });
    expect(next.glycogenRemainingGrams).toBeLessThan(state.glycogenRemainingGrams);
  });

  it("burns glycogen faster, per mile, at a higher fraction of vVO2max", () => {
    const state = initialFatigueState(PROFILE);
    const easyDistanceM = 1609.344;
    const hardDistanceM = 1609.344;

    const easy = stepFatigueState(state, PROFILE, { grade: 0, speedMS: 3.2, distanceM: easyDistanceM });
    const hard = stepFatigueState(state, PROFILE, { grade: 0, speedMS: 4.8, distanceM: hardDistanceM });

    const easyBurned = state.glycogenRemainingGrams - easy.glycogenRemainingGrams;
    const hardBurned = state.glycogenRemainingGrams - hard.glycogenRemainingGrams;
    expect(hardBurned).toBeGreaterThan(easyBurned);
  });

  it("carbohydrate intake offsets depletion versus no fueling, for the same mile", () => {
    const state = initialFatigueState(PROFILE);
    const unfueled = stepFatigueState(state, PROFILE, { grade: 0, speedMS: 4.0, distanceM: 1609.344 });
    const fueled = stepFatigueState(state, PROFILE, { grade: 0, speedMS: 4.0, distanceM: 1609.344, carbIntakeGramsPerHour: 60 });
    expect(fueled.glycogenRemainingGrams).toBeGreaterThan(unfueled.glycogenRemainingGrams);
  });

  it("gives a more durable runner a larger glycogen store, so they deplete more slowly at an identical sub-threshold pace", () => {
    // speedMS is well below criticalSpeedMS (4.0) -- the common case for a
    // sane marathon goal, where W'-balance never depletes for anyone. This
    // is the exact scenario where durability previously had no visible
    // effect on anything at all.
    const poor = initialFatigueState({ ...PROFILE, durability: "poor" });
    const excellent = initialFatigueState({ ...PROFILE, durability: "excellent" });
    expect(excellent.glycogenRemainingGrams).toBeGreaterThan(poor.glycogenRemainingGrams);

    const mile = { grade: 0, speedMS: 3.5, distanceM: 1609.344 };
    let poorState = poor;
    let excellentState = excellent;
    for (let i = 0; i < 20; i++) {
      poorState = stepFatigueState(poorState, { ...PROFILE, durability: "poor" }, mile);
      excellentState = stepFatigueState(excellentState, { ...PROFILE, durability: "excellent" }, mile);
    }
    expect(excellentState.glycogenRemainingFraction).toBeGreaterThan(poorState.glycogenRemainingFraction);
  });
});

describe("stepFatigueState -- cardiac drift", () => {
  it("increases with elapsed time at constant pace", () => {
    let state = initialFatigueState(PROFILE);
    const drifts: number[] = [state.cardiacDriftFraction];
    for (let i = 0; i < 10; i++) {
      state = stepFatigueState(state, PROFILE, { grade: 0, speedMS: 4.0, distanceM: 5000 });
      drifts.push(state.cardiacDriftFraction);
    }
    for (let i = 1; i < drifts.length; i++) {
      expect(drifts[i]).toBeGreaterThanOrEqual(drifts[i - 1]);
    }
    expect(drifts[drifts.length - 1]).toBeGreaterThan(0);
  });

  it("drifts faster in the heat than in neutral conditions, at the same duration", () => {
    const state = initialFatigueState(PROFILE);
    const neutral = stepFatigueState(state, PROFILE, { grade: 0, speedMS: 4.0, distanceM: 20000, tempC: 15 });
    const hot = stepFatigueState(state, PROFILE, { grade: 0, speedMS: 4.0, distanceM: 20000, tempC: 32 });
    expect(hot.cardiacDriftFraction).toBeGreaterThan(neutral.cardiacDriftFraction);
  });

  it("is capped rather than growing without bound over a very long effort", () => {
    let state = initialFatigueState(PROFILE);
    for (let i = 0; i < 30; i++) {
      state = stepFatigueState(state, PROFILE, { grade: 0, speedMS: 3.0, distanceM: 10000, tempC: 35 });
    }
    expect(state.cardiacDriftFraction).toBeLessThanOrEqual(0.2);
  });

  it("drifts less for a more durable runner at the same sub-threshold pace and duration", () => {
    const poorProfile: PhysiologyProfile = { ...PROFILE, durability: "poor" };
    const excellentProfile: PhysiologyProfile = { ...PROFILE, durability: "excellent" };
    const mile = { grade: 0, speedMS: 3.5, distanceM: 10000 };

    const poor = stepFatigueState(initialFatigueState(poorProfile), poorProfile, mile);
    const excellent = stepFatigueState(initialFatigueState(excellentProfile), excellentProfile, mile);
    expect(excellent.cardiacDriftFraction).toBeLessThan(poor.cardiacDriftFraction);
  });
});

describe("stepFatigueState -- eccentric damage", () => {
  it("stays at zero for flat or uphill miles", () => {
    let state = initialFatigueState(PROFILE);
    state = stepFatigueState(state, PROFILE, { grade: 0, speedMS: 4.0, distanceM: 1609.344 });
    state = stepFatigueState(state, PROFILE, { grade: 0.05, speedMS: 3.8, distanceM: 1609.344 });
    expect(state.cumulativeEccentricDamageScore).toBe(0);
  });

  it("accumulates on steep descents (beyond -8%) and is monotonically non-decreasing", () => {
    let state = initialFatigueState(PROFILE);
    state = stepFatigueState(state, PROFILE, { grade: -0.03, speedMS: 4.2, distanceM: 1609.344 }); // gentle, no damage
    expect(state.cumulativeEccentricDamageScore).toBe(0);

    const before = state.cumulativeEccentricDamageScore;
    state = stepFatigueState(state, PROFILE, { grade: -0.15, speedMS: 4.5, distanceM: 1609.344 }); // steep, damaging
    expect(state.cumulativeEccentricDamageScore).toBeGreaterThan(before);
  });
});
