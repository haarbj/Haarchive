// Turns the site's "see <Heading> in <Section>" cross-reference
// convention -- used everywhere throughout sections.ts, in paragraphs,
// lists, and callouts alike -- into a real link to that heading's
// anchor. Previously these were hand-typed as plain prose with nothing
// behind them: a reader could see "see Carb Loading Before a Long Race in
// Nutrition & Fueling" but had no way to actually get there.
//
// Built from the same section/heading data the pages themselves render
// from (see article-layout.tsx's headingId usage), so a phrase only ever
// links if the heading or section it names actually exists -- this
// can't produce a broken anchor the way a hand-typed href could.

import type { ReactNode } from "react";
import Link from "next/link";

import { headingId } from "@/lib/heading-id";
import { sections } from "@/lib/sections";
import { textLinkClass } from "@/components/ui/text-link";

type ReferenceTarget = { phrase: string; href: string; sectionSlug: string };

function buildTargetsBySectionTitle(): Map<string, ReferenceTarget[]> {
  const bySectionTitle = new Map<string, ReferenceTarget[]>();
  for (const section of sections) {
    const targets: ReferenceTarget[] = [
      { phrase: section.title, href: `/${section.slug}`, sectionSlug: section.slug },
    ];
    for (const block of section.content ?? []) {
      if (block.type === "heading") {
        targets.push({
          phrase: block.text,
          href: `/${section.slug}#${headingId(block.text)}`,
          sectionSlug: section.slug,
        });
      }
    }
    // Longest phrase first so a specific heading match wins over a
    // shorter one it happens to contain (same reasoning as linkify.tsx's
    // glossary aliasEntries sort).
    targets.sort((a, b) => b.phrase.length - a.phrase.length);
    bySectionTitle.set(section.title, targets);
  }
  return bySectionTitle;
}

const targetsBySectionTitle = buildTargetsBySectionTitle();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One regex per referenced section, alternating that section's own
// referenceable phrases (its title, plus every heading inside it) ahead
// of " in <the >Section Title" -- e.g. matches both "...in Nutrition &
// Fueling" and "...in the Research Library", since real usage varies.
const sectionPatterns: { regex: RegExp; targets: ReferenceTarget[] }[] = Array.from(
  targetsBySectionTitle.entries(),
).map(([sectionTitle, targets]) => ({
  targets,
  regex: new RegExp(
    `(${targets.map((t) => escapeRegExp(t.phrase)).join("|")}) in (?:the )?${escapeRegExp(sectionTitle)}`,
    "g",
  ),
}));

export type SectionReferenceMatch = { start: number; end: number; phrase: string; href: string };

/**
 * Finds every cross-reference in `text`, matching only a phrase that's
 * genuinely a heading or section title (not any arbitrary text followed
 * by "in <something>") and never linking a page back to itself. Pure and
 * DOM-free on purpose, so the matching logic can be tested without
 * rendering anything.
 */
export function findSectionReferences(text: string, currentSlug: string): SectionReferenceMatch[] {
  const rawMatches: SectionReferenceMatch[] = [];

  for (const { regex, targets } of sectionPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text))) {
      const phrase = match[1];
      const target = targets.find((t) => t.phrase === phrase);
      if (target && target.sectionSlug !== currentSlug) {
        rawMatches.push({ start: match.index, end: match.index + phrase.length, phrase, href: target.href });
      }
    }
  }

  rawMatches.sort((a, b) => a.start - b.start);

  // Drop anything overlapping a match already accepted (earliest start wins).
  const accepted: SectionReferenceMatch[] = [];
  let cursor = 0;
  for (const m of rawMatches) {
    if (m.start < cursor) continue;
    accepted.push(m);
    cursor = m.end;
  }
  return accepted;
}

/** Renders `text` with every cross-reference turned into a real link -- the trailing "in <Section>" stays plain text. */
export function linkifySectionReferences(text: string, currentSlug: string): ReactNode[] {
  const matches = findSectionReferences(text, currentSlug);
  if (matches.length === 0) return [text];

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  matches.forEach((m, i) => {
    nodes.push(text.slice(lastIndex, m.start));
    nodes.push(
      <Link
        key={`section-ref-${i}`}
        href={m.href}
        className={textLinkClass}
      >
        {m.phrase}
      </Link>,
    );
    lastIndex = m.end;
  });
  nodes.push(text.slice(lastIndex));
  return nodes;
}
