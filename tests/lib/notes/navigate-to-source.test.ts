// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAnchor } from "@/lib/notes/anchor";
import {
  applyExactHighlight,
  findExactOccurrence,
  findSourceBlockElement,
  highlightExactPassage,
  isSourceNavigable,
  navigateToSourcePassage,
  pulseSourcePassage,
  scrollToSourcePassage,
} from "@/lib/notes/navigate-to-source";
import type { ContentBlock } from "@/lib/sections";

const CONTENT: ContentBlock[] = [
  { type: "heading", text: "Aerobic Adaptations" },
  {
    type: "paragraph",
    text: "Endurance training produces adaptations to prolonged aerobic training, most notably an increase in mitochondrial density.",
  },
  { type: "paragraph", text: "A second, unrelated paragraph about pacing strategy on race day." },
];

function mountArticle(content: ContentBlock[]) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  container.id = "article-content";
  content.forEach((block, index) => {
    const el = document.createElement(block.type === "heading" ? "h2" : "p");
    el.setAttribute("data-block-index", String(index));
    el.textContent = ("text" in block ? block.text : "") ?? "";
    container.appendChild(el);
  });
  document.body.appendChild(container);
  return container;
}

function mockRect(element: HTMLElement, top: number) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    top,
    bottom: top + 40,
    left: 0,
    right: 100,
    width: 100,
    height: 40,
    x: 0,
    y: top,
    toJSON() {
      return this;
    },
  });
}

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  mockMatchMedia(false);
  window.scrollY = 0;
  window.innerHeight = 800;
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("isSourceNavigable", () => {
  it("is true for a note with a resolved anchor", () => {
    const note = { selectedText: "quote", anchor: { prefix: "", suffix: "", blockIndex: 1 } };
    expect(isSourceNavigable(note, { status: "resolved", blockIndex: 1 })).toBe(true);
  });

  it("is false for a general note (no selectedText/anchor at all)", () => {
    const note = { selectedText: null, anchor: null };
    expect(isSourceNavigable(note, null)).toBe(false);
  });

  it("is false when the anchor is unresolved", () => {
    const note = { selectedText: "quote", anchor: { prefix: "", suffix: "", blockIndex: 1 } };
    expect(isSourceNavigable(note, { status: "unresolved" })).toBe(false);
  });

  it("is false when there's no resolution at all yet", () => {
    const note = { selectedText: "quote", anchor: { prefix: "", suffix: "", blockIndex: 1 } };
    expect(isSourceNavigable(note, null)).toBe(false);
  });
});

describe("findSourceBlockElement", () => {
  it("finds the element matching the given block index inside #article-content", () => {
    mountArticle(CONTENT);
    const el = findSourceBlockElement(1);
    expect(el).not.toBeNull();
    expect(el?.getAttribute("data-block-index")).toBe("1");
  });

  it("returns null when no such block exists", () => {
    mountArticle(CONTENT);
    expect(findSourceBlockElement(99)).toBeNull();
  });
});

describe("scrollToSourcePassage", () => {
  it("scrolls to roughly a quarter of the viewport down, not flush to the top", () => {
    const container = mountArticle(CONTENT);
    const target = container.querySelector('[data-block-index="1"]') as HTMLElement;
    mockRect(target, 500); // 500px down the current viewport

    scrollToSourcePassage(target, false);

    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    const call = (window.scrollTo as unknown as { mock: { calls: [{ top: number; behavior: string }][] } }).mock
      .calls[0][0];
    // desiredOffset = max(96, 800 * 0.25) = 200; target = scrollY(0) + rect.top(500) - 200 = 300
    expect(call.top).toBe(300);
    expect(call.behavior).toBe("smooth");
  });

  it("never lands the passage under the sticky header, even very near the top", () => {
    const container = mountArticle(CONTENT);
    const target = container.querySelector('[data-block-index="1"]') as HTMLElement;
    mockRect(target, 50); // barely below the current viewport top

    scrollToSourcePassage(target, false);

    const call = (window.scrollTo as unknown as { mock: { calls: [{ top: number }][] } }).mock.calls[0][0];
    // Still clamped to >= 0, and the 96px minimum offset means this doesn't
    // just scroll backwards oddly for a passage already near the top.
    expect(call.top).toBeGreaterThanOrEqual(0);
  });

  it("uses instant scrolling when the caller says the user prefers reduced motion", () => {
    const container = mountArticle(CONTENT);
    const target = container.querySelector('[data-block-index="1"]') as HTMLElement;
    mockRect(target, 500);

    scrollToSourcePassage(target, true);

    const call = (window.scrollTo as unknown as { mock: { calls: [{ behavior: string }][] } }).mock.calls[0][0];
    expect(call.behavior).toBe("auto");
  });
});

describe("pulseSourcePassage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("applies the pulse class and removes it automatically after the duration", () => {
    const container = mountArticle(CONTENT);
    const target = container.querySelector('[data-block-index="1"]') as HTMLElement;

    pulseSourcePassage(target);
    expect(target.classList.contains("note-source-pulse")).toBe(true);

    vi.advanceTimersByTime(1599);
    expect(target.classList.contains("note-source-pulse")).toBe(true);

    vi.advanceTimersByTime(1);
    expect(target.classList.contains("note-source-pulse")).toBe(false);
  });

  it("re-triggers cleanly on a second pulse of the same element", () => {
    const container = mountArticle(CONTENT);
    const target = container.querySelector('[data-block-index="1"]') as HTMLElement;

    pulseSourcePassage(target);
    vi.advanceTimersByTime(1600);
    expect(target.classList.contains("note-source-pulse")).toBe(false);

    pulseSourcePassage(target);
    expect(target.classList.contains("note-source-pulse")).toBe(true);
    vi.advanceTimersByTime(1600);
    expect(target.classList.contains("note-source-pulse")).toBe(false);
  });
});

describe("navigateToSourcePassage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("scrolls to and pulses the correct block, and reports success", () => {
    const container = mountArticle(CONTENT);
    const target = container.querySelector('[data-block-index="1"]') as HTMLElement;
    mockRect(target, 400);

    const found = navigateToSourcePassage(1);

    expect(found).toBe(true);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(target.classList.contains("note-source-pulse")).toBe(true);
  });

  it("does nothing and reports failure when the block can't be found in the DOM", () => {
    mountArticle(CONTENT);
    const found = navigateToSourcePassage(99);
    expect(found).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});

describe("full pipeline: resolveAnchor -> navigateToSourcePassage after content is reordered", () => {
  it("navigates to the block's new position, never the stale stored blockIndex", () => {
    // The note was originally created against CONTENT[1] (blockIndex 1).
    const anchor = { prefix: "produces ", suffix: ", most notably an increase", blockIndex: 1 };
    const selectedText = "adaptations to prolonged aerobic training";

    // The article has since been reordered -- the same paragraph is now at index 2.
    const reordered: ContentBlock[] = [CONTENT[0], CONTENT[2], CONTENT[1]];
    const resolution = resolveAnchor(reordered, selectedText, anchor);
    expect(resolution).toEqual({ status: "resolved", blockIndex: 2 });

    const container = mountArticle(reordered);
    const staleTarget = container.querySelector('[data-block-index="1"]') as HTMLElement;
    const correctTarget = container.querySelector('[data-block-index="2"]') as HTMLElement;
    mockRect(staleTarget, 0);
    mockRect(correctTarget, 600);

    if (resolution.status !== "resolved") throw new Error("expected resolved");
    const found = navigateToSourcePassage(resolution.blockIndex);

    expect(found).toBe(true);
    expect(correctTarget.classList.contains("note-source-pulse")).toBe(true);
    expect(staleTarget.classList.contains("note-source-pulse")).toBe(false);
  });

  it("never navigates anywhere when the quote can no longer be resolved at all", () => {
    const anchor = { prefix: "produces ", suffix: ", most notably an increase", blockIndex: 1 };
    const selectedText = "adaptations to prolonged aerobic training";
    const edited: ContentBlock[] = [
      CONTENT[0],
      { type: "paragraph", text: "This paragraph was rewritten and no longer discusses that topic." },
      CONTENT[2],
    ];

    const resolution = resolveAnchor(edited, selectedText, anchor);
    expect(resolution).toEqual({ status: "unresolved" });

    // isSourceNavigable is what note-card.tsx actually gates the click
    // handler on -- confirm it correctly refuses here.
    expect(isSourceNavigable({ selectedText, anchor }, resolution)).toBe(false);
  });
});

describe("findExactOccurrence", () => {
  it("finds the single occurrence of the selected text", () => {
    const haystack = "Roughly 80% of training time should be easy running, most coaches agree.";
    const result = findExactOccurrence(haystack, "should be easy running", "training time ", ", most coaches");
    expect(result).toEqual({ start: haystack.indexOf("should be easy running"), end: haystack.indexOf("should be easy running") + "should be easy running".length });
  });

  it("returns null when the selected text isn't present at all", () => {
    const haystack = "This paragraph was rewritten entirely.";
    expect(findExactOccurrence(haystack, "no longer here", "prefix", "suffix")).toBeNull();
  });

  it("disambiguates a repeated phrase using prefix/suffix context", () => {
    const haystack = "The easy pace felt good. Later, the easy pace felt slow by comparison.";
    const secondStart = haystack.lastIndexOf("easy pace");
    const result = findExactOccurrence(haystack, "easy pace", "the ", " felt slow");
    expect(result).toEqual({ start: secondStart, end: secondStart + "easy pace".length });
  });

  it("refuses to guess when context can't disambiguate a repeated phrase (accuracy over forcing a highlight)", () => {
    const haystack = "The easy pace felt good today. The easy pace felt good yesterday too.";
    // Deliberately generic prefix/suffix that doesn't favor either
    // occurrence -- this should not silently pick the first (or any) match.
    const result = findExactOccurrence(haystack, "easy pace", "xyz", "xyz");
    expect(result).toBeNull();
  });

  it("prefers the literal prefix+selection+suffix bracketed match when it uniquely resolves", () => {
    const haystack = "one two three two one";
    // "two" appears twice; the bracketed prefix/suffix pins the second one.
    const result = findExactOccurrence(haystack, "two", "three ", " one");
    expect(result).toEqual({ start: haystack.lastIndexOf("two"), end: haystack.lastIndexOf("two") + 3 });
  });
});

describe("applyExactHighlight", () => {
  function mountParagraphWithLink(): HTMLElement {
    document.body.innerHTML = "";
    const p = document.createElement("p");
    p.setAttribute("data-block-index", "0");
    p.appendChild(document.createTextNode("Roughly 80% of training time should be "));
    const a = document.createElement("a");
    a.href = "/exercise-physiology";
    a.textContent = "easy";
    p.appendChild(a);
    p.appendChild(document.createTextNode(" running, most coaches agree."));
    document.body.appendChild(p);
    return p;
  }

  it("wraps the exact phrase in a <mark> and leaves everything else untouched", () => {
    const p = mountParagraphWithLink();
    const anchor = { prefix: "training time ", suffix: ", most coaches", blockIndex: 0 };
    const cleanup = applyExactHighlight(p, "should be easy running", anchor);

    expect(cleanup).not.toBeNull();
    const mark = p.querySelector("mark.note-exact-highlight");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("should be easy running");
    expect(p.textContent).toBe("Roughly 80% of training time should be easy running, most coaches agree.");
  });

  it("fully contains the <a> inside the highlight without cloning or splitting it", () => {
    const p = mountParagraphWithLink();
    const originalLink = p.querySelector("a");
    const anchor = { prefix: "training time ", suffix: ", most coaches", blockIndex: 0 };
    applyExactHighlight(p, "should be easy running", anchor);

    const links = p.querySelectorAll("a");
    expect(links.length).toBe(1);
    // The exact same node, not a rebuilt/cloned replacement -- surroundContents
    // moves nodes rather than copying them.
    expect(links[0]).toBe(originalLink);
    expect(links[0].getAttribute("href")).toBe("/exercise-physiology");
    expect(links[0].textContent).toBe("easy");
    expect(p.querySelector("mark")?.contains(links[0])).toBe(true);
  });

  it("cleanup unwraps the <mark> and restores the original structure, link intact", () => {
    const p = mountParagraphWithLink();
    const anchor = { prefix: "training time ", suffix: ", most coaches", blockIndex: 0 };
    const cleanup = applyExactHighlight(p, "should be easy running", anchor);

    cleanup?.();

    expect(p.querySelector("mark")).toBeNull();
    expect(p.querySelectorAll("a").length).toBe(1);
    expect(p.querySelector("a")?.getAttribute("href")).toBe("/exercise-physiology");
    expect(p.textContent).toBe("Roughly 80% of training time should be easy running, most coaches agree.");
  });

  it("does not highlight anything when the selection partially crosses into the middle of a link", () => {
    const p = mountParagraphWithLink();
    const originalLink = p.querySelector("a");
    // "be eas" starts in the plain text before the <a> and ends partway
    // through it -- surroundContents() must throw here rather than
    // split/clone the <a>, and this must degrade to no highlight.
    const anchor = { prefix: "should ", suffix: "y running", blockIndex: 0 };
    const cleanup = applyExactHighlight(p, "be eas", anchor);

    expect(cleanup).toBeNull();
    expect(p.querySelectorAll("a").length).toBe(1);
    expect(p.querySelector("a")).toBe(originalLink);
    expect(p.querySelector("mark")).toBeNull();
    expect(p.textContent).toBe("Roughly 80% of training time should be easy running, most coaches agree.");
  });

  it("returns null (no highlight) for an ambiguous or not-found passage, without throwing", () => {
    const p = mountParagraphWithLink();
    const anchor = { prefix: "nowhere ", suffix: " near this", blockIndex: 0 };
    const cleanup = applyExactHighlight(p, "this text was never selected here", anchor);
    expect(cleanup).toBeNull();
    expect(p.querySelector("mark")).toBeNull();
  });
});

describe("highlightExactPassage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("applies the highlight and clears it automatically after its own duration", () => {
    document.body.innerHTML = "";
    const p = document.createElement("p");
    p.setAttribute("data-block-index", "0");
    p.textContent = "A short paragraph about aerobic base building.";
    document.body.appendChild(p);

    const anchor = { prefix: "A short paragraph about ", suffix: " building.", blockIndex: 0 };
    const applied = highlightExactPassage(p, "aerobic base", anchor);

    expect(applied).toBe(true);
    expect(p.querySelector("mark.note-exact-highlight")).not.toBeNull();

    vi.advanceTimersByTime(2000);
    expect(p.querySelector("mark.note-exact-highlight")).toBeNull();
    expect(p.textContent).toBe("A short paragraph about aerobic base building.");
  });

  it("returns false and leaves the DOM untouched when the passage can't be resolved", () => {
    document.body.innerHTML = "";
    const p = document.createElement("p");
    p.setAttribute("data-block-index", "0");
    p.textContent = "This paragraph no longer contains that quote.";
    document.body.appendChild(p);

    const anchor = { prefix: "gone ", suffix: " missing", blockIndex: 0 };
    const applied = highlightExactPassage(p, "text that was removed", anchor);

    expect(applied).toBe(false);
    expect(p.querySelector("mark")).toBeNull();
    expect(p.textContent).toBe("This paragraph no longer contains that quote.");
  });
});
