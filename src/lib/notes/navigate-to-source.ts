import type { AnchorResolution } from "@/lib/notes/anchor";
import type { NoteAnchor } from "@/lib/notes/types";

const PULSE_CLASS = "note-source-pulse";
const PULSE_DURATION_MS = 1600;
const EXACT_HIGHLIGHT_CLASS = "note-exact-highlight";
const EXACT_HIGHLIGHT_DURATION_MS = 2000;

// A note's quote is only ever a click target when it genuinely resolved
// against the article's *current* content -- never for a general note (no
// selectedText/anchor to begin with) and never for one that came back
// unresolved (resolveAnchor already refuses to guess; this refuses to
// navigate anywhere on the strength of a guess either). The single
// predicate both note-card.tsx's render logic and its tests share, so
// "does this note support click-to-source" is defined in exactly one
// place.
export function isSourceNavigable(
  note: { selectedText: string | null; anchor: NoteAnchor | null },
  resolution: AnchorResolution | null,
): boolean {
  return !!note.selectedText && !!note.anchor && resolution?.status === "resolved";
}

// The article's own #article-content + data-block-index attributes (see
// content-blocks.tsx) are the only DOM contract this reaches for -- no new
// ids, no reconstructing or re-rendering the article's JSX, and nothing
// here ever mutates what ContentBlocks actually renders.
export function findSourceBlockElement(blockIndex: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`#article-content [data-block-index="${blockIndex}"]`);
}

// Not element.scrollIntoView({ block: "start" }): that would put the
// passage flush against the sticky site header, with no reading context
// above it. Lands the block roughly a quarter of the way down the
// viewport instead (never less than 96px -- the same scroll-mt-24 offset
// already used sitewide for heading-anchor jumps, see [slug]/page.tsx --
// so this stays consistent with that convention rather than inventing a
// second header-clearance number).
export function scrollToSourcePassage(element: HTMLElement, prefersReducedMotion: boolean): void {
  const rect = element.getBoundingClientRect();
  const desiredOffsetFromTop = Math.max(96, window.innerHeight * 0.25);
  const targetY = Math.max(0, window.scrollY + rect.top - desiredOffsetFromTop);
  window.scrollTo({ top: targetY, behavior: prefersReducedMotion ? "auto" : "smooth" });
}

// Imperative, not React state: this is a temporary, non-persistent flash
// on an already-rendered DOM node, not a change to what the article's own
// component tree renders -- see the class's own comment in globals.css for
// why a plain CSS animation (gated on prefers-reduced-motion there, not
// here) rather than a second JS-driven implementation for reduced motion.
// Removing then re-adding the class (with a forced reflow between) is what
// lets a second click on the same passage re-trigger the animation instead
// of silently no-op'ing because the class never actually changed.
export function pulseSourcePassage(element: HTMLElement): void {
  element.classList.remove(PULSE_CLASS);
  void element.offsetWidth; // force reflow so re-adding the class restarts the animation
  element.classList.add(PULSE_CLASS);
  setTimeout(() => element.classList.remove(PULSE_CLASS), PULSE_DURATION_MS);
}

// The single entry point note-card.tsx calls on click -- resolves nothing
// itself (the caller already has a resolved blockIndex from
// resolveAnchor), just finds the live element and does the scroll + pulse.
// Returns whether it actually found something to navigate to, so a caller
// could no-op gracefully if the DOM and the resolved content have somehow
// drifted (shouldn't happen in practice: the same `content` prop drives
// both the resolution and the render).
export function navigateToSourcePassage(blockIndex: number): boolean {
  const element = findSourceBlockElement(blockIndex);
  if (!element) return false;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scrollToSourcePassage(element, prefersReducedMotion);
  pulseSourcePassage(element);
  return true;
}

export type TextOccurrence = { start: number; end: number };

function findAllOccurrences(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const indices: number[] = [];
  let from = 0;
  while (true) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    indices.push(index);
    from = index + 1;
  }
  return indices;
}

function commonSuffixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// How well the text immediately around a candidate occurrence matches the
// anchor's captured prefix/suffix -- used only to disambiguate when the
// same selected_text appears more than once in a block's real rendered
// text. Not an exact-substring requirement: a block's real DOM textContent
// can diverge slightly from blockPlainText()'s own join conventions (list/
// callout blocks insert " " between items/sub-items that the real DOM
// doesn't render as a literal space) -- a longest-common-suffix/prefix
// overlap is enough to meaningfully separate "this is clearly the one"
// from "this isn't," without demanding a byte-exact context match.
function contextScore(haystack: string, start: number, end: number, prefix: string, suffix: string): number {
  const before = haystack.slice(Math.max(0, start - prefix.length), start);
  const after = haystack.slice(end, end + suffix.length);
  return commonSuffixLength(before, prefix) + commonPrefixLength(after, suffix);
}

// Locates selectedText inside a block's own real rendered text (haystack),
// reusing the same anchor data resolveAnchor already validated -- never a
// new field, never character offsets stored anywhere, never a guess. Three
// tries, in order:
//   1. The literal prefix+selectedText+suffix substring, exactly once. This
//      is the common case for paragraph/heading/quote blocks, where a
//      block's real textContent is identical to blockPlainText()'s output.
//   2. selectedText alone, exactly once.
//   3. selectedText alone, appearing more than once -- disambiguated by
//      contextScore, but only if one candidate is an unambiguous best match
//      (a tie or near-tie is a coin flip, not a resolution -- see
//      resolveAnchor's own "accuracy over forcing a highlight" precedent).
// Returns null (never an arbitrary occurrence) if none of these land.
export function findExactOccurrence(
  haystack: string,
  selectedText: string,
  prefix: string,
  suffix: string,
): TextOccurrence | null {
  if (!selectedText) return null;

  const bracketed = prefix + selectedText + suffix;
  const bracketedMatches = findAllOccurrences(haystack, bracketed);
  if (bracketedMatches.length === 1) {
    const start = bracketedMatches[0] + prefix.length;
    return { start, end: start + selectedText.length };
  }

  const bareMatches = findAllOccurrences(haystack, selectedText);
  if (bareMatches.length === 0) return null;
  if (bareMatches.length === 1) {
    return { start: bareMatches[0], end: bareMatches[0] + selectedText.length };
  }

  const scored = bareMatches
    .map((start) => ({
      start,
      score: contextScore(haystack, start, start + selectedText.length, prefix, suffix),
    }))
    .sort((a, b) => b.score - a.score);
  const [best, runnerUp] = scored;
  if (best.score > 0 && best.score > runnerUp.score) {
    return { start: best.start, end: best.start + selectedText.length };
  }
  return null;
}

type TextNodeOffset = { node: Text; offset: number };

// Walks only real text nodes (SHOW_TEXT skips linkifyContent()'s <a>
// elements as containers, but still visits the text *inside* them) to map
// a plain character index -- as if the block's entire subtree were one
// concatenated string, matching how `root.textContent` itself is built --
// onto the specific Text node + in-node offset a Range needs. This is the
// step that makes exact highlighting work across a paragraph's mixed text/
// <a> children without ever touching the article's own rendered markup.
function resolveTextNodeOffset(root: HTMLElement, charIndex: number): TextNodeOffset | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (charIndex <= consumed + length) {
      return { node, offset: charIndex - consumed };
    }
    consumed += length;
    node = walker.nextNode() as Text | null;
  }
  return null;
}

function buildRangeForOccurrence(root: HTMLElement, occurrence: TextOccurrence): Range | null {
  const startInfo = resolveTextNodeOffset(root, occurrence.start);
  const endInfo = resolveTextNodeOffset(root, occurrence.end);
  if (!startInfo || !endInfo) return null;
  const range = document.createRange();
  range.setStart(startInfo.node, startInfo.offset);
  range.setEnd(endInfo.node, endInfo.offset);
  return range;
}

// Wraps the exact resolved range in a <mark> via safe, targeted DOM
// operations -- never element.innerHTML/dangerouslySetInnerHTML, never a
// rewrite of what ContentBlocks rendered. Returns a cleanup closure that
// unwraps the <mark> back out (restoring the exact prior DOM, including
// any <a> element that was fully inside the range -- surroundContents()
// moves nodes, it doesn't clone them, so that link is still the same
// element afterward, not a rebuilt one) or null if no exact highlight
// could be safely applied.
export function applyExactHighlight(
  blockElement: HTMLElement,
  selectedText: string,
  anchor: NoteAnchor,
): (() => void) | null {
  const haystack = blockElement.textContent ?? "";
  const occurrence = findExactOccurrence(haystack, selectedText, anchor.prefix, anchor.suffix);
  if (!occurrence) return null;

  const range = buildRangeForOccurrence(blockElement, occurrence);
  if (!range) return null;

  const mark = document.createElement("mark");
  mark.className = EXACT_HIGHLIGHT_CLASS;
  try {
    range.surroundContents(mark);
  } catch {
    // The range's boundaries partially cross a non-Text node -- e.g. the
    // selection starts mid-way through a linkifyContent()-generated <a>.
    // surroundContents() throws in that case rather than silently
    // splitting/cloning the element, and this deliberately doesn't fall
    // back to extractContents() (which *can* perform that split, but can
    // leave two adjacent cloned <a> elements where there was one -- a
    // structural change to the article's own DOM not worth the risk here,
    // given the caller's existing block-level pulse already satisfies
    // "accuracy over forcing a highlight" on its own).
    return null;
  }

  return () => {
    mark.replaceWith(...Array.from(mark.childNodes));
  };
}

// The exact-passage counterpart to pulseSourcePassage above -- same
// self-contained "apply, then clear itself after a fixed duration"
// contract, so note-card.tsx doesn't need to manage its own timer. Returns
// whether a highlight was actually applied (false for an ambiguous/
// not-found passage, or a general note with no anchor at all); the caller
// keeps running its existing block-level pulse regardless of this result,
// since that one never depends on exact text resolution succeeding.
export function highlightExactPassage(blockElement: HTMLElement, selectedText: string, anchor: NoteAnchor): boolean {
  const cleanup = applyExactHighlight(blockElement, selectedText, anchor);
  if (!cleanup) return false;
  setTimeout(cleanup, EXACT_HIGHLIGHT_DURATION_MS);
  return true;
}
