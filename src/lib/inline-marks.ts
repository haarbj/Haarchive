import { BOLD_RE, ITALIC_RE, LINK_RE, UNDERLINE_RE } from "@/lib/linkify";

// The editor's DOM-free view of the same four marks linkify.tsx renders on
// the published page -- deliberately stops there. It never runs the two
// auto-link passes (section cross-references, glossary terms), so the
// editor only ever live-renders formatting the contributor actually typed
// or applied, not something the site infers from their prose.
export type MarkNode =
  | { kind: "text"; value: string }
  | { kind: "bold" | "italic" | "underline"; children: MarkNode[] }
  | { kind: "link"; href: string; children: MarkNode[] };

type EarliestMatch = { start: number; end: number; node: MarkNode };

// Same shape as linkify.tsx's findInlineMatch: try all four patterns
// against the same text, take whichever starts earliest. Recursing into
// each match's own captured text is what lets marks nest (e.g. bold
// containing italic, or bold containing a link).
function findEarliestMark(text: string): EarliestMatch | null {
  const candidates: EarliestMatch[] = [];

  const link = LINK_RE.exec(text);
  if (link) {
    candidates.push({
      start: link.index,
      end: link.index + link[0].length,
      node: { kind: "link", href: link[2], children: parseMarksToTree(link[1]) },
    });
  }

  const bold = BOLD_RE.exec(text);
  if (bold) {
    candidates.push({
      start: bold.index,
      end: bold.index + bold[0].length,
      node: { kind: "bold", children: parseMarksToTree(bold[1]) },
    });
  }

  const underline = UNDERLINE_RE.exec(text);
  if (underline) {
    candidates.push({
      start: underline.index,
      end: underline.index + underline[0].length,
      node: { kind: "underline", children: parseMarksToTree(underline[1]) },
    });
  }

  const italic = ITALIC_RE.exec(text);
  if (italic) {
    candidates.push({
      start: italic.index,
      end: italic.index + italic[0].length,
      node: { kind: "italic", children: parseMarksToTree(italic[1]) },
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.start - b.start);
  return candidates[0];
}

export function parseMarksToTree(text: string): MarkNode[] {
  const match = findEarliestMark(text);
  if (!match) return text === "" ? [] : [{ kind: "text", value: text }];
  return [
    ...parseMarksToTree(text.slice(0, match.start)),
    match.node,
    ...parseMarksToTree(text.slice(match.end)),
  ];
}
