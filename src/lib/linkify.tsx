import type { ReactNode } from "react";
import Link from "next/link";

import { glossaryTerms, type GlossaryTerm } from "@/lib/glossary";
import { linkifySectionReferences } from "@/lib/section-linkify";

type AliasEntry = { alias: string; term: GlossaryTerm };

// Longest alias first so a more specific phrase (e.g. "glycogen depletion")
// is preferred over a shorter one that would otherwise match inside it
// (e.g. "glycogen").
const aliasEntries: AliasEntry[] = glossaryTerms
  .flatMap((term) => term.aliases.map((alias) => ({ alias, term })))
  .sort((a, b) => b.alias.length - a.alias.length);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const pattern = new RegExp(
  aliasEntries.map((entry) => escapeRegExp(entry.alias)).join("|"),
  "gi",
);

// Unicode-safe stand-in for \b: reject a match only when it's glued to an
// ASCII letter/digit on either side, so aliases containing non-ASCII
// characters (e.g. "VO₂max") still match correctly at their edges.
function isWordChar(char: string | undefined): boolean {
  return !!char && /[a-zA-Z0-9]/.test(char);
}

function findTerm(matchedText: string): GlossaryTerm | undefined {
  const lower = matchedText.toLowerCase();
  return aliasEntries.find((entry) => entry.alias.toLowerCase() === lower)?.term;
}

// Auto-links the first occurrence of each glossary term found in `text`.
// `linkedTermIds` is a Set the caller creates fresh per page render and
// threads through every block on that page, so a term only gets linked
// once across the whole article rather than every time it's mentioned.
// Never links a term back to the page it's already on.
export function linkifyText(
  text: string,
  currentSlug: string,
  linkedTermIds: Set<string>,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  pattern.lastIndex = 0;

  while ((match = pattern.exec(text))) {
    const matchedText = match[0];
    const start = match.index;
    const end = start + matchedText.length;

    if (isWordChar(text[start - 1]) || isWordChar(text[end])) {
      continue;
    }

    const term = findTerm(matchedText);
    if (!term) continue;

    const targetSlug = term.href.split("#")[0].replace(/^\//, "");
    if (targetSlug === currentSlug || linkedTermIds.has(term.id)) {
      continue;
    }

    nodes.push(text.slice(lastIndex, start));
    nodes.push(
      <Link
        key={`glossary-${term.id}-${key++}`}
        href={term.href}
        className="underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70"
      >
        {matchedText}
      </Link>,
    );
    linkedTermIds.add(term.id);
    lastIndex = end;
  }

  nodes.push(text.slice(lastIndex));
  return nodes;
}

const explicitLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

// Escape hatch for the cases the two automatic conventions below can't
// reach: linking a bare section by name mid-sentence (the "see X in Y"
// convention only ever matches a heading followed by its own owning
// section, never a section referencing itself), or linking a phrase that
// isn't a real heading or glossary term at all. Runs first and consumes
// whatever it matches, so the remaining automatic passes only ever see
// plain text, never look inside an already-authored link.
function splitExplicitLinks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  explicitLinkPattern.lastIndex = 0;

  while ((match = explicitLinkPattern.exec(text))) {
    nodes.push(text.slice(lastIndex, match.index));
    nodes.push(
      <Link
        key={`explicit-link-${key++}`}
        href={match[2]}
        className="underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70"
      >
        {match[1]}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }
  nodes.push(text.slice(lastIndex));
  return nodes;
}

/**
 * Full content-linking pass: explicit [text](href) links first, then
 * cross-references ("see X in Y"), then glossary terms within whatever
 * plain text remains -- applied to every paragraph, list item, and
 * callout an article renders, so all three conventions link correctly no
 * matter which block type they appear in.
 */
export function linkifyContent(
  text: string,
  currentSlug: string,
  linkedTermIds: Set<string>,
): ReactNode[] {
  return splitExplicitLinks(text).flatMap((segment) => {
    if (typeof segment !== "string") return [segment];
    return linkifySectionReferences(segment, currentSlug).flatMap((node) =>
      typeof node === "string" ? linkifyText(node, currentSlug, linkedTermIds) : [node],
    );
  });
}
