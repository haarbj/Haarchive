import { describe, expect, it } from "vitest";

import { coaches } from "@/lib/coaches/data";
import { athletes } from "@/lib/athletes/data";
import { sections } from "@/lib/sections";
import { headingId } from "@/lib/heading-id";

// Phase 2F: the Coaching/Athlete Library's own cross-reference system
// (crossLinks, otherCoachesCritique, relatedPhilosophies, notableAthletes,
// coachHistory, influencedBy, signatureWorkouts/signatureTraining's
// workoutLibraryHref) had no automated validation at all before this --
// every reference was hand-verified once, per phase, via a throwaway
// script. These are genuine, repeatable invariants (a coach/athlete slug
// referenced elsewhere must exist; an href must point at a real route; a
// workout-library anchor must point at a real heading), so they're worth
// keeping green permanently rather than re-deriving by hand next time.

const realCoachSlugs = new Set(coaches.map((c) => c.slug));
const realAthleteSlugs = new Set(athletes.map((a) => a.slug));

const KNOWN_TOOL_AND_STATIC_ROUTES = new Set([
  "/pace-calculator",
  "/cv-threshold-calculator",
  "/tinman-calculator",
  "/race-pace-calculator",
  "/pace-percent-calculator",
  "/marathon-pacing-calculator",
  "/hr-threshold-calculator",
  "/gap-calculator",
  "/environmental-calculator",
  "/heat-tracker",
  "/training-plans",
  "/coaching-library",
  "/athlete-library",
]);

const realSectionSlugs = new Set(sections.map((s) => s.slug));

function workoutLibraryHeadingIds(): Set<string> {
  const section = sections.find((s) => s.slug === "workout-library");
  const ids = new Set<string>();
  for (const block of section?.content ?? []) {
    if (block.type === "heading") ids.add(headingId(block.text));
  }
  return ids;
}
const wlHeadingIds = workoutLibraryHeadingIds();

function isRealRoute(href: string): boolean {
  const [path] = href.split("#");
  const bare = path.replace(/^\//, "");
  return realSectionSlugs.has(bare) || KNOWN_TOOL_AND_STATIC_ROUTES.has(path) || realCoachSlugs.has(bare.replace(/^coaching-library\//, ""));
}

describe("coach data cross-references resolve to real entities", () => {
  it.each(coaches.map((c) => [c.slug, c] as const))("%s: otherCoachesCritique/relatedPhilosophies/notableAthletes/influencedBy are real", (_slug, coach) => {
    for (const critique of coach.otherCoachesCritique) {
      expect(realCoachSlugs.has(critique.coachSlug), `${coach.slug} otherCoachesCritique -> unknown coach "${critique.coachSlug}"`).toBe(true);
    }
    for (const related of coach.relatedPhilosophies) {
      expect(realCoachSlugs.has(related.slug), `${coach.slug} relatedPhilosophies -> unknown coach "${related.slug}"`).toBe(true);
    }
    for (const athlete of coach.notableAthletes) {
      if (athlete.slug) {
        expect(realAthleteSlugs.has(athlete.slug), `${coach.slug} notableAthletes -> unknown athlete "${athlete.slug}" (${athlete.name})`).toBe(true);
      }
    }
    for (const tier of coach.influencedBy) {
      for (const link of tier) {
        if (link.slug) {
          expect(realCoachSlugs.has(link.slug), `${coach.slug} influencedBy -> unknown coach "${link.slug}"`).toBe(true);
        }
      }
    }
  });

  it.each(coaches.map((c) => [c.slug, c] as const))("%s: crossLinks point at real routes", (_slug, coach) => {
    for (const link of coach.crossLinks) {
      expect(isRealRoute(link.href), `${coach.slug} crossLinks -> unknown route "${link.href}"`).toBe(true);
    }
  });

  it.each(coaches.map((c) => [c.slug, c] as const))("%s: signatureWorkouts' workoutLibraryHref anchors are real headings", (_slug, coach) => {
    for (const workout of coach.signatureWorkouts) {
      if (!workout.workoutLibraryHref) continue;
      const anchor = workout.workoutLibraryHref.split("#")[1];
      expect(wlHeadingIds.has(anchor), `${coach.slug} "${workout.name}" -> unknown workout-library anchor "${anchor}"`).toBe(true);
    }
  });
});

describe("athlete data cross-references resolve to real entities", () => {
  it.each(athletes.map((a) => [a.slug, a] as const))("%s: coachHistory coachSlug is real", (_slug, athlete) => {
    for (const stint of athlete.coachHistory) {
      if (stint.coachSlug) {
        expect(realCoachSlugs.has(stint.coachSlug), `${athlete.slug} coachHistory -> unknown coach "${stint.coachSlug}"`).toBe(true);
      }
    }
  });

  it.each(athletes.map((a) => [a.slug, a] as const))("%s: crossLinks point at real routes", (_slug, athlete) => {
    for (const link of athlete.crossLinks) {
      expect(isRealRoute(link.href), `${athlete.slug} crossLinks -> unknown route "${link.href}"`).toBe(true);
    }
  });

  it.each(athletes.map((a) => [a.slug, a] as const))("%s: signatureTraining/famousSessions workoutLibraryHref anchors are real headings", (_slug, athlete) => {
    for (const workout of [...athlete.signatureTraining, ...athlete.famousSessions]) {
      if (!workout.workoutLibraryHref) continue;
      const anchor = workout.workoutLibraryHref.split("#")[1];
      expect(wlHeadingIds.has(anchor), `${athlete.slug} "${workout.name}" -> unknown workout-library anchor "${anchor}"`).toBe(true);
    }
  });
});
