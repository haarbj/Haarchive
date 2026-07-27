import { parseMarksToTree, type MarkNode } from "@/lib/inline-marks";

// Same link styling linkify.tsx uses on the published page, so a link
// looks like a link while editing too (just not clickable -- see the
// `data-href` choice below).
const LINK_CLASSNAME =
  "underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70";
// Dotted, not solid, matching linkify.tsx's <u> -- every real link here is
// already a solid underline, so a plain <u> would look like a dead link.
const UNDERLINE_CLASSNAME = "underline decoration-dotted underline-offset-2";

function buildNode(node: MarkNode): Node {
  if (node.kind === "text") return document.createTextNode(node.value);

  const tag = node.kind === "bold" ? "strong" : node.kind === "italic" ? "em" : node.kind === "underline" ? "u" : "a";
  const el = document.createElement(tag);
  if (node.kind === "underline") el.className = UNDERLINE_CLASSNAME;
  if (node.kind === "link") {
    el.className = LINK_CLASSNAME;
    // Deliberately `data-href`, never a real `href` -- this is an editing
    // surface, not the live page, and a real anchor risks the browser
    // trying to navigate on click/keyboard-activate inside contenteditable.
    el.setAttribute("data-href", node.href);
  }
  node.children.forEach((child) => el.appendChild(buildNode(child)));
  return el;
}

/** String -> DOM. Only ever call this for an externally-driven change (mount, or a reset) -- never after the container's own input, or the caret jumps to the start. */
export function renderMarkupIntoElement(container: HTMLElement, markup: string): void {
  container.replaceChildren(...parseMarksToTree(markup).map(buildNode));
}

// Chrome/Safari sometimes substitute a non-breaking space for a regular
// one at certain contenteditable positions (line-end, next to a tag
// boundary). Left alone, that's an invisible-but-different byte silently
// saved into article text.
function normalizeSpaces(text: string): string {
  return text.replace(/ /g, " ");
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return normalizeSpaces((node as Text).data);
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(serializeNode).join("");
  switch (el.tagName) {
    case "STRONG":
    case "B":
      return `**${inner}**`;
    case "EM":
    case "I":
      return `_${inner}_`;
    case "U":
      return `++${inner}++`;
    case "A":
      return `[${inner}](${el.getAttribute("data-href") ?? ""})`;
    default:
      // Defensive fallback for anything unexpected the browser might insert
      // (e.g. a stray <div>/<br> from certain paste or newline handling) --
      // unwrap rather than lose the text inside it.
      return inner;
  }
}

// DOM -> string, back into the exact same bold/italic/underline/link
// marker syntax linkify.tsx parses on the published page.
export function serializeElementToMarkup(container: HTMLElement): string {
  return Array.from(container.childNodes).map(serializeNode).join("");
}

// One marker-length table, used identically by capture (DOM -> offset) and
// restore (offset -> DOM) below, so there is exactly one place that knows
// how long each mark's opening/closing syntax is.
function markerLength(el: HTMLElement, which: "open" | "close"): number {
  switch (el.tagName) {
    case "STRONG":
    case "B":
      return 2; // **
    case "EM":
    case "I":
      return 1; // _
    case "U":
      return 2; // ++
    case "A":
      // [ ... ] ( href )
      return which === "open" ? 1 : (el.getAttribute("data-href") ?? "").length + 3;
    default:
      return 0;
  }
}

type Positions = Map<Node, { innerStart: number; innerEnd: number }>;

function computeMarkupPositions(root: HTMLElement): Positions {
  const map: Positions = new Map();
  let pos = 0;

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = normalizeSpaces((node as Text).data).length;
      map.set(node, { innerStart: pos, innerEnd: pos + len });
      pos += len;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    pos += markerLength(el, "open");
    const innerStart = pos;
    Array.from(el.childNodes).forEach(walk);
    const innerEnd = pos;
    pos += markerLength(el, "close");
    map.set(node, { innerStart, innerEnd });
  }

  Array.from(root.childNodes).forEach(walk);
  map.set(root, { innerStart: 0, innerEnd: pos });
  return map;
}

function resolveBoundary(positions: Positions, node: Node, offset: number): number {
  if (node.nodeType === Node.TEXT_NODE) {
    const entry = positions.get(node);
    const len = (node as Text).data.length;
    return entry ? entry.innerStart + Math.max(0, Math.min(offset, len)) : 0;
  }
  if (offset <= 0) return positions.get(node)?.innerStart ?? 0;
  if (offset >= node.childNodes.length) return positions.get(node)?.innerEnd ?? 0;
  return resolveBoundary(positions, node.childNodes[offset], 0);
}

/** Current browser selection, expressed as offsets into the markup string (not the visible/rendered text) -- null if there's no selection inside `container`. */
export function captureSelectionOffsets(container: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const positions = computeMarkupPositions(container);
  const a = resolveBoundary(positions, range.startContainer, range.startOffset);
  const b = resolveBoundary(positions, range.endContainer, range.endOffset);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** Places the browser selection at the given markup-string offsets, against whatever DOM currently lives in `container` (call this only right after rebuilding it from the same markup string). */
export function restoreSelectionOffsets(container: HTMLElement, start: number, end: number): void {
  const positions = computeMarkupPositions(container);
  const runs: { node: Text; start: number; end: number }[] = [];

  (function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const entry = positions.get(node);
      if (entry) runs.push({ node: node as Text, start: entry.innerStart, end: entry.innerEnd });
      return;
    }
    node.childNodes.forEach(walk);
  })(container);

  function toPoint(target: number): { node: Node; offset: number } {
    for (const run of runs) {
      if (target >= run.start && target <= run.end) return { node: run.node, offset: target - run.start };
    }
    return { node: container, offset: container.childNodes.length };
  }

  const startPoint = toPoint(start);
  const endPoint = toPoint(end);
  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
