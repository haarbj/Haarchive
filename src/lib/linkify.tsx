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

// ---- inline markup: explicit links, bold, italic, underline ----
//
// A tiny hand-rolled convention, not a markdown parser -- deliberately
// only these four marks. Each uses a delimiter no other mark uses (`**`,
// `_`, `++`) so a single first-match-per-pattern scan can never confuse
// one for another, unlike real markdown's `*`/`**` overlap. Non-global
// regexes are used throughout so a fresh `.exec` always reports the
// *first* occurrence regardless of any previous call -- required for this
// to recurse safely (see parseInline below).
// Exported so src/lib/inline-marks.ts (the editor's DOM-free AST parser)
// can share the exact same match rules instead of maintaining its own --
// the editor and the published-page renderer must never disagree about
// what counts as a mark.
export const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;
export const BOLD_RE = /\*\*([^*]+)\*\*/;
export const UNDERLINE_RE = /\+\+([^+]+)\+\+/;
export const ITALIC_RE = /_([^_]+)_/;

const LINK_CLASSNAME =
  "underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70";

type InlineMatch = {
  start: number;
  end: number;
  render: (key: number, currentSlug: string, linkedTermIds: Set<string>) => ReactNode;
};

function findInlineMatch(text: string): InlineMatch | null {
  const candidates: InlineMatch[] = [];

  const link = LINK_RE.exec(text);
  if (link) {
    candidates.push({
      start: link.index,
      end: link.index + link[0].length,
      render: (key, currentSlug, linkedTermIds) => (
        <Link key={`inline-${key}`} href={link[2]} className={LINK_CLASSNAME}>
          {parseInline(link[1], currentSlug, linkedTermIds)}
        </Link>
      ),
    });
  }

  const bold = BOLD_RE.exec(text);
  if (bold) {
    candidates.push({
      start: bold.index,
      end: bold.index + bold[0].length,
      render: (key, currentSlug, linkedTermIds) => (
        <strong key={`inline-${key}`}>{parseInline(bold[1], currentSlug, linkedTermIds)}</strong>
      ),
    });
  }

  const underline = UNDERLINE_RE.exec(text);
  if (underline) {
    candidates.push({
      start: underline.index,
      end: underline.index + underline[0].length,
      // Dotted, not solid -- every link on this site is already a solid
      // underline (see LINK_CLASSNAME above), so a plain <u> here would
      // read as a link that goes nowhere.
      render: (key, currentSlug, linkedTermIds) => (
        <u key={`inline-${key}`} className="underline decoration-dotted underline-offset-2">
          {parseInline(underline[1], currentSlug, linkedTermIds)}
        </u>
      ),
    });
  }

  const italic = ITALIC_RE.exec(text);
  if (italic) {
    candidates.push({
      start: italic.index,
      end: italic.index + italic[0].length,
      render: (key, currentSlug, linkedTermIds) => (
        <em key={`inline-${key}`}>{parseInline(italic[1], currentSlug, linkedTermIds)}</em>
      ),
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.start - b.start);
  return candidates[0];
}

/**
 * Full content-linking pass: explicit inline marks (links, bold, italic,
 * underline) first -- recursing into each match's own captured text so
 * marks can nest (e.g. a link inside bold) -- then, on whatever plain
 * text remains once every mark is consumed, cross-references ("see X in
 * Y") and finally glossary terms. Applied to every paragraph, list item,
 * and callout an article renders, so all these conventions work no
 * matter which block type they appear in.
 */
export function linkifyContent(
  text: string,
  currentSlug: string,
  linkedTermIds: Set<string>,
): ReactNode[] {
  return parseInline(text, currentSlug, linkedTermIds);
}

let inlineKeySeq = 0;

function parseInline(text: string, currentSlug: string, linkedTermIds: Set<string>): ReactNode[] {
  const match = findInlineMatch(text);
  if (!match) {
    return linkifySectionReferences(text, currentSlug).flatMap((node) =>
      typeof node === "string" ? linkifyText(node, currentSlug, linkedTermIds) : [node],
    );
  }

  const before = text.slice(0, match.start);
  const after = text.slice(match.end);
  return [
    ...parseInline(before, currentSlug, linkedTermIds),
    match.render(inlineKeySeq++, currentSlug, linkedTermIds),
    ...parseInline(after, currentSlug, linkedTermIds),
  ];
}
