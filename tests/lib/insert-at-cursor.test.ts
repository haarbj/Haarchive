import { describe, expect, it } from "vitest";

import { insertTextAtCursor } from "@/lib/insert-at-cursor";

describe("insertTextAtCursor", () => {
  it("inserts into an empty textarea with no leading space", () => {
    const candidateText = "Completed all 5 scheduled workouts this week.";
    expect(insertTextAtCursor("", candidateText, 0, 0)).toEqual({ text: candidateText, cursor: candidateText.length });
  });

  it("appends after existing text with a separating space when the cursor is at the end", () => {
    const current = "Great week overall.";
    const result = insertTextAtCursor(current, "Long run up to 16 mi, longest this cycle.", current.length, current.length);
    expect(result.text).toBe("Great week overall. Long run up to 16 mi, longest this cycle.");
    expect(result.cursor).toBe(result.text.length);
  });

  it("does not double a space already present right before the cursor", () => {
    const current = "Great week overall. ";
    const result = insertTextAtCursor(current, "Nice long run.", current.length, current.length);
    expect(result.text).toBe("Great week overall. Nice long run.");
  });

  it("inserts in the middle of existing text, preserving what's after the cursor", () => {
    const current = "Hi there. See you Monday.";
    const insertAt = "Hi there.".length;
    const result = insertTextAtCursor(current, "Tuesday's Tempo at RPE 6 against a prescribed 7: controlled execution.", insertAt, insertAt);
    expect(result.text).toBe("Hi there. Tuesday's Tempo at RPE 6 against a prescribed 7: controlled execution. See you Monday.");
  });

  it("replaces a selected range rather than inserting alongside it", () => {
    const current = "Hi there, nice work this week.";
    const start = current.indexOf("nice work");
    const end = start + "nice work".length;
    const result = insertTextAtCursor(current, "excellent effort", start, end);
    expect(result.text).toBe("Hi there, excellent effort this week.");
  });

  it("the coach can keep editing after an insertion -- the result is plain text, not a locked token", () => {
    const inserted = insertTextAtCursor("", "Completed all 5 scheduled workouts this week.", 0, 0).text;
    const edited = `${inserted} Keep it up!`;
    expect(edited).toBe("Completed all 5 scheduled workouts this week. Keep it up!");
  });
});
