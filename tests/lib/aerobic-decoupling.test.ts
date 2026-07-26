import { describe, expect, it } from "vitest";

import { computeAerobicDecoupling, type DecouplingStream } from "@/lib/aerobic-decoupling";

// Builds a synthetic 40-minute run sampled once per second: constant pace
// throughout, with heart rate rising linearly from startHr to endHr.
function buildStream(startHr: number, endHr: number, durationS = 40 * 60, paceMS = 3.0): DecouplingStream {
  const timeS: number[] = [];
  const distanceM: number[] = [];
  const heartrateBpm: number[] = [];
  for (let t = 0; t <= durationS; t += 1) {
    timeS.push(t);
    distanceM.push(t * paceMS);
    heartrateBpm.push(startHr + (endHr - startHr) * (t / durationS));
  }
  return { timeS, distanceM, heartrateBpm };
}

describe("computeAerobicDecoupling", () => {
  it("returns null for too short a duration", () => {
    const stream = buildStream(140, 140, 5 * 60);
    expect(computeAerobicDecoupling(stream)).toBeNull();
  });

  it("returns null for mismatched array lengths", () => {
    const stream = buildStream(140, 140);
    stream.heartrateBpm = stream.heartrateBpm.slice(0, -5);
    expect(computeAerobicDecoupling(stream)).toBeNull();
  });

  it("returns close to zero decoupling for flat, constant heart rate", () => {
    const stream = buildStream(150, 150);
    const result = computeAerobicDecoupling(stream);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.decouplingPct)).toBeLessThan(1);
  });

  it("reports positive decoupling when heart rate climbs at a constant pace", () => {
    const stream = buildStream(140, 160);
    const result = computeAerobicDecoupling(stream);
    expect(result).not.toBeNull();
    expect(result!.decouplingPct).toBeGreaterThan(0);
    expect(result!.secondHalfAvgHr).toBeGreaterThan(result!.firstHalfAvgHr);
    // Constant pace throughout -- decoupling should come entirely from the HR side.
    expect(result!.firstHalfPaceMS).toBeCloseTo(result!.secondHalfPaceMS, 5);
  });

  it("reports negative decoupling when heart rate falls at a constant pace (improving efficiency)", () => {
    const stream = buildStream(160, 140);
    const result = computeAerobicDecoupling(stream);
    expect(result).not.toBeNull();
    expect(result!.decouplingPct).toBeLessThan(0);
  });
});
