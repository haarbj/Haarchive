import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { ATHLETE_GUIDES, getAthleteGuide } from "@/lib/private-coaching/athlete-education";
import { linkifyContent } from "@/lib/linkify";
import type { ContentBlock } from "@/lib/sections";

// Verifies the real linkify path (linkifyContent -> linkifyText ->
// glossary.ts), not just that a tool's name appears as a text string.
// ContentBlocks gives each page a fresh linkedTermIds Set, so every test
// here does the same rather than sharing one across assertions.

function hrefsIn(nodes: ReturnType<typeof linkifyContent>): string[] {
  const hrefs: string[] = [];
  for (const node of nodes) {
    if (isValidElement(node)) {
      const href = (node.props as { href?: unknown }).href;
      if (typeof href === "string") hrefs.push(href);
    }
  }
  return hrefs;
}

function paragraphTexts(content: ContentBlock[]): string[] {
  return content.filter((block): block is { type: "paragraph"; text: string } => block.type === "paragraph").map((block) => block.text);
}

describe("athlete education guides link to the tools that extend their lesson", () => {
  it("fueling-and-hydration names the Fueling Planner, and it links to /fueling-calculator through the real linkify path", () => {
    const guide = getAthleteGuide("fueling-and-hydration");
    expect(guide).not.toBeNull();
    const sentence = paragraphTexts(guide!.content).find((text) => text.includes("Fueling Planner"));
    expect(sentence, "expected a paragraph naming the Fueling Planner").toBeDefined();

    const hrefs = hrefsIn(linkifyContent(sentence!, "coaching-learn-fueling-and-hydration", new Set()));
    expect(hrefs).toEqual(["/fueling-calculator"]);
  });

  it("the Fueling Planner mention says it also appears on the workout itself", () => {
    const guide = getAthleteGuide("fueling-and-hydration");
    const sentence = paragraphTexts(guide!.content).find((text) => text.includes("Fueling Planner"));
    expect(sentence).toMatch(/shows up right on the workout itself/);
  });

  it("pacing-and-effort names the Race Pace Planner, and it links to /race-pace-planner through the real linkify path", () => {
    const guide = getAthleteGuide("pacing-and-effort");
    expect(guide).not.toBeNull();
    const sentence = paragraphTexts(guide!.content).find((text) => text.includes("Race Pace Planner"));
    expect(sentence, "expected a paragraph naming the Race Pace Planner").toBeDefined();

    const hrefs = hrefsIn(linkifyContent(sentence!, "coaching-learn-pacing-and-effort", new Set()));
    expect(hrefs).toEqual(["/race-pace-planner"]);
  });

  it("no new copy reads as advertising -- no 'check out' or link-dump language in either mention", () => {
    const fueling = paragraphTexts(getAthleteGuide("fueling-and-hydration")!.content).find((t) => t.includes("Fueling Planner"))!;
    const pacing = paragraphTexts(getAthleteGuide("pacing-and-effort")!.content).find((t) => t.includes("Race Pace Planner"))!;
    for (const text of [fueling, pacing]) {
      expect(text.toLowerCase()).not.toMatch(/check out|our tools|click here/);
      expect(text).not.toContain("—"); // no em dashes
    }
  });

  it("each tool is mentioned at most once per guide", () => {
    for (const guide of ATHLETE_GUIDES) {
      const text = paragraphTexts(guide.content).join(" ");
      for (const toolName of ["Fueling Planner", "Race Pace Planner"]) {
        const occurrences = text.split(toolName).length - 1;
        expect(occurrences, `${toolName} mentioned more than once in ${guide.slug}`).toBeLessThanOrEqual(1);
      }
    }
  });

  // Gap confirmation: the task also asked for heat/weather, altitude,
  // training-load/progression, and goal-race/course mentions, but no
  // athlete-education guide covers any of those lessons today (see the
  // task report) -- this pins that absence so a future guide addition is
  // a deliberate, visible decision to add a tool mention, not a silent
  // gap.
  it("no guide currently covers heat/weather, altitude, training load, or course content", () => {
    const allText = ATHLETE_GUIDES.flatMap((guide) => paragraphTexts(guide.content)).join(" ");
    for (const toolName of ["Heat Tracker", "Environmental Performance Calculator", "Altitude Calculator", "Training Load Planner", "Course Comparator"]) {
      expect(allText).not.toContain(toolName);
    }
  });
});
