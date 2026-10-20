// Pure text-splicing for "tap a chip, insert into a textarea at the
// cursor" -- pulled out of checkin-response-composer.tsx so the actual
// insertion math is unit-testable without a DOM/rendering harness (this
// repo has none; see any "source-scan test" header comment for why).
// Inserts a single leading space when the insertion point isn't already
// at the start of the text or right after whitespace, so two chips tapped
// back to back don't glue together into one run-on word; never adds a
// trailing space, since the coach's own next keystroke decides that.
export function insertTextAtCursor(
  current: string,
  insertionText: string,
  selectionStart: number,
  selectionEnd: number,
): { text: string; cursor: number } {
  const before = current.slice(0, selectionStart);
  const after = current.slice(selectionEnd);
  const needsSpaceBefore = before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n");
  const insertion = `${needsSpaceBefore ? " " : ""}${insertionText}`;
  return {
    text: `${before}${insertion}${after}`,
    cursor: before.length + insertion.length,
  };
}
