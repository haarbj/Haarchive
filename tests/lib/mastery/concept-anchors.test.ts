import { readFileSync } from "fs";
import { fileURLToPath } from "url";

import { describe, expect, it } from "vitest";

import { conceptAnchorsForTopic } from "@/lib/mastery/concept-anchors";
import { CONCEPT_SEEDS } from "@/lib/mastery/taxonomy";
import { glossaryTerms } from "@/lib/glossary";
import { headingId } from "@/lib/heading-id";
import { sectionMap } from "@/lib/sections";

describe("conceptAnchorsForTopic", () => {
  it("returns a real anchor id for a concept whose glossary href has a fragment", () => {
    // "vo2-max" itself is deliberately excluded from this assertion --
    // its real glossary.ts href is page-level (/exercise-physiology, no
    // fragment), unlike PHYSIOLOGY_TOPICS' own vo2max entry which does
    // have one; "muscle-tone" is the concept that actually has a fragment.
    const anchors = conceptAnchorsForTopic("exercise-physiology");
    const muscleTone = anchors.find((a) => a.slug === "muscle-tone");
    expect(muscleTone?.anchorId).toBe("muscle-tone-elasticity-and-stiffness-defined");
  });

  it("excludes concepts with no glossaryTermId (e.g. neuromuscular-power, biomechanics-form)", () => {
    const noGlossaryConcepts = CONCEPT_SEEDS.filter(
      (c) => c.topicSlug === "exercise-physiology" && c.glossaryTermId === null,
    );
    expect(noGlossaryConcepts.length).toBeGreaterThan(0); // sanity: this case actually exists in the seed data

    const anchors = conceptAnchorsForTopic("exercise-physiology");
    for (const concept of noGlossaryConcepts) {
      expect(anchors.some((a) => a.slug === concept.slug)).toBe(false);
    }
  });

  it("excludes concepts whose glossary href has no anchor fragment", () => {
    // "vdot" -> /coaching-library/daniels (no #fragment) -- confirmed via
    // src/lib/glossary.ts.
    const anchors = conceptAnchorsForTopic("coaching-library");
    expect(anchors.some((a) => a.slug === "vdot")).toBe(false);
  });

  it("returns an empty array for a topic with no seeded concepts", () => {
    // marathon-training was this test's original example, but Phase 4
    // (content coverage expansion) gave it real concepts -- strength-
    // training remains genuinely uncovered as of this writing.
    expect(conceptAnchorsForTopic("strength-training")).toEqual([]);
    expect(conceptAnchorsForTopic("not-a-real-topic-slug")).toEqual([]);
  });

  it("every returned anchorId corresponds to a real glossary.ts fragment", () => {
    const allHrefsWithFragments = new Set(
      glossaryTerms.filter((t) => t.href.includes("#")).map((t) => t.href.split("#")[1]),
    );
    const anchors = conceptAnchorsForTopic("nutrition-and-fueling");
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(allHrefsWithFragments.has(anchor.anchorId)).toBe(true);
    }
  });

  it("across the whole taxonomy, exactly the 7 known-unresolvable concepts (Phase 3 audit) never resolve", () => {
    // Regression guard for concept-anchors.ts's own header comment: if
    // this list ever changes, it means a glossary entry was fixed (good --
    // update the count/comment) or a resolvable one broke (bad -- investigate).
    const knownUnresolvable = new Set([
      "vo2-max",
      "capillary-density",
      "mitochondria",
      "neuromuscular-power",
      "biomechanics-form",
      "double-threshold",
      "vdot",
    ]);
    const topicSlugs = new Set(CONCEPT_SEEDS.map((c) => c.topicSlug));
    const actuallyUnresolvable = new Set<string>();
    for (const topicSlug of topicSlugs) {
      const resolvedSlugs = new Set(conceptAnchorsForTopic(topicSlug).map((a) => a.slug));
      for (const concept of CONCEPT_SEEDS.filter((c) => c.topicSlug === topicSlug)) {
        if (!resolvedSlugs.has(concept.slug)) actuallyUnresolvable.add(concept.slug);
      }
    }
    expect(actuallyUnresolvable).toEqual(knownUnresolvable);
  });

  it("an unresolvable concept can never appear in the anchors passed to ReadingProgressBar for its own topic", () => {
    // "periodization" resolves to a #fragment (the-pyramid) so it isn't in
    // the unresolvable set above, but it's a real, separate case worth
    // guarding too: coaching-library's own anchors should never include
    // an id known to be stale in the current page content. This can't be
    // checked generically (would require rendering the real page), so this
    // just asserts the two structurally-unresolvable coaching-library
    // concepts are absent, which is the part concept-anchors.ts can
    // actually guarantee.
    const anchors = conceptAnchorsForTopic("coaching-library");
    expect(anchors.some((a) => a.slug === "double-threshold")).toBe(false);
    expect(anchors.some((a) => a.slug === "vdot")).toBe(false);
  });

  // Phase 3.1 audit: conceptAnchorsForTopic can only ever check "does the
  // glossary href have a #fragment at all" -- it has no way to know
  // whether that fragment corresponds to a heading that actually exists on
  // the page today. That's exactly how "periodization" went stale
  // silently (the essay section it pointed at was replaced by
  // coaching-library-home.tsx's directory/table/genome layout, with no
  // heading of that text anywhere in the new content). The two tests below
  // close that blind spot for the two content models this taxonomy spans,
  // so a *future* heading rename can't do the same thing unnoticed.

  it("every resolvable concept's anchor matches a real heading in its topic's sections.ts content array", () => {
    // Scoped to topics whose content actually lives in sections.ts's
    // ContentBlock model (coaching-library is the one exception among
    // topics-with-concepts -- it's a directory component, not
    // sections.ts content, and is covered by the source-text check below
    // instead).
    const topicsWithConcepts = new Set(CONCEPT_SEEDS.map((c) => c.topicSlug));
    let checked = 0;
    for (const topicSlug of topicsWithConcepts) {
      if (topicSlug === "coaching-library") continue;
      const section = sectionMap.get(topicSlug);
      if (!section?.content) continue;

      const realHeadingIds = new Set(
        section.content.filter((block) => block.type === "heading").map((block) => headingId(block.text)),
      );

      for (const anchor of conceptAnchorsForTopic(topicSlug)) {
        checked++;
        expect(realHeadingIds.has(anchor.anchorId)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0); // sanity: the loop actually exercised real anchors
  });

  it("coaching-library-home.tsx's actual source has no heading matching periodization's stale anchor (documents, doesn't silently drift)", () => {
    // A direct source-text check rather than a sections.ts cross-reference,
    // since coaching-library-home.tsx isn't ContentBlock-driven. If this
    // ever starts failing because a real "the-pyramid" heading was added,
    // that's good news -- update concept-anchors.ts's header comment and
    // this test together, the anchor is fixed for real at that point.
    const path = fileURLToPath(
      new URL("../../../src/components/coaches/coaching-library-home.tsx", import.meta.url),
    );
    const source = readFileSync(path, "utf8");
    expect(source).not.toContain("the-pyramid");
  });

  it("training-philosophy's real h3 headings carry the exact id={headingId(...)} its two Phase 4 concepts anchor to", () => {
    // training-philosophy-page.tsx is a bespoke component, not sections.ts
    // content, so it's excluded from the heading-cross-reference test above
    // -- this is its own direct source-text check, mirroring the
    // coaching-library one above but asserting presence, not absence. Two
    // things verified together: the exact heading text this page renders
    // still exists (so a future copy edit can't silently orphan the
    // concept), and headingId() of that exact text really does produce the
    // anchorId conceptAnchorsForTopic resolved to (so the two can never
    // silently drift apart).
    const path = fileURLToPath(
      new URL("../../../src/components/training-philosophy-page.tsx", import.meta.url),
    );
    const source = readFileSync(path, "utf8");
    const headingTextByConceptSlug: Record<string, string> = {
      individualization: "Individualization matters",
      "consistency-beats-perfection": "Consistency beats perfection",
    };

    const anchors = conceptAnchorsForTopic("training-philosophy");
    expect(anchors.length).toBe(2);
    for (const anchor of anchors) {
      const headingText = headingTextByConceptSlug[anchor.slug];
      expect(headingText).toBeDefined();
      expect(source).toContain(`id={headingId("${headingText}")}`);
      expect(headingId(headingText)).toBe(anchor.anchorId);
    }
  });
});
