import { describe, expect, it } from "vitest";

import { ageFromBirthYear, kgToLbs } from "@/lib/profile-fitness-source";

describe("ageFromBirthYear", () => {
  it("computes age from the current year", () => {
    const currentYear = new Date().getFullYear();
    expect(ageFromBirthYear(currentYear - 30)).toBe(30);
  });

  it("returns null for a missing birth year", () => {
    expect(ageFromBirthYear(null)).toBeNull();
    expect(ageFromBirthYear(undefined)).toBeNull();
  });
});

describe("kgToLbs", () => {
  it("converts kilograms to pounds", () => {
    expect(kgToLbs(70)).toBeCloseTo(154.32, 1);
  });
});
