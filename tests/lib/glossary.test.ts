import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { glossaryTerms } from "@/lib/glossary";
import { sections } from "@/lib/sections";
import { headingId } from "@/lib/heading-id";
import { linkifyText } from "@/lib/linkify";

// Some glossary anchors point at a page rendered by its own bespoke
// ToolComponent (see sectionTools in [slug]/page.tsx) rather than a
// sections.ts `content` array -- those pages have no heading data in
// sections.ts to check an anchor against. Their real anchor ids, if any,
// only exist as headingId(...) calls inside the component's own source, so
// this reads that source directly at test-run time (never hardcoding the
// heading text here) using the site's own headingId() implementation --
// the same rule CLAUDE.md states for adding a glossary entry by hand.
function headingIdsFromComponentSource(relativePath: string): Set<string> {
  const source = readFileSync(join(process.cwd(), relativePath), "utf8");
  const ids = new Set<string>();
  for (const match of source.matchAll(/headingId\(\s*"([^"]+)"\s*\)/g)) {
    ids.add(headingId(match[1]));
  }
  return ids;
}

const BESPOKE_COMPONENT_HEADING_IDS: Record<string, Set<string>> = {
  "training-philosophy": headingIdsFromComponentSource("src/components/training-philosophy-page.tsx"),
  "coaching-library": headingIdsFromComponentSource("src/components/coaches/coaching-library-home.tsx"),
};

function sectionHeadingIds(slug: string): Set<string> | undefined {
  const section = sections.find((s) => s.slug === slug);
  if (!section) return undefined;
  const ids = new Set<string>();
  for (const block of section.content ?? []) {
    if (block.type === "heading") ids.add(headingId(block.text));
  }
  return ids;
}

// The one real source of truth this whole test is built on: a page either
// has real, checkable heading ids (sections.ts content, or a bespoke
// component's own headingId() calls), or it doesn't. Normal route URLs
// with no "#" in their href never reach this function at all (see
// `anchoredTerms` below).
function realHeadingIdsFor(slug: string): Set<string> | undefined {
  if (slug in BESPOKE_COMPONENT_HEADING_IDS) return BESPOKE_COMPONENT_HEADING_IDS[slug];
  return sectionHeadingIds(slug);
}

const anchoredTerms = glossaryTerms.filter((term) => term.href.includes("#"));

// periodization points at /coaching-library, a bespoke page with zero real
// headingId() calls in its own source (see coaching-library-home.tsx) --
// any "#" anchor pointing there is unconditionally broken. Fixing it
// requires deciding which coach page, if any, the concept should actually
// point to -- a real editorial call that Phase 3 explicitly declined to
// make (no single coach's periodization model is the unambiguous answer;
// see the Phase 3 proposal's §H). Tracked here via it.fails rather than
// silently excluded: this test only passes *because* the anchor is still
// broken, and it.fails itself fails the suite the moment that stops being
// true -- so a future "fix" that's still wrong, or a fix nobody remembered
// to reflect here, both surface loudly instead of being hidden.
//
// eighty-twenty was the same class of bug (also pointed at
// /coaching-library) but was resolved in Phase 3: it was a synonym for the
// "polarized-training" term above, which already had a real, working
// destination -- see that entry's own comment in glossary.ts.
const KNOWN_BROKEN_ANCHOR_IDS = new Set(["periodization"]);

describe("glossary anchors resolve to a real heading", () => {
  const validatable = anchoredTerms.filter((term) => !KNOWN_BROKEN_ANCHOR_IDS.has(term.id));

  it.each(validatable.map((term) => [term.id, term.href] as const))("%s -> %s", (id, href) => {
    const [path, anchor] = href.split("#");
    const slug = path.replace(/^\//, "");
    const ids = realHeadingIdsFor(slug);
    expect(
      ids,
      `"${id}" points at "${slug}", which has no known heading ids -- is it sections.ts-backed, ` +
        `or does it need an entry in BESPOKE_COMPONENT_HEADING_IDS above?`,
    ).toBeDefined();
    expect(ids!.has(anchor), `"${id}" (${href}) does not match any real heading id on "${slug}"`).toBe(true);
  });

  for (const term of anchoredTerms.filter((t) => KNOWN_BROKEN_ANCHOR_IDS.has(t.id))) {
    it.fails(`${term.id} -> ${term.href} is a known, tracked broken anchor pending an editorial decision`, () => {
      const [path, anchor] = term.href.split("#");
      const ids = realHeadingIdsFor(path.replace(/^\//, ""));
      expect(ids?.has(anchor)).toBe(true);
    });
  }
});

// Regression coverage for the specific Phase 2C finding: two independently
// reasonable-looking glossary entries (a generic concept term and a named
// coach/method term) resolved to the same coaching-library page, and
// nothing stopped both firing in the same paragraph. Phase 2D consolidated
// each pair into one term with multiple aliases; these tests exercise the
// real linkifyText() behavior (not just glossary.ts's raw structure) to
// confirm both the individual phrases and the combined-paragraph case.
function hrefsIn(nodes: ReturnType<typeof linkifyText>): string[] {
  const hrefs: string[] = [];
  for (const node of nodes) {
    if (isValidElement(node)) {
      const href = (node.props as { href?: unknown }).href;
      if (typeof href === "string") hrefs.push(href);
    }
  }
  return hrefs;
}

describe("Vigil / altitude-training consolidation", () => {
  it("still links the generic 'altitude training' phrase to the Vigil coach page", () => {
    const hrefs = hrefsIn(linkifyText("Altitude training compounds well with a threshold-heavy program.", "workout-library", new Set()));
    expect(hrefs).toEqual(["/coaching-library/vigil"]);
  });

  it("still links the named Joe Vigil phrase to the same Vigil coach page", () => {
    const hrefs = hrefsIn(
      linkifyText(
        "See Joe Vigil: Altitude, Biomechanics, and the Whole Athlete in Coaching Library for the adaptation window.",
        "workout-library",
        new Set(),
      ),
    );
    expect(hrefs).toEqual(["/coaching-library/vigil"]);
  });

  it("emits exactly one Vigil link, not two, when both phrases appear in the same paragraph", () => {
    const text =
      "Altitude training compounds well with a threshold-heavy program. See Joe Vigil: Altitude, Biomechanics, and the Whole Athlete in Coaching Library for the standard adaptation window.";
    const hrefs = hrefsIn(linkifyText(text, "workout-library", new Set()));
    expect(hrefs).toEqual(["/coaching-library/vigil"]);
  });
});

describe("Norwegian System / double-threshold consolidation", () => {
  it("still links the generic 'double threshold' phrase to the Norwegian System coach page", () => {
    const hrefs = hrefsIn(linkifyText("A double threshold day pairs two controlled interval sessions.", "workout-library", new Set()));
    expect(hrefs).toEqual(["/coaching-library/norwegian-system"]);
  });

  it("still links the named 'Norwegian Threshold Training' phrase to the same coach page", () => {
    const hrefs = hrefsIn(
      linkifyText("See Norwegian Threshold Training in Coaching Library for where the format comes from.", "workout-library", new Set()),
    );
    expect(hrefs).toEqual(["/coaching-library/norwegian-system"]);
  });

  it("emits exactly one Norwegian System link, not two, when both phrases appear in the same paragraph", () => {
    const text =
      "A double threshold day pairs two controlled interval sessions, and Norwegian Threshold Training in Coaching Library is where the format comes from.";
    const hrefs = hrefsIn(linkifyText(text, "workout-library", new Set()));
    expect(hrefs).toEqual(["/coaching-library/norwegian-system"]);
  });
});

describe("polarized-training / eighty-twenty consolidation (Phase 3)", () => {
  it("still links the 'polarized training' phrase to the Research Library heading", () => {
    const hrefs = hrefsIn(linkifyText("Polarized training gets most of the attention in endurance coaching.", "the-aerobic-base", new Set()));
    expect(hrefs).toEqual(["/research-library#polarized-training-what-elite-endurance-athletes-actually-do"]);
  });

  it("links '80/20 Rule' through the same term", () => {
    const hrefs = hrefsIn(linkifyText("Most coaches default to some version of the 80/20 Rule.", "the-aerobic-base", new Set()));
    expect(hrefs).toEqual(["/research-library#polarized-training-what-elite-endurance-athletes-actually-do"]);
  });

  it("links '80/20 rule' (lowercase) through the same term", () => {
    const hrefs = hrefsIn(linkifyText("Most coaches default to some version of the 80/20 rule.", "the-aerobic-base", new Set()));
    expect(hrefs).toEqual(["/research-library#polarized-training-what-elite-endurance-athletes-actually-do"]);
  });

  it("emits exactly one link, not two, when both 'polarized training' and '80/20' appear in the same paragraph", () => {
    const text = "Polarized training and the 80/20 Rule describe the same underlying split, just at different levels of precision.";
    const hrefs = hrefsIn(linkifyText(text, "the-aerobic-base", new Set()));
    expect(hrefs).toEqual(["/research-library#polarized-training-what-elite-endurance-athletes-actually-do"]);
  });

  it("no longer has a standalone eighty-twenty term", () => {
    expect(glossaryTerms.find((t) => t.id === "eighty-twenty")).toBeUndefined();
  });
});

describe("super-compensation anchor repair", () => {
  it("points at the real heading that explains supercompensation on The Aerobic Base", () => {
    const term = glossaryTerms.find((t) => t.id === "super-compensation");
    expect(term?.href).toBe("/the-aerobic-base#the-adaptation-curve");
    expect(realHeadingIdsFor("the-aerobic-base")?.has("the-adaptation-curve")).toBe(true);
  });
});

// Phase 2E: bridges the one genuine narrative-prose mention of the
// Ingebrigtsen family (workout-library's "the Norwegian system that
// produced the Ingebrigtsens") to Jakob Ingebrigtsen's real Athlete
// Library page.
describe("Ingebrigtsen Athlete Library bridge (Phase 2E)", () => {
  it("links the plural family mention to Jakob Ingebrigtsen's athlete page", () => {
    const hrefs = hrefsIn(
      linkifyText(
        "developed over three decades inside the Norwegian system that produced the Ingebrigtsens and the Blummenfelt/Iden triathlon program",
        "workout-library",
        new Set(),
      ),
    );
    expect(hrefs).toEqual(["/athlete-library/jakob-ingebrigtsen"]);
  });
});
