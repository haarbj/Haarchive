import { describe, expect, it } from "vitest";

import { meanPercent, referenceRangePercent } from "@/lib/hr-threshold-reference";

// Every expected value below is pinned to the actual output of running the
// source repo's own R analysis (metafor::rma / rma.mv, REML) directly --
// not independently re-derived. See hr-threshold-reference.ts's own header
// comment for how that was verified.

describe("meanPercent", () => {
  it("matches the verified %HRmax meta-analysis means", () => {
    expect(meanPercent("hrmax", "lt1")).toBeCloseTo(86.79, 1);
    expect(meanPercent("hrmax", "lt2")).toBeCloseTo(92.97, 1);
  });

  it("matches the verified %HR reserve single-study means", () => {
    expect(meanPercent("hrreserve", "lt1")).toBeCloseTo(83.73, 1);
    expect(meanPercent("hrreserve", "lt2")).toBeCloseTo(93.59, 1);
  });

  it("LT2 is always a higher percentage than LT1, for either basis", () => {
    expect(meanPercent("hrmax", "lt2")).toBeGreaterThan(meanPercent("hrmax", "lt1"));
    expect(meanPercent("hrreserve", "lt2")).toBeGreaterThan(meanPercent("hrreserve", "lt1"));
  });
});

describe("referenceRangePercent", () => {
  it("matches the verified 90% %HRmax reference ranges", () => {
    const lt1 = referenceRangePercent("hrmax", "lt1", 0.9);
    expect(lt1.low).toBeCloseTo(68.77, 1);
    expect(lt1.high).toBeCloseTo(94.41, 1);

    const lt2 = referenceRangePercent("hrmax", "lt2", 0.9);
    expect(lt2.low).toBeCloseTo(79.81, 1);
    expect(lt2.high).toBeCloseTo(97.55, 1);
  });

  it("matches the verified 80% and 95% %HRmax reference ranges for LT1", () => {
    const at80 = referenceRangePercent("hrmax", "lt1", 0.8);
    expect(at80.low).toBeCloseTo(74.18, 1);
    expect(at80.high).toBeCloseTo(93.24, 1);

    const at95 = referenceRangePercent("hrmax", "lt1", 0.95);
    expect(at95.low).toBeCloseTo(63.18, 1);
    expect(at95.high).toBeCloseTo(95.26, 1);
  });

  it("matches the verified 90% %HR reserve reference ranges", () => {
    const lt1 = referenceRangePercent("hrreserve", "lt1", 0.9);
    expect(lt1.low).toBeCloseTo(70.09, 1);
    expect(lt1.high).toBeCloseTo(91.16, 1);

    const lt2 = referenceRangePercent("hrreserve", "lt2", 0.9);
    expect(lt2.low).toBeCloseTo(79.22, 1);
    expect(lt2.high).toBeCloseTo(98.02, 1);
  });

  it("a wider confidence level always produces a wider (or equal) range", () => {
    const narrow = referenceRangePercent("hrmax", "lt1", 0.8);
    const wide = referenceRangePercent("hrmax", "lt1", 0.95);
    expect(wide.low).toBeLessThanOrEqual(narrow.low);
    expect(wide.high).toBeGreaterThanOrEqual(narrow.high);
  });

  it("the range brackets the mean", () => {
    const mean = meanPercent("hrmax", "lt2");
    const range = referenceRangePercent("hrmax", "lt2", 0.9);
    expect(mean).toBeGreaterThan(range.low);
    expect(mean).toBeLessThan(range.high);
  });
});
