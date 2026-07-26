import { describe, expect, it } from "vitest";

import { PRESET_COURSES, buildPresetRoute, totalDistanceOfPresetRoute } from "@/lib/marathon-pacing/preset-courses";
import { analyzeCourse } from "@/lib/marathon-pacing/course-analysis";

const METERS_PER_MILE = 1609.344;
const MARATHON_METERS = 42195;

describe("preset courses", () => {
  it.each(PRESET_COURSES)("$name resolves to a real marathon distance", (course) => {
    const route = buildPresetRoute(course);
    const distanceM = totalDistanceOfPresetRoute(route);
    expect(distanceM).toBeCloseTo(MARATHON_METERS, -2); // within 100m of 42195m
  });

  it.each(PRESET_COURSES)("$name analyzes cleanly through the real course-analysis pipeline", (course) => {
    const route = buildPresetRoute(course);
    const analysis = analyzeCourse(route);
    expect(analysis.totalDistanceM).toBeGreaterThan(MARATHON_METERS - 500);
    expect(analysis.perMileGrade.length).toBeGreaterThanOrEqual(26);
    expect(analysis.perMileGrade.every((g) => Number.isFinite(g))).toBe(true);
  });

  it("Chicago and Berlin are meaningfully flatter than Boston and NYC", () => {
    const flat = ["chicago", "berlin"];
    const hilly = ["boston", "nyc"];

    const totalClimbFor = (id: string) => {
      const course = PRESET_COURSES.find((c) => c.id === id)!;
      return analyzeCourse(buildPresetRoute(course)).totalClimbM;
    };

    const maxFlatClimb = Math.max(...flat.map(totalClimbFor));
    const minHillyClimb = Math.min(...hilly.map(totalClimbFor));
    expect(maxFlatClimb).toBeLessThan(minHillyClimb);
  });

  it("Boston's course-analysis finds a significant climb in the Newton Hills / Heartbreak Hill range (miles 16-21)", () => {
    const boston = PRESET_COURSES.find((c) => c.id === "boston")!;
    const analysis = analyzeCourse(buildPresetRoute(boston));

    const newtonHillsClimb = analysis.climbs.find((c) => {
      const startMile = c.startDistanceM / METERS_PER_MILE;
      const endMile = c.endDistanceM / METERS_PER_MILE;
      return startMile >= 15 && endMile <= 22;
    });
    expect(newtonHillsClimb).toBeDefined();
    expect(newtonHillsClimb!.gainM).toBeGreaterThan(15); // a real, non-trivial climb, not noise
  });

  it("Boston is a net downhill course start-to-finish", () => {
    const boston = PRESET_COURSES.find((c) => c.id === "boston")!;
    const analysis = analyzeCourse(buildPresetRoute(boston));
    expect(analysis.avgGrade).toBeLessThan(0);
  });
});
