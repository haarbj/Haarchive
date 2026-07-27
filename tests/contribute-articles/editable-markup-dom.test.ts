// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  renderMarkupIntoElement,
  serializeElementToMarkup,
  captureSelectionOffsets,
  restoreSelectionOffsets,
} from "@/app/(app)/(protected)/contribute/articles/editable-markup-dom";

function roundTrip(markup: string): string {
  const container = document.createElement("div");
  renderMarkupIntoElement(container, markup);
  return serializeElementToMarkup(container);
}

describe("editable-markup-dom: string <-> DOM round trip", () => {
  it("round-trips plain text", () => {
    expect(roundTrip("hello world")).toBe("hello world");
  });

  it("round-trips an empty string", () => {
    expect(roundTrip("")).toBe("");
  });

  it("round-trips bold, italic, and underline", () => {
    expect(roundTrip("a **b** c")).toBe("a **b** c");
    expect(roundTrip("_i_")).toBe("_i_");
    expect(roundTrip("++u++")).toBe("++u++");
  });

  it("round-trips a link", () => {
    expect(roundTrip("see [Recovery](/recovery) now")).toBe("see [Recovery](/recovery) now");
  });

  it("round-trips nested marks", () => {
    expect(roundTrip("**really _fast_**")).toBe("**really _fast_**");
    expect(roundTrip("**[Recovery](/recovery)**")).toBe("**[Recovery](/recovery)**");
  });

  it("round-trips multiple marks in one string", () => {
    const markup = "**Bold** then _italic_ then ++under++ then see [Recovery](/recovery) done.";
    expect(roundTrip(markup)).toBe(markup);
  });
});

describe("editable-markup-dom: selection capture/restore", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("captures a selection spanning across a bold span as markup-string offsets", () => {
    renderMarkupIntoElement(container, "hello **bold** world");
    // Select "lo **bold** wo" -- starts inside the leading text node, ends
    // inside the trailing one, crossing the whole <strong> in between.
    const leadingText = container.firstChild!;
    const trailingText = container.lastChild!;
    const range = document.createRange();
    range.setStart(leadingText, 3); // "hel|lo "
    range.setEnd(trailingText, 2); // " wo|rld"
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const offsets = captureSelectionOffsets(container);
    expect(offsets).not.toBeNull();
    const markup = serializeElementToMarkup(container);
    // setEnd(trailingText, 2) selects the first 2 characters of " world" -- " w".
    expect(markup.slice(offsets!.start, offsets!.end)).toBe("lo **bold** w");
  });

  it("restores a selection at given markup offsets after a rebuild", () => {
    const markup = "hello **bold** world";
    renderMarkupIntoElement(container, markup);
    // "bold" (inside the <strong>) sits at markup offset 8..12.
    restoreSelectionOffsets(container, 8, 12);
    const offsets = captureSelectionOffsets(container);
    expect(offsets).toEqual({ start: 8, end: 12 });
  });

  it("returns null when there is no selection inside the container", () => {
    window.getSelection()?.removeAllRanges();
    expect(captureSelectionOffsets(container)).toBeNull();
  });
});
